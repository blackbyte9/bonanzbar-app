import { NextResponse } from "next/server";
import { resolveUnitPriceCents } from "@bonanzbar/shared";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const consumptionSchema = z.object({
  itemId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(100),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "consumption:create");
  if (user instanceof Response) return user;
  try {
    const input = consumptionSchema.parse(await requestJson(request));
    const [item, barSettings] = await Promise.all([
      prisma.inventoryItem.findFirst({ where: { id: input.itemId, active: true } }),
      prisma.barSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    ]);
    if (!item) return NextResponse.json({ error: "Dieser Inventarartikel ist nicht verfügbar." }, { status: 400 });
    const consumption = await prisma.consumption.create({
      data: {
        userId: user.id,
        itemId: item.id,
        quantity: input.quantity,
        unitCents: resolveUnitPriceCents(item, user.priceMode, barSettings.isOfficiallyOpen),
      },
      include: { item: true },
    });
    return NextResponse.json(consumption, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
