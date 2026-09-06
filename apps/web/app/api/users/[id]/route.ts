import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(254).toLowerCase().optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).optional(),
  priceMode: z.enum(["PUBLIC", "HELPER", "DYNAMIC"]).optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, "Mindestens ein Benutzerfeld muss angegeben werden.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(request, "users:manage");
  if (actor instanceof Response) return actor;
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await requestJson(request));
    if (id === actor.id && (input.active === false || (input.role && input.role !== "ADMIN"))) {
      return NextResponse.json({ error: "Administratoren können ihr eigenes Konto nicht deaktivieren oder herabstufen." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    const user = await prisma.user.update({ where: { id }, data: input });
    return NextResponse.json(user);
  } catch (error) {
    return jsonError(error);
  }
}
