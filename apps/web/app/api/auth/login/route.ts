import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestJson } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(12).max(128),
  mobile: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await requestJson(request));
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.active || !user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      return NextResponse.json({ error: "E-Mail-Adresse oder Passwort ist nicht korrekt." }, { status: 401 });
    }

    const token = createSessionToken(user.id);
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, priceMode: user.priceMode },
      ...(input.mobile ? { accessToken: token } : {}),
    });
    response.cookies.set({ name: sessionCookieName, value: token, ...sessionCookieOptions() });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
