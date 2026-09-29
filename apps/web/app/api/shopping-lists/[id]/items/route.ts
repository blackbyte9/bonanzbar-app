import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { shoppingItemInputSchema, shoppingItemQuantity } from "@/lib/shopping-items";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "shopping:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = shoppingItemInputSchema.parse(await requestJson(request));
    const list = await prisma.shoppingList.findUnique({ where: { id }, select: { status: true } });
    if (!list) return NextResponse.json({ error: "Einkaufsliste nicht gefunden." }, { status: 404 });
    if (list.status !== "OPEN") {
      return NextResponse.json({ error: "Diese Einkaufsliste ist bereits abgeschlossen und kann nicht mehr geändert werden." }, { status: 409 });
    }

    const inventoryItem = input.itemId
      ? await prisma.inventoryItem.findFirst({ where: { id: input.itemId, active: true, trackInventory: true } })
      : null;
    if (input.itemId && !inventoryItem) {
      return NextResponse.json({ error: "Der ausgewählte Artikel wird nicht im Inventar geführt und kann nicht nachbestellt werden." }, { status: 400 });
    }
    if (input.quantityMode === "PACKAGE" && !inventoryItem) {
      return NextResponse.json({ error: "Gebinde können nur für bekannte Inventarartikel gewählt werden." }, { status: 400 });
    }
    const quantity = shoppingItemQuantity(input, inventoryItem?.packageSize);

    const updated = await prisma.$transaction(async (transaction) => {
      const existing = input.itemId
        ? await transaction.shoppingItem.findFirst({ where: { listId: id, itemId: input.itemId, purchased: false }, select: { id: true } })
        : null;
      if (existing) {
        await transaction.shoppingItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } },
        });
      } else {
        await transaction.shoppingItem.create({
          data: {
            listId: id,
            itemId: input.itemId,
            name: inventoryItem?.name ?? input.name,
            quantity,
          },
        });
      }
      return transaction.shoppingList.findUniqueOrThrow({ where: { id }, include: { items: true } });
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
