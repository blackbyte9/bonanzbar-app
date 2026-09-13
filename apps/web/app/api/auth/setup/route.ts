import { NextResponse } from "next/server";
import { z } from "zod";
import { roles } from "@bonanzbar/shared";
import { jsonError, requestJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  initialAdminSetupEnabled,
  sessionCookieName,
  sessionCookieOptions,
  validInitialAdminSetupToken,
} from "@/lib/session";

const setupSchema = z.object({
  setupToken: z.string().min(1).max(512),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(12).max(128),
});

class InitialAdminAlreadyCreatedError extends Error {}

export async function GET() {
  return NextResponse.json({ available: initialAdminSetupEnabled() });
}

export async function POST(request: Request) {
  if (!initialAdminSetupEnabled()) {
    return NextResponse.json({ error: "Der Erstzugang ist nicht verfügbar." }, { status: 404 });
  }

  try {
    const input = setupSchema.parse(await requestJson(request));
    if (!validInitialAdminSetupToken(input.setupToken)) {
      return NextResponse.json({ error: "Der Einrichtungsschlüssel ist ungültig." }, { status: 401 });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async (transaction) => {
      await transaction.applicationSetup.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default" },
      });
      const claimedSetup = await transaction.applicationSetup.updateMany({
        where: { id: "default", initialAdminCreatedAt: null },
        data: { initialAdminCreatedAt: new Date() },
      });
      if (claimedSetup.count === 0) throw new InitialAdminAlreadyCreatedError();

      const existing = await transaction.user.findUnique({ where: { email: input.email } });
      if (existing) {
        return transaction.user.update({
          where: { id: existing.id },
          data: {
            active: true,
            name: input.name,
            passwordHash,
            priceMode: "PUBLIC",
            roles: [...roles],
          },
        });
      }
      return transaction.user.create({
        data: {
          active: true,
          email: input.email,
          name: input.name,
          passwordHash,
          priceMode: "PUBLIC",
          roles: [...roles],
        },
      });
    });

    const token = createSessionToken(user.id);
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, roles: [...roles], priceMode: user.priceMode },
    }, { status: 201 });
    response.cookies.set({ name: sessionCookieName, value: token, ...sessionCookieOptions() });
    return response;
  } catch (error) {
    if (error instanceof InitialAdminAlreadyCreatedError) {
      return NextResponse.json({ error: "Der erste Administrationszugang wurde bereits eingerichtet." }, { status: 409 });
    }
    return jsonError(error);
  }
}
