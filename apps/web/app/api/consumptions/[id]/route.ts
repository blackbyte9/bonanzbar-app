import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const undoWindowMs = 10_000;

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "consumption:undo");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const undone = await prisma.consumption.updateMany({
      where: {
        id,
        userId: user.id,
        voidedAt: null,
        occurredAt: { gte: new Date(Date.now() - undoWindowMs) },
      },
      data: { voidedAt: new Date(), voidedBy: user.id },
    });
    if (undone.count === 0) {
      return NextResponse.json({ error: "Dieser Eintrag kann nicht mehr sofort zurückgenommen werden." }, { status: 409 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
