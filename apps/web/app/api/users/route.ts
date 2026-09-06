import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).toLowerCase(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
  priceMode: z.enum(["PUBLIC", "HELPER", "DYNAMIC"]).default("DYNAMIC"),
});

export async function POST(request: Request) {
  const actor = await requirePermission(request, "users:manage");
  if (actor instanceof Response) return actor;
  try {
    const user = await prisma.user.create({ data: userSchema.parse(await requestJson(request)) });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
