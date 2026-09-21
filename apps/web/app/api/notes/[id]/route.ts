import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  body: z.string().trim().min(2).max(4000).optional(),
  pinned: z.boolean().optional(),
  eventId: z.string().cuid().nullable().optional(),
}).refine((note) => Object.keys(note).length > 0, "Mindestens ein Notizfeld muss angegeben werden.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "events:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await requestJson(request));
    const existing = await prisma.bulletinNote.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Notiz nicht gefunden." }, { status: 404 });
    if (input.eventId) {
      const event = await prisma.barEvent.findUnique({ where: { id: input.eventId }, select: { id: true } });
      if (!event) return NextResponse.json({ error: "Die zugeordnete Veranstaltung wurde nicht gefunden." }, { status: 400 });
    }
    const note = await prisma.bulletinNote.update({
      where: { id },
      data: input,
      include: { event: { select: { id: true, title: true } } },
    });
    return NextResponse.json(note);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "events:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const result = await prisma.bulletinNote.deleteMany({ where: { id } });
    if (result.count === 0) return NextResponse.json({ error: "Notiz nicht gefunden." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
