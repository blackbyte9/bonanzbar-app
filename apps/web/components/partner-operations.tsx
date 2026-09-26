"use client";

import { formatCurrency } from "@bonanzbar/shared";
import { FormEvent, useMemo, useState } from "react";

type Request = (path: string, init?: RequestInit) => Promise<unknown>;
type Message = (message: string) => void;
type EventOption = { id: string; title: string; startsAt: string };
type DailySpecialSettings = {
  dailySpecialTitle?: string | null;
  dailySpecialDescription?: string | null;
  dailySpecialPriceCents?: number | null;
  dailySpecialDate?: string | null;
  dailySpecialActive?: boolean;
};
type EventRecap = {
  id: string;
  title: string;
  body: string;
  imageUrls: string[];
  published: boolean;
  event: EventOption;
};
type SocialPost = {
  id: string;
  body: string;
  imageUrl: string | null;
  approvedAt: string | null;
  createdAt: string;
  author: { id: string; name: string };
  comments: { id: string; body: string; createdAt: string; author: { id: string; name: string } }[];
};
type HandoverTask = {
  id: string;
  text: string;
  priority: "NORMAL" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  assignee: { id: string; name: string } | null;
  creator: { id: string; name: string };
};
type Assignee = { id: string; name: string; roles?: string[] };
type EventLedger = {
  id: string;
  closed: boolean;
  event: EventOption;
  entries: { id: string; label: string; amountCents: number; kind: "INCOME" | "EXPENSE"; occurredAt: string }[];
};

const date = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const dateInput = (value: string | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : "";
const lines = (value: FormDataEntryValue | null) => String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export function DailySpecialEditor({ settings, request, setMessage, onUpdated }: {
  settings: DailySpecialSettings;
  request: Request;
  setMessage: Message;
  onUpdated: () => Promise<void>;
}) {
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/bar-settings", {
        method: "PATCH",
        body: JSON.stringify({
          dailySpecialTitle: String(form.get("title") ?? "").trim() || null,
          dailySpecialDescription: String(form.get("description") ?? "").trim() || null,
          dailySpecialPriceCents: Math.round(Number(form.get("price") ?? 0) * 100) || null,
          dailySpecialDate: form.get("date") ? new Date(`${String(form.get("date"))}T12:00:00.000Z`).toISOString() : null,
          dailySpecialActive: form.get("active") === "on",
        }),
      });
      setMessage("Tagesangebot gespeichert.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tagesangebot konnte nicht gespeichert werden.");
    }
  };

  return <section className="panel"><h2>Tagesangebot für Gäste</h2><p className="muted">Aktive Angebote erscheinen nur am ausgewählten Tag in der Gästeansicht.</p><form onSubmit={(event) => void save(event)}><label>Titel<input name="title" defaultValue={settings.dailySpecialTitle ?? ""} /></label><label>Beschreibung<textarea name="description" rows={3} defaultValue={settings.dailySpecialDescription ?? ""} /></label><div className="approval-fields"><label>Preis (EUR)<input name="price" type="number" min="0" step="0.01" defaultValue={settings.dailySpecialPriceCents ? (settings.dailySpecialPriceCents / 100).toFixed(2) : ""} /></label><label>Datum<input name="date" type="date" defaultValue={dateInput(settings.dailySpecialDate)} /></label></div><label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={settings.dailySpecialActive} />Tagesangebot aktiv schalten</label><button className="primary">Tagesangebot speichern</button></form></section>;
}

