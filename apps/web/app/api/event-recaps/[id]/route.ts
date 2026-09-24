import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "recaps:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const recap = await prisma.eventRecap.findUnique({ where: { id }, select: { id: true } });
    if (!recap) return NextResponse.json({ error: "Rückblick nicht gefunden." }, { status: 404 });
    await prisma.eventRecap.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
