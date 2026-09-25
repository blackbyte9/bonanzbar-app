import { NextResponse } from "next/server";
import { hasRole } from "@bonanzbar/shared";
import { z } from "zod";
import { authenticate } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const httpUrl = z.string().trim().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Nur HTTP(S)-URLs sind erlaubt.");

const postSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
  imageUrl: httpUrl.nullable().optional(),
});

const postInclude = {
  author: { select: { id: true, name: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
};

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  try {
    const canModerate = hasRole(user.roles, "ADMIN");
    const posts = await prisma.socialPost.findMany({
      where: canModerate ? {} : { OR: [{ approvedAt: { not: null } }, { authorId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: postInclude,
    });
    return NextResponse.json(posts);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  try {
    const isGuestOnly = user.roles.length === 1 && user.roles[0] === "GUEST";
    if (!isGuestOnly && !hasRole(user.roles, "USER")) {
      return NextResponse.json({ error: "Deine Rolle ist für diese Aktion nicht berechtigt." }, { status: 403 });
    }
    const input = postSchema.parse(await requestJson(request));
    const post = await prisma.socialPost.create({
      data: {
        authorId: user.id,
        body: input.body,
        imageUrl: input.imageUrl || null,
        approvedAt: isGuestOnly ? null : new Date(),
        approvedById: isGuestOnly ? null : user.id,
      },
      include: postInclude,
    });
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
