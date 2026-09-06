import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Ungültige Eingabedaten.", details: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Die Anfrage konnte nicht verarbeitet werden." }, { status: 500 });
}

export async function requestJson(request: Request): Promise<unknown> {
  return request.json();
}
