import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const allocationSchema = z.object({
  title: z.string().trim().min(1).max(300),
  totalCents: z.coerce.number().int().min(1).max(100_000_000),
  recipientIds: z.array(z.string().cuid()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Mitglieder dürfen nur einmal ausgewählt werden."),
});

export async function POST(request: Request) {
  const user = await requirePermission(request, "bills:manage");
  if (user instanceof Response) return user;
  try {
    const input = allocationSchema.parse(await requestJson(request));
    const recipients = await prisma.user.findMany({
      where: { active: true, id: { in: input.recipientIds } },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    if (recipients.length !== input.recipientIds.length) {
      return NextResponse.json({ error: "Für eine Umlage müssen ausschließlich aktive Mitglieder ausgewählt werden." }, { status: 400 });
    }

    const baseShare = Math.floor(input.totalCents / recipients.length);
    const remainingCents = input.totalCents % recipients.length;
    const shares = recipients.map((recipient, index) => ({
      recipientId: recipient.id,
      amountCents: baseShare + (index < remainingCents ? 1 : 0),
    }));
    const allocation = await prisma.costAllocation.create({
      data: {
        title: input.title,
        totalCents: input.totalCents,
        createdBy: user.id,
        bills: {
          create: shares
            .filter((share) => share.amountCents > 0)
            .map((share) => ({
              recipientId: share.recipientId,
              totalCents: share.amountCents,
              lines: {
                create: {
                  description: `Umlage: ${input.title}`,
                  quantity: 1,
                  unitCents: share.amountCents,
                },
              },
            })),
        },
      },
      include: {
        bills: {
          include: { recipient: { select: { id: true, name: true } } },
          orderBy: { recipient: { name: "asc" } },
        },
      },
    });
    return NextResponse.json(allocation, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
