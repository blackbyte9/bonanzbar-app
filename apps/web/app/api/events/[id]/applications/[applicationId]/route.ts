import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  status: z.enum(["APPLIED", "CONFIRMED", "DECLINED"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string; applicationId: string }> }) {
  const user = await requirePermission(request, "events:manage");
  if (user instanceof Response) return user;
  try {
    const { id, applicationId } = await context.params;
    const input = statusSchema.parse(await requestJson(request));
    const application = await prisma.eventDutyApplication.findFirst({
      where: { id: applicationId, duty: { eventId: id } },
      include: {
        duty: {
          include: {
            applications: {
              where: { status: "CONFIRMED" },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!application) return NextResponse.json({ error: "Dienstbewerbung nicht gefunden." }, { status: 404 });
    if (
      input.status === "CONFIRMED" &&
      application.status !== "CONFIRMED" &&
      application.duty.applications.length >= application.duty.slots
    ) {
      return NextResponse.json({ error: "Dieser Dienst ist bereits vollständig besetzt." }, { status: 409 });
    }
    const updated = await prisma.eventDutyApplication.update({
      where: { id: application.id },
      data: { status: input.status },
      select: { id: true, dutyId: true, userId: true, status: true, note: true, updatedAt: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; applicationId: string }> }) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  try {
    const { id, applicationId } = await context.params;
    const application = await prisma.eventDutyApplication.findFirst({
      where: { id: applicationId, userId: user.id, duty: { eventId: id } },
      select: { id: true, status: true },
    });
    if (!application) return NextResponse.json({ error: "Dienstbewerbung nicht gefunden." }, { status: 404 });
    if (application.status !== "APPLIED") {
      return NextResponse.json({ error: "Bestätigte oder abgelehnte Bewerbungen können nicht selbst zurückgezogen werden." }, { status: 400 });
    }
    await prisma.eventDutyApplication.delete({ where: { id: application.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
