import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeRoles } from "@bonanzbar/shared";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).toLowerCase(),
  roles: z.array(z.enum(["ADMIN", "MANAGER", "USER"])).min(1).max(3),
  priceMode: z.enum(["PUBLIC", "HELPER", "DYNAMIC"]).default("DYNAMIC"),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const actor = await requirePermission(request, "users:manage");
  if (actor instanceof Response) return actor;
  try {
    const { password, roles, ...input } = userSchema.parse(await requestJson(request));
    const user = await prisma.user.create({
      data: { ...input, roles: normalizeRoles(roles), passwordHash: await hashPassword(password) },
      select: { id: true, name: true, email: true, roles: true, priceMode: true, active: true },
    });
    return NextResponse.json({ ...user, roles: normalizeRoles(user.roles) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
