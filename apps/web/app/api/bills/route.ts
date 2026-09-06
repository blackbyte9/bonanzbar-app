import { NextResponse } from "next/server";
import { resolveUnitPriceCents } from "@bonanzbar/shared";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const billSchema = z.object({
  recipientId: z.string().cuid(),
  dueAt: z.string().datetime().optional(),
  lines: z.array(z.object({
    itemId: z.string().cuid(),
    quantity: z.coerce.number().int().min(1).max(10000),
  })).min(1),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "bills:manage");
  if (user instanceof Response) return user;
  try {
    const input = billSchema.parse(await requestJson(request));
    const [recipient, inventory, barSettings] = await Promise.all([
      prisma.user.findFirst({ where: { id: input.recipientId, active: true } }),
      prisma.inventoryItem.findMany({ where: { id: { in: input.lines.map((line) => line.itemId) }, active: true } }),
      prisma.barSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    ]);
    if (!recipient || inventory.length !== new Set(input.lines.map((line) => line.itemId)).size) {
      return NextResponse.json({ error: "Der Rechnungsempfänger oder ein Inventarartikel ist nicht verfügbar." }, { status: 400 });
    }
    const items = new Map(inventory.map((item) => [item.id, item]));
    const lines = input.lines.map((line) => {
      const item = items.get(line.itemId)!;
      return {
        itemId: item.id,
        description: item.name,
        quantity: line.quantity,
        unitCents: resolveUnitPriceCents(item, recipient.priceMode, barSettings.isOfficiallyOpen),
      };
    });
    const totalCents = lines.reduce((total, line) => total + line.quantity * line.unitCents, 0);
    const bill = await prisma.bill.create({
      data: {
        recipientId: recipient.id,
        totalCents,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        lines: { create: lines },
      },
      include: { lines: true, recipient: { select: { name: true } } },
    });
    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
