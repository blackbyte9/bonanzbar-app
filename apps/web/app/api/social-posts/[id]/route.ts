import { NextResponse } from "next/server";
import { hasRole } from "@bonanzbar/shared";
import { authenticate } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

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
