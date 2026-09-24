import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [events, recaps] = await Promise.all([
    prisma.barEvent.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        bandInfo: true,
        bandHomepageUrl: true,
        bandImageUrls: true,
        ticketUrl: true,
        youtubeUrl: true,
        startsAt: true,
        endsAt: true,
      },
    }),
    prisma.eventRecap.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        eventId: true,
        title: true,
        body: true,
        imageUrls: true,
        publishedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ events, recaps });
}
