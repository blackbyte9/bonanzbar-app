"use client";

import { useEffect, useState } from "react";

type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  bandInfo: string | null;
  bandHomepageUrl: string | null;
  bandImageUrls: string[];
  ticketUrl: string | null;
  youtubeUrl: string | null;
  startsAt: string;
  endsAt: string | null;
};
type PublicRecap = {
  id: string;
  eventId: string;
  title: string;
  body: string;
  imageUrls: string[];
  publishedAt: string | null;
};

const date = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));

export function PublicProgram({ onSignIn }: { onSignIn: () => void }) {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [recaps, setRecaps] = useState<PublicRecap[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/public/events", { cache: "no-store" });
        const body = await response.json() as { events?: PublicEvent[]; recaps?: PublicRecap[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Programm konnte nicht geladen werden.");
        setEvents(body.events ?? []);
        setRecaps(body.recaps ?? []);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Programm konnte nicht geladen werden.");
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return <main className="public-program"><header className="public-header"><img className="brand-logo" src="/bonanzbar-logo.png" alt="Bonanzbar" /><button className="secondary" type="button" onClick={onSignIn}>Anmelden</button></header><section className="public-hero"><p className="eyebrow">LIVE MUSIK · OFFEN FÜR ALLE</p><h1>Dein nächster Abend.</h1><p>Programm, Bandinfos, Tickets und Konzertmomente aus der Bonanzbar.</p></section><section className="public-content"><h2>Veranstaltungen</h2>{error && <p className="notice">{error}</p>}{events.length === 0 && !error ? <p className="muted">Aktuell sind keine veröffentlichten Veranstaltungen geplant.</p> : <div className="public-events">{events.map((event) => { const recap = recaps.find((candidate) => candidate.eventId === event.id); return <article className="public-event" key={event.id}>{event.bandImageUrls[0] && <a href={event.bandImageUrls[0]} target="_blank" rel="noreferrer"><img src={event.bandImageUrls[0]} alt="" /></a>}<div><small>{date(event.startsAt)}</small><h3>{event.title}</h3>{event.location && <p className="muted">{event.location}</p>}{event.description && <p>{event.description}</p>}{event.bandInfo && <p>{event.bandInfo}</p>}<div className="public-links">{event.bandHomepageUrl && <a href={event.bandHomepageUrl} target="_blank" rel="noreferrer">Band-Homepage ↗</a>}{event.youtubeUrl && <a href={event.youtubeUrl} target="_blank" rel="noreferrer">Video ↗</a>}{event.ticketUrl && <a href={event.ticketUrl} target="_blank" rel="noreferrer">Tickets ↗</a>}</div>{recap && <details className="public-recap"><summary>Rückblick</summary><b>{recap.title}</b><p>{recap.body}</p>{recap.imageUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>Rückblicksbild ↗</a>)}</details>}</div></article>; })}</div>}</section></main>;
}
