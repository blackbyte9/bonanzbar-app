import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).toLowerCase(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
  priceMode: z.enum(["PUBLIC", "HELPER", "DYNAMIC"]).default("DYNAMIC"),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const actor = await requirePermission(request, "users:manage");
  if (actor instanceof Response) return actor;
  try {
    const { password, ...input } = userSchema.parse(await requestJson(request));
    const user = await prisma.user.create({
      data: { ...input, passwordHash: await hashPassword(password) },
      select: { id: true, name: true, email: true, role: true, priceMode: true, active: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
