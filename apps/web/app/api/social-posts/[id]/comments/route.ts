import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const commentSchema = z.object({ body: z.string().trim().min(1).max(1_000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(request, "social:write");
  if (user instanceof Response) return user;
  try {
    const { id: postId } = await context.params;
    const input = commentSchema.parse(await requestJson(request));
    const post = await prisma.socialPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
    const comment = await prisma.socialComment.create({
      data: { postId, authorId: user.id, body: input.body },
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
