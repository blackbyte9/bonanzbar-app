import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const correctionSchema = z.object({
  itemId: z.string().cuid(),
  note: z.string().trim().min(1).max(2_000),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "consumption:create");
  if (user instanceof Response) return user;
  try {
    const input = correctionSchema.parse(await requestJson(request));
    const [item, uncorrectedConsumption, pendingRequest] = await Promise.all([
      prisma.inventoryItem.findUnique({ where: { id: input.itemId }, select: { id: true } }),
      prisma.consumption.findFirst({
        where: { userId: user.id, itemId: input.itemId, voidedAt: null },
        select: { id: true },
      }),
      prisma.consumptionCorrection.findFirst({
        where: { userId: user.id, itemId: input.itemId, status: "PENDING" },
        select: { id: true },
      }),
    ]);
    if (!item || !uncorrectedConsumption) {
      return NextResponse.json({ error: "Für diesen Artikel gibt es keinen offenen Konsumeintrag, der korrigiert werden kann." }, { status: 400 });
    }
    if (pendingRequest) {
      return NextResponse.json({ error: "Für diesen Artikel ist bereits eine Korrekturanfrage offen." }, { status: 409 });
    }
    const correction = await prisma.consumptionCorrection.create({
      data: { userId: user.id, itemId: input.itemId, note: input.note },
      include: { item: { select: { name: true } } },
    });
    return NextResponse.json(correction, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
