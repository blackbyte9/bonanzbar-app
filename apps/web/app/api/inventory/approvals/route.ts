import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const approvalSchema = z.object({
  shoppingItemId: z.string().cuid(),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "inventory:write");
  if (user instanceof Response) return user;
  try {
    const input = approvalSchema.parse(await requestJson(request));
    const result = await prisma.$transaction(async (transaction) => {
      const shoppingItem = await transaction.shoppingItem.findFirst({
        where: { id: input.shoppingItemId, itemId: null },
        select: {
          id: true,
          name: true,
          proposedCategory: true,
          proposedUnit: true,
          proposedReorderLevel: true,
          proposedPriceCents: true,
          proposedHelperPriceCents: true,
        },
      });
      if (!shoppingItem) return { kind: "missing" as const };
      if (
        shoppingItem.proposedCategory === null ||
        shoppingItem.proposedUnit === null ||
        shoppingItem.proposedReorderLevel === null ||
        shoppingItem.proposedPriceCents === null ||
        shoppingItem.proposedHelperPriceCents === null
      ) {
        return { kind: "incomplete" as const };
      }

      const existingItem = await transaction.inventoryItem.findFirst({
        where: { name: shoppingItem.name, unit: shoppingItem.proposedUnit },
      });
      const item = existingItem
        ? await transaction.inventoryItem.update({
          where: { id: existingItem.id },
          data: {
            category: shoppingItem.proposedCategory,
            reorderLevel: shoppingItem.proposedReorderLevel,
            priceCents: shoppingItem.proposedPriceCents,
            helperPriceCents: shoppingItem.proposedHelperPriceCents,
            active: true,
          },
        })
        : await transaction.inventoryItem.create({
          data: {
            name: shoppingItem.name,
            category: shoppingItem.proposedCategory,
            unit: shoppingItem.proposedUnit,
            reorderLevel: shoppingItem.proposedReorderLevel,
            priceCents: shoppingItem.proposedPriceCents,
            helperPriceCents: shoppingItem.proposedHelperPriceCents,
          },
        });

      await transaction.shoppingItem.updateMany({
        where: { id: shoppingItem.id, itemId: null },
        data: { itemId: item.id },
      });
      return { kind: "approved" as const, item };
    });
    if (result.kind === "missing") {
      return NextResponse.json({ error: "Diese Einkaufsposition ist bereits freigegeben oder nicht vorhanden." }, { status: 409 });
    }
    if (result.kind === "incomplete") {
      return NextResponse.json({ error: "Bitte speichere zuerst Kategorie, Einheit, Meldebestand sowie regulären Preis und Helferpreis." }, { status: 400 });
    }
    return NextResponse.json(result.item, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
