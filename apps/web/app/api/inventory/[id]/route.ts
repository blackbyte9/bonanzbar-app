import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(100000).optional(),
  priceCents: z.coerce.number().int().min(0).max(100000000).optional(),
  helperPriceCents: z.coerce.number().int().min(0).max(100000000).optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, "Mindestens ein Inventarfeld muss angegeben werden.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "inventory:write");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await requestJson(request));
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Inventarartikel nicht gefunden." }, { status: 404 });
    const conflictingItem = await prisma.inventoryItem.findFirst({
      where: {
        name: input.name ?? existing.name,
        unit: input.unit ?? existing.unit,
        id: { not: id },
      },
      select: { id: true },
    });
    if (conflictingItem) {
      return NextResponse.json({ error: "Ein Artikel mit diesem Namen und dieser Einheit existiert bereits." }, { status: 409 });
    }
    const item = await prisma.inventoryItem.update({ where: { id }, data: input });
    return NextResponse.json(item);
  } catch (error) {
    return jsonError(error);
  }
}
