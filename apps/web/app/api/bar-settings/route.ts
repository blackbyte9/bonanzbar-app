import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({
  isOfficiallyOpen: z.boolean().optional(),
  dailySpecialTitle: z.string().trim().min(2).max(120).nullable().optional(),
  dailySpecialDescription: z.string().trim().max(1000).nullable().optional(),
  dailySpecialPriceCents: z.coerce.number().int().min(0).max(100000000).nullable().optional(),
  dailySpecialDate: z.string().datetime().nullable().optional(),
  dailySpecialActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, "Mindestens eine Einstellung muss angegeben werden.");

export async function PATCH(request: Request) {
  const user = await requirePermission(request, "inventory:write");
  if (user instanceof Response) return user;
  try {
    const input = settingsSchema.parse(await requestJson(request));
    const existing = await prisma.barSettings.findUnique({ where: { id: "default" } });
    const dailySpecialActive = input.dailySpecialActive ?? existing?.dailySpecialActive ?? false;
    const dailySpecialTitle = input.dailySpecialTitle !== undefined ? input.dailySpecialTitle : existing?.dailySpecialTitle ?? null;
    const dailySpecialPriceCents =
      input.dailySpecialPriceCents !== undefined ? input.dailySpecialPriceCents : existing?.dailySpecialPriceCents ?? null;
    const dailySpecialDate =
      input.dailySpecialDate !== undefined
        ? input.dailySpecialDate === null
          ? null
          : new Date(input.dailySpecialDate)
        : existing?.dailySpecialDate ?? null;
    if (dailySpecialActive && (!dailySpecialTitle || dailySpecialPriceCents === null || !dailySpecialDate)) {
      return NextResponse.json({ error: "Ein aktives Tagesangebot benötigt Titel, Preis und Datum." }, { status: 400 });
    }
    const update = {
      ...input,
      ...(input.dailySpecialDate !== undefined ? { dailySpecialDate } : {}),
      updatedBy: user.id,
    };
    const settings = await prisma.barSettings.upsert({
      where: { id: "default" },
      update,
      create: {
        id: "default",
        isOfficiallyOpen: input.isOfficiallyOpen ?? false,
        dailySpecialTitle: input.dailySpecialTitle ?? null,
        dailySpecialDescription: input.dailySpecialDescription ?? null,
        dailySpecialPriceCents: input.dailySpecialPriceCents ?? null,
        dailySpecialDate,
        dailySpecialActive: input.dailySpecialActive ?? false,
        updatedBy: user.id,
      },
    });
    return NextResponse.json(settings);
  } catch (error) {
    return jsonError(error);
  }
}
