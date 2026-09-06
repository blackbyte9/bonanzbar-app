import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const itemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(30),
  reorderLevel: z.coerce.number().int().min(0).max(100000),
  priceCents: z.coerce.number().int().min(0).max(100000000),
  helperPriceCents: z.coerce.number().int().min(0).max(100000000),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "inventory:write");
  if (user instanceof Response) return user;
  try {
    const item = await prisma.inventoryItem.create({ data: itemSchema.parse(await requestJson(request)) });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
