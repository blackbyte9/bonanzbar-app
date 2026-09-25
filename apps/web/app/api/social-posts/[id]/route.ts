import { NextResponse } from "next/server";
import { hasRole } from "@bonanzbar/shared";
import { z } from "zod";
import { authenticate } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const approveSchema = z.object({ approved: z.literal(true) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  if (!hasRole(user.roles, "ADMIN")) {
    return NextResponse.json({ error: "Nur die Administration darf Gastbeiträge freigeben." }, { status: 403 });
  }
  try {
    approveSchema.parse(await requestJson(request));
    const { id } = await context.params;
    const post = await prisma.socialPost.findUnique({ where: { id }, select: { id: true, approvedAt: true } });
    if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
    if (post.approvedAt) return NextResponse.json(post);
    const approved = await prisma.socialPost.update({
      where: { id },
      data: { approvedAt: new Date(), approvedById: user.id },
      select: { id: true, approvedAt: true },
    });
    return NextResponse.json(approved);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  try {
    const { id } = await context.params;
    const post = await prisma.socialPost.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
    if (post.authorId !== user.id && !hasRole(user.roles, "ADMIN")) {
      return NextResponse.json({ error: "Du darfst diesen Beitrag nicht löschen." }, { status: 403 });
    }
    await prisma.socialPost.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