export function EventRecapAdministration({ events, recaps, request, setMessage, onUpdated }: {
  events: EventOption[];
  recaps: EventRecap[];
  request: Request;
  setMessage: Message;
  onUpdated: () => Promise<void>;
}) {
  const completedEvents = events.filter((event) => new Date(event.startsAt) < new Date());
  const [selectedEventId, setSelectedEventId] = useState(completedEvents[0]?.id ?? "");
  const selectedRecap = recaps.find((recap) => recap.event.id === selectedEventId);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/event-recaps", {
        method: "POST",
        body: JSON.stringify({
          eventId: String(form.get("eventId")),
          title: String(form.get("title") ?? ""),
          body: String(form.get("body") ?? ""),
          imageUrls: lines(form.get("imageUrls")),
          published: form.get("published") === "on",
          photoConsent: form.get("photoConsent") === "on",
        }),
      });
      setMessage("Rückblick gespeichert.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rückblick konnte nicht gespeichert werden.");
    }
  };
  const remove = async (id: string) => {
    try {
      await request(`/api/event-recaps/${id}`, { method: "DELETE" });
      setMessage("Rückblick gelöscht.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rückblick konnte nicht gelöscht werden.");
    }
  };

  return <section className="content two-column"><section className="panel"><h1>Konzertrückblick</h1>{completedEvents.length === 0 ? <p className="muted">Nach der ersten abgeschlossenen Veranstaltung können hier Rückblicke veröffentlicht werden.</p> : <form onSubmit={(event) => void save(event)}><label>Veranstaltung<select name="eventId" value={selectedEventId} onChange={(event) => setSelectedEventId(event.currentTarget.value)}>{completedEvents.map((event) => <option value={event.id} key={event.id}>{event.title} · {date(event.startsAt)}</option>)}</select></label><label>Titel<input name="title" defaultValue={selectedRecap?.title ?? ""} key={`title-${selectedEventId}`} /></label><label>Text<textarea name="body" rows={6} defaultValue={selectedRecap?.body ?? ""} key={`body-${selectedEventId}`} /></label><label>Bild-URLs (maximal 6, eine URL je Zeile)<textarea name="imageUrls" rows={4} defaultValue={selectedRecap?.imageUrls.join("\n") ?? ""} key={`images-${selectedEventId}`} /></label><label className="checkbox-label"><input name="published" type="checkbox" defaultChecked={selectedRecap?.published} key={`published-${selectedEventId}`} />Öffentlich veröffentlichen</label><label className="checkbox-label"><input name="photoConsent" type="checkbox" />Fotoeinwilligung für veröffentlichte Bilder liegt vor</label><button className="primary">Rückblick speichern</button></form>}</section><section className="panel"><h2>Gespeicherte Rückblicke</h2>{recaps.length === 0 ? <p className="muted">Noch keine Rückblicke angelegt.</p> : <div className="recap-list">{recaps.map((recap) => <article className="recap-card" key={recap.id}><span><b>{recap.title}</b><small>{recap.event.title} · {recap.published ? "veröffentlicht" : "Entwurf"}</small></span><p>{recap.body}</p><button type="button" className="danger-button compact-button" onClick={() => void remove(recap.id)}>Löschen</button></article>)}</div>}</section></section>;
}

