import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole, normalizeRoles } from "@bonanzbar/shared";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(254).toLowerCase().optional(),
  roles: z.array(z.enum(["ADMIN", "MANAGER", "USER"])).min(1).max(3).optional(),
  priceMode: z.enum(["PUBLIC", "HELPER", "DYNAMIC"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(12).max(128).optional(),
}).refine((data) => Object.keys(data).length > 0, "Mindestens ein Benutzerfeld muss angegeben werden.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(request, "users:manage");
  if (actor instanceof Response) return actor;
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await requestJson(request));
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    const nextRoles = input.roles ? normalizeRoles(input.roles) : normalizeRoles(existing.roles);
    if (id === actor.id && (input.active === false || !hasRole(nextRoles, "ADMIN"))) {
      return NextResponse.json({ error: "Administratoren können ihr eigenes Konto nicht deaktivieren oder die Administrationsrolle entfernen." }, { status: 400 });
    }
    const { password, roles, ...update } = input;
    const user = await prisma.user.update({
      where: { id },
      data: { ...update, ...(roles ? { roles: normalizeRoles(roles) } : {}), ...(password ? { passwordHash: await hashPassword(password) } : {}) },
      select: { id: true, name: true, email: true, roles: true, priceMode: true, active: true },
    });
    return NextResponse.json({ ...user, roles: normalizeRoles(user.roles) });
  } catch (error) {
    return jsonError(error);
  }
}
