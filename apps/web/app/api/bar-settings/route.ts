import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({ isOfficiallyOpen: z.boolean() });

export async function PATCH(request: Request) {
  const user = await requirePermission(request, "inventory:write");
  if (user instanceof Response) return user;
  try {
    const { isOfficiallyOpen } = settingsSchema.parse(await requestJson(request));
    const settings = await prisma.barSettings.upsert({
      where: { id: "default" },
      update: { isOfficiallyOpen, updatedBy: user.id },
      create: { id: "default", isOfficiallyOpen, updatedBy: user.id },
    });
    return NextResponse.json(settings);
  } catch (error) {
    return jsonError(error);
  }
}
