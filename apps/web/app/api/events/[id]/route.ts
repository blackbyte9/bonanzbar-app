import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const httpUrl = z.string().trim().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Nur HTTP(S)-URLs sind erlaubt.");

const youtubeUrl = httpUrl.refine((value) => {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be";
}, "Bitte eine YouTube-URL angeben.");

const updateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  bandInfo: z.string().trim().max(4000).nullable().optional(),
  bandHomepageUrl: httpUrl.nullable().optional(),
  bandImageUrls: z.array(httpUrl).max(4).optional(),
  ticketUrl: httpUrl.nullable().optional(),
  youtubeUrl: youtubeUrl.nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
}).refine((event) => Object.keys(event).length > 0, "Mindestens ein Veranstaltungsfeld muss angegeben werden.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "events:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await requestJson(request));
    const existing = await prisma.barEvent.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Veranstaltung nicht gefunden." }, { status: 404 });
    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt ? new Date(input.endsAt) : null;
    if (endsAt && endsAt <= startsAt) {
      return NextResponse.json({ error: "Das Ende muss nach dem Beginn liegen." }, { status: 400 });
    }
    const event = await prisma.barEvent.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description === undefined ? undefined : input.description || null,
        location: input.location === undefined ? undefined : input.location || null,
        bandInfo: input.bandInfo === undefined ? undefined : input.bandInfo || null,
        bandHomepageUrl: input.bandHomepageUrl === undefined ? undefined : input.bandHomepageUrl || null,
        bandImageUrls: input.bandImageUrls,
        ticketUrl: input.ticketUrl === undefined ? undefined : input.ticketUrl || null,
        youtubeUrl: input.youtubeUrl === undefined ? undefined : input.youtubeUrl || null,
        startsAt,
        endsAt,
        status: input.status,
      },
      include: { duties: true },
    });
    return NextResponse.json(event);
  } catch (error) {
    return jsonError(error);
  }
}