export function SocialWall({ posts, currentUserId, canSubmit, canComment, canModerate, isGuest, request, setMessage, onUpdated }: {
  posts: SocialPost[];
  currentUserId: string;
  canSubmit: boolean;
  canComment: boolean;
  canModerate: boolean;
  isGuest: boolean;
  request: Request;
  setMessage: Message;
  onUpdated: () => Promise<void>;
}) {
  const createPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/social-posts", { method: "POST", body: JSON.stringify({ body: form.get("body"), imageUrl: String(form.get("imageUrl") ?? "").trim() || null }) });
      event.currentTarget.reset();
      setMessage(isGuest ? "Beitrag zur Freigabe eingereicht." : "Beitrag veröffentlicht.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Beitrag konnte nicht veröffentlicht werden.");
    }
  };
  const comment = async (event: FormEvent<HTMLFormElement>, postId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request(`/api/social-posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ body: form.get("body") }) });
      event.currentTarget.reset();
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kommentar konnte nicht veröffentlicht werden.");
    }
  };
  const remove = async (path: string) => {
    try {
      await request(path, { method: "DELETE" });
      setMessage("Eintrag gelöscht.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Eintrag konnte nicht gelöscht werden.");
    }
  };
  const approve = async (postId: string) => {
    try {
      await request(`/api/social-posts/${postId}`, { method: "PATCH", body: JSON.stringify({ approved: true }) });
      setMessage("Gastbeitrag freigegeben.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gastbeitrag konnte nicht freigegeben werden.");
    }
  };

  return <section className="content two-column"><section className="panel social-compose"><h1>Social Wall</h1>{canSubmit ? <form onSubmit={(event) => void createPost(event)}><label>Dein Beitrag<textarea name="body" rows={5} required /></label><label>Bild-URL (optional)<input name="imageUrl" type="url" placeholder="https://…" /></label>{isGuest && <p className="muted">Gastbeiträge werden erst nach Freigabe durch die Administration für andere sichtbar.</p>}<button className="primary">{isGuest ? "Zur Freigabe einreichen" : "Beitrag veröffentlichen"}</button></form> : <p className="muted">Für diese Rolle sind keine Beiträge möglich.</p>}</section><section className="panel"><h2>Aus der Crew</h2>{posts.length === 0 ? <p className="muted">Noch keine Beiträge.</p> : <div className="social-posts">{posts.map((post) => <article className="social-post" key={post.id}><header><span><b>{post.author.name}</b><small>{dateTime(post.createdAt)}</small>{!post.approvedAt && <span className="pill">Freigabe ausstehend</span>}</span><span className="social-post-actions">{!post.approvedAt && canModerate && <button type="button" className="secondary compact-button" onClick={() => void approve(post.id)}>Freigeben</button>}{(canModerate || post.author.id === currentUserId) && <button type="button" className="danger-button compact-button" onClick={() => void remove(`/api/social-posts/${post.id}`)}>Löschen</button>}</span></header><p>{post.body}</p>{post.imageUrl && <a href={post.imageUrl} target="_blank" rel="noreferrer">Bild öffnen ↗</a>}<div className="social-comments">{post.comments.map((comment) => <div className="social-comment" key={comment.id}><span><b>{comment.author.name}</b><small>{dateTime(comment.createdAt)}</small><p>{comment.body}</p></span>{(canModerate || comment.author.id === currentUserId) && <button type="button" className="danger-button compact-button" onClick={() => void remove(`/api/social-posts/${post.id}/comments/${comment.id}`)}>Löschen</button>}</div>)}</div>{canComment && <form className="comment-form" onSubmit={(event) => void comment(event, post.id)}><label>Kommentieren<input name="body" required /></label><button className="secondary">Senden</button></form>}</article>)}</div>}</section></section>;
}

export function HandoverTaskBoard({ tasks, assignees, request, setMessage, onUpdated }: {
  tasks: HandoverTask[];
  assignees: Assignee[];
  request: Request;
  setMessage: Message;
  onUpdated: () => Promise<void>;
}) {
  const openAssignees = assignees.filter((user) => user.roles?.includes("MANAGER") || user.roles?.includes("ADMIN"));
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/handover-tasks", { method: "POST", body: JSON.stringify({ text: form.get("text"), assigneeId: String(form.get("assigneeId") ?? "") || null, priority: form.get("priority") }) });
      event.currentTarget.reset();
      setMessage("Aufgabe angelegt.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aufgabe konnte nicht angelegt werden.");
    }
  };
  const update = async (task: HandoverTask, status: HandoverTask["status"]) => {
    try {
      await request(`/api/handover-tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage("Aufgabenstatus gespeichert.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aufgabenstatus konnte nicht gespeichert werden.");
    }
  };

  return <section className="content two-column"><section className="panel"><h1>Übergabe & To-dos</h1><form onSubmit={(event) => void create(event)}><label>Aufgabe<textarea name="text" rows={4} required /></label><div className="approval-fields"><label>Verantwortlich<select name="assigneeId" defaultValue=""><option value="">Noch offen</option>{openAssignees.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label><label>Priorität<select name="priority" defaultValue="NORMAL"><option value="NORMAL">Normal</option><option value="URGENT">Dringend</option></select></label></div><button className="primary">Aufgabe anlegen</button></form></section><section className="panel"><h2>Offene Übergaben</h2>{tasks.length === 0 ? <p className="muted">Keine Aufgaben offen.</p> : <div className="task-list">{tasks.map((task) => <article className={`task-row ${task.priority === "URGENT" ? "urgent" : ""}`} key={task.id}><span><b>{task.text}</b><small>{task.assignee ? `Verantwortlich: ${task.assignee.name}` : "Noch nicht zugewiesen"} · von {task.creator.name}</small></span><label>Status<select value={task.status} onChange={(event) => void update(task, event.currentTarget.value as HandoverTask["status"])}><option value="OPEN">Offen</option><option value="IN_PROGRESS">In Arbeit</option><option value="DONE">Erledigt</option></select></label></article>)}</div>}</section></section>;
}

