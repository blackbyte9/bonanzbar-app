import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  title: z.string().trim().min(2).max(100),
  items: z.array(z.object({
    itemId: z.string().cuid().optional(),
    name: z.string().trim().min(2).max(100),
    quantity: z.coerce.number().int().min(1).max(10000),
  })).min(1),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "shopping:manage");
  if (user instanceof Response) return user;
  try {
    const input = listSchema.parse(await requestJson(request));
    const requestedItemIds = input.items.flatMap((item) => item.itemId ? [item.itemId] : []);
    const inventoryItems = requestedItemIds.length
      ? await prisma.inventoryItem.findMany({ where: { id: { in: requestedItemIds }, active: true } })
      : [];
    const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
    if (inventoryById.size !== new Set(requestedItemIds).size) {
      return NextResponse.json({ error: "Ein ausgewählter Inventarartikel ist nicht verfügbar." }, { status: 400 });
    }

    const list = await prisma.shoppingList.create({
      data: {
        title: input.title,
        createdBy: user.id,
        items: {
          create: input.items.map((item) => ({
            itemId: item.itemId,
            name: item.itemId ? inventoryById.get(item.itemId)!.name : item.name,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
