import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const countSchema = z.object({
  label: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({
    itemId: z.string().cuid(),
    quantity: z.coerce.number().int().min(0).max(100000),
  })).min(1).superRefine((lines, context) => {
    if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
      context.addIssue({ code: "custom", message: "Each inventory item may appear only once." });
    }
  }),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "counts:manage");
  if (user instanceof Response) return user;
  try {
    const input = countSchema.parse(await requestJson(request));
    const count = await prisma.stockCount.create({
      data: {
        label: input.label,
        notes: input.notes || null,
        createdBy: user.id,
        status: "FINALIZED",
        lines: { create: input.lines },
      },
      include: { lines: true },
    });
    return NextResponse.json(count, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
