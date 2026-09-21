import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const applicationSchema = z.object({
  dutyId: z.string().cuid(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "events:apply");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = applicationSchema.parse(await requestJson(request));
    const duty = await prisma.eventDuty.findFirst({
      where: {
        id: input.dutyId,
        eventId: id,
        event: { status: "PUBLISHED", startsAt: { gte: new Date() } },
      },
      select: { id: true },
    });
    if (!duty) {
      return NextResponse.json({ error: "Dieser Dienst ist nicht mehr für Bewerbungen verfügbar." }, { status: 400 });
    }
    const existing = await prisma.eventDutyApplication.findUnique({
      where: { dutyId_userId: { dutyId: duty.id, userId: user.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Du hast dich bereits auf diesen Dienst beworben." }, { status: 409 });
    }
    const application = await prisma.eventDutyApplication.create({
      data: { dutyId: duty.id, userId: user.id, note: input.note || null },
      select: { id: true, dutyId: true, status: true, note: true, createdAt: true },
    });
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
