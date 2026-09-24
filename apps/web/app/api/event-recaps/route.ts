import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const httpUrl = z.string().trim().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Nur HTTP(S)-URLs sind erlaubt.");

const recapSchema = z.object({
  eventId: z.string().cuid(),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(10_000),
  imageUrls: z.array(httpUrl).max(6).default([]),
  published: z.boolean(),
  photoConsent: z.boolean().default(false),
});

export async function GET(request: Request) {
  const user = await requirePermission(request, "recaps:manage");
  if (user instanceof Response) return user;
  try {
    const recaps = await prisma.eventRecap.findMany({
      orderBy: { updatedAt: "desc" },
      include: { event: { select: { id: true, title: true, startsAt: true } } },
    });
    return NextResponse.json(recaps);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await requirePermission(request, "recaps:manage");
  if (user instanceof Response) return user;
  try {
    const input = recapSchema.parse(await requestJson(request));
    const event = await prisma.barEvent.findUnique({
      where: { id: input.eventId },
      select: { startsAt: true, endsAt: true },
    });
    if (!event) return NextResponse.json({ error: "Veranstaltung nicht gefunden." }, { status: 404 });
    if ((event.endsAt ?? event.startsAt) >= new Date()) {
      return NextResponse.json({ error: "Ein Rückblick kann erst nach der Veranstaltung veröffentlicht werden." }, { status: 400 });
    }
    if (input.published && input.imageUrls.length > 0 && !input.photoConsent) {
      return NextResponse.json({ error: "Für veröffentlichte Bilder ist die Fotoeinwilligung zu bestätigen." }, { status: 400 });
    }

    const recap = await prisma.eventRecap.upsert({
      where: { eventId: input.eventId },
      update: {
        title: input.title,
        body: input.body,
        imageUrls: input.imageUrls,
        published: input.published,
        publishedAt: input.published ? new Date() : null,
      },
      create: {
        eventId: input.eventId,
        title: input.title,
        body: input.body,
        imageUrls: input.imageUrls,
        published: input.published,
        publishedAt: input.published ? new Date() : null,
        createdBy: user.id,
      },
      include: { event: { select: { id: true, title: true, startsAt: true } } },
    });
    return NextResponse.json(recap, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
