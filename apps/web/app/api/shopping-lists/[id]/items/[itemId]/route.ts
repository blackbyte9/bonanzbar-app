import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({ purchased: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const user = await requirePermission(request, "shopping:manage");
  if (user instanceof Response) return user;
  try {
    const { id, itemId } = await context.params;
    const { purchased } = updateSchema.parse(await requestJson(request));
    const item = await prisma.shoppingItem.findFirst({ where: { id: itemId, listId: id } });
    if (!item) return NextResponse.json({ error: "Einkaufsposition nicht gefunden." }, { status: 404 });

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.shoppingItem.update({ where: { id: itemId }, data: { purchased } });
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
