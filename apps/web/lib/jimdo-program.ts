export const JIMDO_PROGRAM_URL = "https://bonanzbar.jimdofree.com/";

const MAXIMUM_PROGRAM_DOCUMENT_CHARACTERS = 1_500_000;

export type JimdoProgramEvent = {
  id: string;
  title: string;
  description: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  startsAt: string;
  sourceDateLabel: string;
};

export class JimdoProgramError extends Error {}

function decodeHtml(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(normalized.startsWith("#x") ? 2 : 1), normalized.startsWith("#x") ? 16 : 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    return namedEntities[normalized] ?? entity;
  });
}

function textLines(markup: string): string[] {
  const text = decodeHtml(markup
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|h[1-6]|li|p)>/gi, "\n")
    .replace(/<[^>]*>/g, ""));
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function httpUrl(value: string, httpsOnly = false): string | null {
  try {
    const url = new URL(decodeHtml(value));
    if (url.protocol === "https:" || (!httpsOnly && url.protocol === "http:")) return url.toString();
  } catch {
    return null;
  }
  return null;
}

function ticketUrl(markup: string): string | null {
  for (const match of markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (textLines(match[2]).join(" ").toLocaleUpperCase("de-DE") !== "TICKET") continue;
    const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(match[1])?.[2];
    if (!href) continue;
    const url = httpUrl(href);
    if (url) return url;
  }
  return null;
}

function imageUrl(markup: string): string | null {
  const src = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i.exec(markup)?.[2];
  return src ? httpUrl(src, true) : null;
}

function berlinDateParts(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function startOfProgramDate(day: number, month: number, now: Date): string {
  const berlin = berlinDateParts(now);
  let year = berlin.year;
  if (month > berlin.month + 6) year -= 1;
  if (month < berlin.month - 6) year += 1;
  return new Date(Date.UTC(year, month - 1, day, 12)).toISOString();
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "termin";
}

function createProgramEvent({ day, month, time, title, description, ticket, image, index, now }: {
  day: number;
  month: number;
  time?: string;
  title: string;
  description: string | null;
  ticket: string | null;
  image?: string | null;
  index: number;
  now: Date;
}): JimdoProgramEvent {
  const startsAt = startOfProgramDate(day, month, now);
  const sourceDateLabel = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${time ? ` · ${time} Uhr` : ""}`;
  return {
    id: `jimdo-${startsAt.slice(0, 10)}-${index}-${slug(title)}`,
    title: title.slice(0, 120),
    description: description?.slice(0, 2_000) ?? null,
    ticketUrl: ticket,
    imageUrl: image ?? null,
    startsAt,
    sourceDateLabel,
  };
}

function parseNextShow(html: string, now: Date): JimdoProgramEvent | null {
  const header = /<h3\b[^>]*>\s*NEXT\s+SHOW\s*-\s*(\d{1,2})\.(\d{1,2})\.?\s*\|\s*(\d{1,2})[.:](\d{2})\s*UHR\s*<\/h3>/i.exec(html);
  const comingUp = /<h3\b[^>]*>\s*COMING\s+UP\s*<\/h3>/i.exec(html);
  if (!header || !comingUp || header.index === undefined || comingUp.index === undefined || comingUp.index <= header.index) return null;

  const content = html.slice(header.index + header[0].length, comingUp.index);
  const [title, ...description] = textLines(content);
  if (!title) return null;
  return createProgramEvent({
    day: Number(header[1]),
    month: Number(header[2]),
    time: `${header[3].padStart(2, "0")}:${header[4]}`,
    title,
    description: description.length > 0 ? description.join(" · ") : null,
    ticket: ticketUrl(content),
    image: imageUrl(content),
    index: 0,
    now,
  });
}

export function parseJimdoProgram(html: string, now = new Date()): JimdoProgramEvent[] {
  const comingUp = /<h3\b[^>]*>\s*COMING\s+UP\s*<\/h3>/i.exec(html);
  const highlights = /<h2\b[^>]*>\s*HIGHLIGHTS\s*<\/h2>/i.exec(html);
  if (!comingUp || !highlights || comingUp.index === undefined || highlights.index === undefined || highlights.index <= comingUp.index) {
    throw new JimdoProgramError("Der Programmabschnitt der Bonanzbar-Homepage wurde nicht gefunden.");
  }

  const upcomingMarkup = html.slice(comingUp.index + comingUp[0].length, highlights.index);
  const nextShow = parseNextShow(html, now);
  const events = nextShow ? [nextShow] : [];
  const modules = upcomingMarkup.matchAll(/<div\b[^>]*class="[^"]*\bj-text\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);

  for (const module of modules) {
    const [firstLine, ...descriptionLines] = textLines(module[1]);
    const match = /^(\d{1,2})\.(\d{1,2})\.\s*(.+)$/u.exec(firstLine ?? "");
    if (!match) continue;
    const title = match[3].replace(/\s*[-–]?\s*TICKET\b\.?\s*$/iu, "").trim();
    if (!title) continue;
    const event = createProgramEvent({
      day: Number(match[1]),
      month: Number(match[2]),
      title,
      description: descriptionLines.length > 0 ? descriptionLines.join(" · ") : null,
      ticket: ticketUrl(module[1]),
      index: events.length,
      now,
    });
    if (!events.some((candidate) => candidate.title === event.title && candidate.startsAt === event.startsAt)) events.push(event);
  }

  if (events.length === 0) throw new JimdoProgramError("Die Bonanzbar-Homepage enthält keine lesbaren Programmpunkte.");
  return events;
}

export async function getJimdoProgram(): Promise<JimdoProgramEvent[]> {
  let response: Response;
  try {
    response = await fetch(JIMDO_PROGRAM_URL, {
      headers: { "User-Agent": "Bonanzbar-App-Programmsynchronisierung/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new JimdoProgramError(`Die Bonanzbar-Homepage konnte nicht abgerufen werden: ${error instanceof Error ? error.message : "unbekannter Netzwerkfehler"}`);
  }
  if (!response.ok) throw new JimdoProgramError(`Die Bonanzbar-Homepage antwortete mit HTTP ${response.status}.`);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "bonanzbar.jimdofree.com") {
    throw new JimdoProgramError("Die Bonanzbar-Homepage wurde auf ein unerwartetes Ziel weitergeleitet.");
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAXIMUM_PROGRAM_DOCUMENT_CHARACTERS) {
    throw new JimdoProgramError("Die Antwort der Bonanzbar-Homepage ist zu groß.");
  }
  const html = await response.text();
  if (html.length > MAXIMUM_PROGRAM_DOCUMENT_CHARACTERS) throw new JimdoProgramError("Die Antwort der Bonanzbar-Homepage ist zu groß.");
  return parseJimdoProgram(html);
}
