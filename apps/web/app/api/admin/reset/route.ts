import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const resetSchema = z.object({ confirmation: z.literal("reset") });

export async function POST(request: Request) {
  const user = await requirePermission(request, "users:manage");
  if (user instanceof Response) return user;
  try {
    resetSchema.parse(await requestJson(request));
    await prisma.$transaction([
      prisma.billLine.deleteMany(),
      prisma.bill.deleteMany(),
      prisma.costAllocation.deleteMany(),
      prisma.consumptionCorrection.deleteMany(),
      prisma.consumption.deleteMany(),
      prisma.stockCount.deleteMany(),
      prisma.shoppingList.deleteMany(),
      prisma.bulletinNote.deleteMany(),
      prisma.barEvent.deleteMany(),
      prisma.inventoryItem.deleteMany(),
      prisma.barSettings.deleteMany(),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
