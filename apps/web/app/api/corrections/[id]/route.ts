import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const resolutionSchema = z.object({
  voidedQuantity: z.coerce.number().int().min(0).max(10_000),
  response: z.string().trim().min(1).max(300),
});

class CorrectionConflictError extends Error {}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "bills:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = resolutionSchema.parse(await requestJson(request));
    const result = await prisma.$transaction(async (transaction) => {
      const correction = await transaction.consumptionCorrection.findUnique({
        where: { id },
        select: { id: true, userId: true, itemId: true, status: true },
      });
      if (!correction) return { kind: "missing" as const };
      if (correction.status !== "PENDING") return { kind: "resolved" as const };

      const locked = await transaction.consumptionCorrection.updateMany({
        where: { id: correction.id, status: "PENDING" },
        data: {
          status: "RESOLVED",
          response: input.response,
          voidedQuantity: input.voidedQuantity,
          resolvedAt: new Date(),
          resolvedBy: user.id,
        },
      });
      if (locked.count !== 1) throw new CorrectionConflictError();

      if (input.voidedQuantity > 0) {
        const consumptions = await transaction.consumption.findMany({
          where: { userId: correction.userId, itemId: correction.itemId, voidedAt: null, correctionId: null },
          orderBy: { occurredAt: "desc" },
          select: { id: true },
          take: input.voidedQuantity,
        });
        if (consumptions.length !== input.voidedQuantity) {
          throw new CorrectionConflictError("Die Anzahl offener Konsumeinträge hat sich geändert.");
        }
        const voided = await transaction.consumption.updateMany({
          where: { id: { in: consumptions.map((consumption) => consumption.id) }, voidedAt: null, correctionId: null },
          data: { voidedAt: new Date(), voidedBy: user.id, correctionId: correction.id },
        });
        if (voided.count !== input.voidedQuantity) throw new CorrectionConflictError();
      }

      return { kind: "updated" as const };
    });
    if (result.kind === "missing") return NextResponse.json({ error: "Korrekturanfrage nicht gefunden." }, { status: 404 });
    if (result.kind === "resolved") return NextResponse.json({ error: "Diese Korrekturanfrage wurde bereits bearbeitet." }, { status: 409 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof CorrectionConflictError) {
      return NextResponse.json({ error: error.message || "Die Korrekturanfrage konnte nicht sicher abgeschlossen werden. Bitte aktualisiere die Seite." }, { status: 409 });
    }
    return jsonError(error);
  }
}
