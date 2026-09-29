import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { shoppingItemQuantity } from "@/lib/shopping-items";

const purchaseUpdateSchema = z.object({ purchased: z.boolean() }).strict();
const itemUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  quantity: z.coerce.number().int().min(1).max(10000),
  quantityMode: z.enum(["UNIT", "PACKAGE"]).default("UNIT"),
}).strict();
const updateSchema = z.union([purchaseUpdateSchema, itemUpdateSchema]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const user = await requirePermission(request, "shopping:manage");
  if (user instanceof Response) return user;
  try {
    const { id, itemId } = await context.params;
    const input = updateSchema.parse(await requestJson(request));
    const item = await prisma.shoppingItem.findFirst({ where: { id: itemId, listId: id } });
    if (!item) return NextResponse.json({ error: "Einkaufsposition nicht gefunden." }, { status: 404 });

    if (!("purchased" in input)) {
      const inventoryItem = item.itemId
        ? await prisma.inventoryItem.findUnique({ where: { id: item.itemId }, select: { name: true, packageSize: true } })
        : null;
      if (input.quantityMode === "PACKAGE" && !inventoryItem) {
        return NextResponse.json({ error: "Gebinde können nur für bekannte Inventarartikel gewählt werden." }, { status: 400 });
      }
      const quantity = shoppingItemQuantity(input, inventoryItem?.packageSize);
      const updated = await prisma.$transaction(async (transaction) => {
        await transaction.shoppingItem.update({
          where: { id: itemId },
          data: {
            name: inventoryItem?.name ?? input.name ?? item.name,
            quantity,
          },
        });
        return transaction.shoppingList.findUniqueOrThrow({ where: { id }, include: { items: true } });
      });
      return NextResponse.json(updated);
    }

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.shoppingItem.update({
        where: { id: itemId },
        data: { purchased: input.purchased, purchasedAt: input.purchased ? new Date() : null },
      });
      const openItems = await transaction.shoppingItem.count({ where: { listId: id, purchased: false } });
      return transaction.shoppingList.update({
        where: { id },
        data: { status: openItems === 0 ? "PURCHASED" : "OPEN" },
        include: { items: true },
      });
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
