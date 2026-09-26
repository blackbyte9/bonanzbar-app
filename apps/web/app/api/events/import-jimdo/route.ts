import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getJimdoProgram, JIMDO_PROGRAM_URL, JimdoProgramError } from "@/lib/jimdo-program";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  if (!user.roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Nur die Administration darf Termine von der Homepage importieren." }, { status: 403 });
  }

  try {
    const program = await getJimdoProgram();
    const importedAt = new Date();
    const created = await prisma.barEvent.createMany({
      data: program.map((event) => ({
        title: event.title,
        description: event.description,
        location: "Bonanzbar",
        bandImageUrls: event.imageUrl ? [event.imageUrl] : [],
        ticketUrl: event.ticketUrl,
        startsAt: new Date(event.startsAt),
        status: "DRAFT",
        createdBy: user.id,
        sourceUrl: JIMDO_PROGRAM_URL,
        sourceEventKey: event.id,
        sourceImportedAt: importedAt,
      })),
      skipDuplicates: true,
    });
    return NextResponse.json({
      created: created.count,
      existing: program.length - created.count,
      sourceUrl: JIMDO_PROGRAM_URL,
    });
  } catch (error) {
    if (error instanceof JimdoProgramError) {
      return NextResponse.json({ error: "Das Programm der Bonanzbar-Homepage konnte nicht importiert werden. Bitte versuche es später erneut." }, { status: 503 });
    }
    return jsonError(error);
  }
}
