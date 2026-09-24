import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "ledger:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const entry = await prisma.eventLedgerEntry.findUnique({
      where: { id },
      include: { ledger: { select: { closed: true } } },
    });
    if (!entry) return NextResponse.json({ error: "Abrechnungszeile nicht gefunden." }, { status: 404 });
    if (entry.ledger.closed) return NextResponse.json({ error: "Die Veranstaltungsabrechnung ist bereits abgeschlossen." }, { status: 409 });
    await prisma.eventLedgerEntry.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
