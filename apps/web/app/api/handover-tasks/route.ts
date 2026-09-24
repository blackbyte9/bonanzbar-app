import { NextResponse } from "next/server";
import { hasRole } from "@bonanzbar/shared";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const taskSchema = z.object({
  text: z.string().trim().min(2).max(2_000),
  assigneeId: z.string().cuid().nullable().optional(),
  priority: z.enum(["NORMAL", "URGENT"]).default("NORMAL"),
});

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
};

export async function GET(request: Request) {
  const user = await requirePermission(request, "tasks:manage");
  if (user instanceof Response) return user;
  try {
    const tasks = await prisma.handoverTask.findMany({
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: taskInclude,
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await requirePermission(request, "tasks:manage");
  if (user instanceof Response) return user;
  try {
    const input = taskSchema.parse(await requestJson(request));
    if (input.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assigneeId },
        select: { active: true, roles: true },
      });
      if (!assignee?.active || !hasRole(assignee.roles, "MANAGER")) {
        return NextResponse.json({ error: "Aufgaben können nur aktiven Barleitungs-Konten zugewiesen werden." }, { status: 400 });
      }
    }
    const task = await prisma.handoverTask.create({
      data: { ...input, assigneeId: input.assigneeId ?? null, createdBy: user.id },
      include: taskInclude,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
