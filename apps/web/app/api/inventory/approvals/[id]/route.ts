import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const draftSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(30),
  reorderLevel: z.coerce.number().int().min(0).max(100000),
  priceCents: z.coerce.number().int().min(0).max(100000000),
  helperPriceCents: z.coerce.number().int().min(0).max(100000000),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "inventory:write");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = draftSchema.parse(await requestJson(request));
    const shoppingItem = await prisma.shoppingItem.findFirst({
      where: { id, itemId: null },
      select: { id: true },
    });
    if (!shoppingItem) {
      return NextResponse.json({ error: "Dieser Artikel ist bereits freigegeben oder nicht vorhanden." }, { status: 409 });
    }
    const updated = await prisma.shoppingItem.update({
      where: { id },
      data: {
        name: input.name,
        proposedCategory: input.category,
        proposedUnit: input.unit,
        proposedReorderLevel: input.reorderLevel,
        proposedPriceCents: input.priceCents,
        proposedHelperPriceCents: input.helperPriceCents,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
