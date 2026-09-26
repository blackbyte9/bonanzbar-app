import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const dutySchema = z.object({
  label: z.string().trim().min(2).max(60),
  slots: z.coerce.number().int().min(1).max(50),
});

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
  duties: z.array(dutySchema).max(20).optional(),
}).superRefine((event, context) => {
  if (!event.duties) return;
  const labels = event.duties.map((duty) => duty.label.toLocaleLowerCase("de-DE"));
  if (new Set(labels).size !== labels.length) {
    context.addIssue({ code: "custom", path: ["duties"], message: "Jeder Dienst darf nur einmal vorkommen." });
  }
}).refine((event) => Object.keys(event).length > 0, "Mindestens ein Veranstaltungsfeld muss angegeben werden.");

class EventDutyConflictError extends Error {}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "events:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await requestJson(request));
    const event = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.barEvent.findUnique({
        where: { id },
        include: { duties: { include: { applications: { select: { status: true } } } } },
      });
      if (!existing) return null;

      const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
      const endsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt ? new Date(input.endsAt) : null;
      if (endsAt && endsAt <= startsAt) throw new EventDutyConflictError("Das Ende muss nach dem Beginn liegen.");

      if (input.duties !== undefined) {
        const existingByLabel = new Map(existing.duties.map((duty) => [duty.label.toLocaleLowerCase("de-DE"), duty]));
        const requestedLabels = new Set(input.duties.map((duty) => duty.label.toLocaleLowerCase("de-DE")));
        for (const duty of existing.duties) {
          if (requestedLabels.has(duty.label.toLocaleLowerCase("de-DE"))) continue;
          if (duty.applications.length > 0) {
            throw new EventDutyConflictError(`Der Dienst „${duty.label}“ kann nicht entfernt werden, weil bereits Bewerbungen vorhanden sind.`);
          }
          await transaction.eventDuty.delete({ where: { id: duty.id } });
        }
        for (const duty of input.duties) {
          const existingDuty = existingByLabel.get(duty.label.toLocaleLowerCase("de-DE"));
          if (!existingDuty) {
            await transaction.eventDuty.create({ data: { eventId: id, label: duty.label, slots: duty.slots } });
            continue;
          }
          const confirmed = existingDuty.applications.filter((application) => application.status === "CONFIRMED").length;
          if (duty.slots < confirmed) {
            throw new EventDutyConflictError(`Für „${existingDuty.label}“ sind bereits ${confirmed} Personen bestätigt.`);
          }
          await transaction.eventDuty.update({ where: { id: existingDuty.id }, data: { slots: duty.slots } });
        }
      }

      return transaction.barEvent.update({
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
    });
    if (!event) return NextResponse.json({ error: "Veranstaltung nicht gefunden." }, { status: 404 });
    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof EventDutyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return jsonError(error);
  }
}
