import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({ markAllPurchased: z.literal(true) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "shopping:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    updateSchema.parse(await requestJson(request));
    const list = await prisma.shoppingList.findUnique({ where: { id } });
    if (!list) return NextResponse.json({ error: "Einkaufsliste nicht gefunden." }, { status: 404 });

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.shoppingItem.updateMany({ where: { listId: id }, data: { purchased: true } });
      return transaction.shoppingList.update({
        where: { id },
        data: { status: "PURCHASED" },
        include: { items: true },
      });
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
