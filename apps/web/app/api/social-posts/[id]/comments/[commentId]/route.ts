import { NextResponse } from "next/server";
import { hasRole } from "@bonanzbar/shared";
import { authenticate } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; commentId: string }> }) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  try {
    const { id: postId, commentId } = await context.params;
    const comment = await prisma.socialComment.findFirst({
      where: { id: commentId, postId },
      select: { authorId: true },
    });
    if (!comment) return NextResponse.json({ error: "Kommentar nicht gefunden." }, { status: 404 });
    if (comment.authorId !== user.id && !hasRole(user.roles, "ADMIN")) {
      return NextResponse.json({ error: "Du darfst diesen Kommentar nicht löschen." }, { status: 403 });
    }
    await prisma.socialComment.delete({ where: { id: commentId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
