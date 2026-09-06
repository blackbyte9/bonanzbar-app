import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoAuthEnabled, localDemoTokens } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";

const inputSchema = z.object({ role: z.enum(["ADMIN", "MANAGER", "USER"]) });

export async function POST(request: Request) {
  if (!isDemoAuthEnabled()) return NextResponse.json({ error: "Die Demo-Anmeldung ist deaktiviert." }, { status: 404 });
  try {
    const { role } = inputSchema.parse(await requestJson(request));
    return NextResponse.json({ token: localDemoTokens[role], role });
  } catch (error) {
    return jsonError(error);
  }
}
