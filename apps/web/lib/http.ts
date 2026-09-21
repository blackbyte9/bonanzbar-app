import { NextResponse } from "next/server";
import { ZodError } from "zod";

function isPrismaInitializationError(error: unknown): error is Error {
  return error instanceof Error && error.name === "PrismaClientInitializationError";
}

export function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Ungültige Eingabedaten.", details: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error(error);
  if (isPrismaInitializationError(error) && process.env.NODE_ENV !== "production") {
    return NextResponse.json(
      { error: "Die lokale Datenbankverbindung ist ungültig. Setze DATABASE_URL in apps/web/.env.local auf die PostgreSQL-Verbindungs-URL des Neon-Development-Branches." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "Die Anfrage konnte nicht verarbeitet werden." }, { status: 500 });
}

export async function requestJson(request: Request): Promise<unknown> {
  return request.json();
}
