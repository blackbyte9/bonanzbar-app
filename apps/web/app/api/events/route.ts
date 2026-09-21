import { NextResponse } from "next/server";
import { hasRole } from "@bonanzbar/shared";
import { z } from "zod";
import { authenticate, requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const dutySchema = z.object({
  label: z.string().trim().min(2).max(60),
  slots: z.coerce.number().int().min(1).max(50),
});

const eventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).default("DRAFT"),
  duties: z.array(dutySchema).min(1).max(20),
}).superRefine((event, context) => {
  if (event.endsAt && new Date(event.endsAt) <= new Date(event.startsAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Das Ende muss nach dem Beginn liegen." });
  }
  const labels = event.duties.map((duty) => duty.label.toLocaleLowerCase("de-DE"));
  if (new Set(labels).size !== labels.length) {
    context.addIssue({ code: "custom", path: ["duties"], message: "Jeder Dienst darf nur einmal vorkommen." });
  }
});

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  try {
    const canManage = hasRole(user.roles, "MANAGER");
    const events = await prisma.barEvent.findMany({
      where: canManage ? {} : { status: "PUBLISHED" },
      orderBy: { startsAt: "asc" },
      include: {
        duties: {
          orderBy: { label: "asc" },
          include: {
            applications: canManage
              ? { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, email: true } } } }
              : { where: { userId: user.id }, select: { id: true, status: true, note: true, createdAt: true } },
          },
        },
      },
    });
    return NextResponse.json(events);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await requirePermission(request, "events:manage");
  if (user instanceof Response) return user;
  try {
    const input = eventSchema.parse(await requestJson(request));
    const event = await prisma.barEvent.create({
      data: {
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        status: input.status,
        createdBy: user.id,
        duties: { create: input.duties },
      },
      include: { duties: true },
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
