import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const searchSchema = z.object({
  fromCountId: z.string().cuid(),
  toCountId: z.string().cuid(),
});

export async function GET(request: Request) {
  const user = await requirePermission(request, "reports:read");
  if (user instanceof Response) return user;
  try {
    const input = searchSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const [from, to] = await Promise.all([
      prisma.stockCount.findUnique({ where: { id: input.fromCountId }, include: { lines: { include: { item: true } } } }),
      prisma.stockCount.findUnique({ where: { id: input.toCountId }, include: { lines: { include: { item: true } } } }),
    ]);
    if (!from || !to || from.countedAt >= to.countedAt) {
      return NextResponse.json({ error: "Wähle zwei Zählungen in zeitlicher Reihenfolge." }, { status: 400 });
    }
    const ending = new Map(to.lines.map((line) => [line.itemId, line.quantity]));
    const sold = from.lines.map((line) => {
      const quantity = Math.max(0, line.quantity - (ending.get(line.itemId) ?? 0));
      return { itemId: line.itemId, name: line.item.name, unit: line.item.unit, quantity, revenueCents: quantity * line.item.priceCents };
    }).filter((line) => line.quantity > 0);
    return NextResponse.json({
      from: { id: from.id, label: from.label, countedAt: from.countedAt },
      to: { id: to.id, label: to.label, countedAt: to.countedAt },
      sold,
      totalRevenueCents: sold.reduce((total, line) => total + line.revenueCents, 0),
      methodology: "Bestandsabgang zwischen abgeschlossenen Zählungen, bewertet zum regulären Preis. Nachbestellungen nach der Eröffnungszählung werden noch nicht verrechnet.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