export function EventLedgerAdministration({ events, ledgers, request, setMessage, onUpdated }: {
  events: EventOption[];
  ledgers: EventLedger[];
  request: Request;
  setMessage: Message;
  onUpdated: () => Promise<void>;
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const ledger = ledgers.find((candidate) => candidate.event.id === eventId);
  const totals = useMemo(() => ({
    income: ledger?.entries.filter((entry) => entry.kind === "INCOME").reduce((total, entry) => total + entry.amountCents, 0) ?? 0,
    expenses: ledger?.entries.filter((entry) => entry.kind === "EXPENSE").reduce((total, entry) => total + entry.amountCents, 0) ?? 0,
  }), [ledger]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/event-ledgers", { method: "POST", body: JSON.stringify({ eventId: form.get("eventId"), label: form.get("label"), amountCents: Math.round(Number(form.get("amount") ?? 0) * 100), kind: form.get("kind"), occurredAt: new Date(`${String(form.get("date"))}T12:00:00.000Z`).toISOString() }) });
      event.currentTarget.reset();
      setMessage("Abrechnungszeile gespeichert.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Abrechnungszeile konnte nicht gespeichert werden.");
    }
  };
  const close = async () => {
    try {
      await request("/api/event-ledgers", { method: "PATCH", body: JSON.stringify({ eventId, closed: true }) });
      setMessage("Veranstaltungsabrechnung abgeschlossen.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Abrechnung konnte nicht abgeschlossen werden.");
    }
  };
  const remove = async (entryId: string) => {
    try {
      await request(`/api/event-ledgers/${entryId}`, { method: "DELETE" });
      setMessage("Abrechnungszeile gelöscht.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Abrechnungszeile konnte nicht gelöscht werden.");
    }
  };

  return <section className="content two-column"><section className="panel"><h1>Veranstaltungsabrechnung</h1><p className="muted">Einnahmen und Ausgaben werden bewusst manuell erfasst. Getränkekonsum fließt nicht automatisch ein.</p><form onSubmit={(event) => void create(event)}><label>Veranstaltung<select name="eventId" value={eventId} onChange={(event) => setEventId(event.currentTarget.value)}>{events.map((event) => <option value={event.id} key={event.id}>{event.title} · {date(event.startsAt)}</option>)}</select></label><label>Bezeichnung<input name="label" required disabled={ledger?.closed} /></label><div className="approval-fields"><label>Art<select name="kind" defaultValue="INCOME" disabled={ledger?.closed}><option value="INCOME">Einnahme</option><option value="EXPENSE">Ausgabe</option></select></label><label>Betrag (EUR)<input name="amount" type="number" min="0.01" step="0.01" required disabled={ledger?.closed} /></label><label>Datum<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required disabled={ledger?.closed} /></label></div><button className="primary" disabled={!eventId || ledger?.closed}>Zeile hinzufügen</button></form></section><section className="panel"><h2>{ledger?.event.title ?? "Abrechnung auswählen"}</h2>{ledger ? <><div className="ledger-totals"><span><small>Einnahmen</small><b>{formatCurrency(totals.income)}</b></span><span><small>Ausgaben</small><b>{formatCurrency(totals.expenses)}</b></span><span><small>Saldo</small><b>{formatCurrency(totals.income - totals.expenses)}</b></span></div>{ledger.entries.map((entry) => <div className="ledger-row" key={entry.id}><span><b>{entry.label}</b><small>{date(entry.occurredAt)} · {entry.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</small></span><span><b className={entry.kind === "EXPENSE" ? "danger-action" : ""}>{entry.kind === "EXPENSE" ? "−" : "+"}{formatCurrency(entry.amountCents)}</b>{!ledger.closed && <button type="button" className="danger-button compact-button" onClick={() => void remove(entry.id)}>Löschen</button>}</span></div>)}{ledger.closed ? <p className="muted">Diese Abrechnung ist abgeschlossen.</p> : <button type="button" className="secondary" onClick={() => void close()}>Abrechnung abschließen</button>}</> : <p className="muted">Lege die erste Zeile an, um eine Abrechnung zu öffnen.</p>}</section></section>;
}
