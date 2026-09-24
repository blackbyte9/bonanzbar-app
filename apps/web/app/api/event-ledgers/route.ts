import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const entrySchema = z.object({
  eventId: z.string().cuid(),
  label: z.string().trim().min(2).max(240),
  amountCents: z.coerce.number().int().min(1).max(100000000),
  kind: z.enum(["INCOME", "EXPENSE"]),
  occurredAt: z.string().datetime().optional(),
});

const closeSchema = z.object({
  eventId: z.string().cuid(),
  closed: z.literal(true),
});

const ledgerInclude = {
  event: { select: { id: true, title: true, startsAt: true } },
  entries: { orderBy: { occurredAt: "desc" as const } },
};

export async function GET(request: Request) {
  const user = await requirePermission(request, "ledger:manage");
  if (user instanceof Response) return user;
  try {
    const ledgers = await prisma.eventLedger.findMany({
      orderBy: { event: { startsAt: "desc" } },
      include: ledgerInclude,
    });
    return NextResponse.json(ledgers);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await requirePermission(request, "ledger:manage");
  if (user instanceof Response) return user;
  try {
    const input = entrySchema.parse(await requestJson(request));
    const event = await prisma.barEvent.findUnique({ where: { id: input.eventId }, select: { id: true } });
    if (!event) return NextResponse.json({ error: "Veranstaltung nicht gefunden." }, { status: 404 });
    const ledger = await prisma.eventLedger.upsert({
      where: { eventId: input.eventId },
      update: {},
      create: { eventId: input.eventId, createdBy: user.id },
    });
    if (ledger.closed) return NextResponse.json({ error: "Die Veranstaltungsabrechnung ist bereits abgeschlossen." }, { status: 409 });
    const entry = await prisma.eventLedgerEntry.create({
      data: {
        ledgerId: ledger.id,
        label: input.label,
        amountCents: input.amountCents,
        kind: input.kind,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        createdBy: user.id,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  const user = await requirePermission(request, "ledger:manage");
  if (user instanceof Response) return user;
  try {
    const input = closeSchema.parse(await requestJson(request));
    const ledger = await prisma.eventLedger.findUnique({ where: { eventId: input.eventId } });
    if (!ledger) return NextResponse.json({ error: "Für diese Veranstaltung gibt es noch keine Abrechnung." }, { status: 404 });
    if (ledger.closed) return NextResponse.json({ error: "Die Veranstaltungsabrechnung ist bereits abgeschlossen." }, { status: 409 });
    const updated = await prisma.eventLedger.update({
      where: { id: ledger.id },
      data: { closed: true, closedAt: new Date(), closedBy: user.id },
      include: ledgerInclude,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
