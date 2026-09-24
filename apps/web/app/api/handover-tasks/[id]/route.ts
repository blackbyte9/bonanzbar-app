import { NextResponse } from "next/server";
import { hasRole } from "@bonanzbar/shared";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const taskUpdateSchema = z.object({
  text: z.string().trim().min(2).max(2_000).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  priority: z.enum(["NORMAL", "URGENT"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
}).refine((data) => Object.keys(data).length > 0, "Mindestens eine Aufgabenänderung muss angegeben werden.");

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "tasks:manage");
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const input = taskUpdateSchema.parse(await requestJson(request));
    const existing = await prisma.handoverTask.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Aufgabe nicht gefunden." }, { status: 404 });
    if (input.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assigneeId },
        select: { active: true, roles: true },
      });
      if (!assignee?.active || !hasRole(assignee.roles, "MANAGER")) {
        return NextResponse.json({ error: "Aufgaben können nur aktiven Barleitungs-Konten zugewiesen werden." }, { status: 400 });
      }
    }
    const task = await prisma.handoverTask.update({ where: { id }, data: input, include: taskInclude });
    return NextResponse.json(task);
  } catch (error) {
    return jsonError(error);
  }
}
