import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const noteSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(4000),
  pinned: z.boolean().optional(),
  eventId: z.string().cuid().nullable().optional(),
});

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  try {
    const notes = await prisma.bulletinNote.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: { event: { select: { id: true, title: true } } },
    });
    return NextResponse.json(notes);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await requirePermission(request, "events:manage");
  if (user instanceof Response) return user;
  try {
    const input = noteSchema.parse(await requestJson(request));
    if (input.eventId) {
      const event = await prisma.barEvent.findUnique({ where: { id: input.eventId }, select: { id: true } });
      if (!event) return NextResponse.json({ error: "Die zugeordnete Veranstaltung wurde nicht gefunden." }, { status: 400 });
    }
    const note = await prisma.bulletinNote.create({
      data: {
        title: input.title,
        body: input.body,
        pinned: input.pinned ?? false,
        eventId: input.eventId || null,
        createdBy: user.id,
      },
      include: { event: { select: { id: true, title: true } } },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
