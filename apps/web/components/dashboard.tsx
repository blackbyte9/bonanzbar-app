"use client";

import { formatCurrency, priceModeLabels, priceModes, roleLabels, roles as availableRoles, splitQuantityIntoPackages, type PriceMode, type Role } from "@bonanzbar/shared";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DailySpecialEditor, EventLedgerAdministration, EventRecapAdministration, HandoverTaskBoard, SocialWall } from "@/components/partner-operations";
import { PublicProgram } from "@/components/public-program";

type Item = { id: string; name: string; category: string; unit: string; packageSize: number; priceCents: number; helperPriceCents: number; guestPriceCents: number; trackInventory?: boolean; showInMenu?: boolean; effectivePriceCents: number; reorderLevel: number; onHand: number };
type Count = { id: string; label: string; countedAt: string; lines: { itemId: string; quantity: number }[] };
type CountValue = { packages: number; units: number };
type User = { id: string; name: string; email: string; roles?: Role[]; priceMode?: PriceMode; active?: boolean };
type ShoppingList = { id: string; title: string; status: string; items: { id: string; itemId: string | null; name: string; quantity: number; purchased: boolean }[] };
type PendingInventoryItem = {
  id: string;
  name: string;
  quantity: number;
  proposedCategory: string | null;
  proposedUnit: string | null;
  proposedPackageSize: number | null;
  proposedReorderLevel: number | null;
  proposedPriceCents: number | null;
  proposedHelperPriceCents: number | null;
  list: { title: string; status: string };
};
type Bill = { id: string; totalCents: number; status: string; issuedAt: string; recipient: { id?: string; name: string }; lines: { id: string; description: string; quantity: number; unitCents: number }[] };
type Consumption = { id: string; quantity: number; unitCents: number; occurredAt: string; voidedAt: string | null; item: { id: string; name: string } };
type CostAllocation = { id: string; title: string; totalCents: number; createdAt: string; bills: { id: string; totalCents: number; status: string; recipient: { id: string; name: string } }[] };
type ConsumptionCorrection = { id: string; note: string; status: "PENDING" | "RESOLVED"; voidedQuantity: number; response: string | null; createdAt: string; resolvedAt: string | null; openQuantity?: number; item: { id: string; name: string }; user?: { id: string; name: string; email: string } };
type EventApplicationStatus = "APPLIED" | "CONFIRMED" | "DECLINED";
type EventApplication = { id: string; dutyId?: string; userId?: string; status: EventApplicationStatus; note: string | null; createdAt?: string; user?: { id: string; name: string; email: string } };
type EventDuty = { id: string; label: string; slots: number; applications: EventApplication[] };
type BarEvent = { id: string; title: string; description: string | null; location: string | null; bandInfo: string | null; bandHomepageUrl: string | null; bandImageUrls: string[]; ticketUrl: string | null; youtubeUrl: string | null; startsAt: string; endsAt: string | null; status: "DRAFT" | "PUBLISHED" | "CANCELLED"; duties: EventDuty[] };
type BulletinNote = { id: string; title: string; body: string; pinned: boolean; createdAt: string; event: { id: string; title: string } | null };
type EventRecap = { id: string; title: string; body: string; imageUrls: string[]; published: boolean; event: { id: string; title: string; startsAt: string } };
type SocialPost = { id: string; body: string; imageUrl: string | null; approvedAt: string | null; createdAt: string; author: { id: string; name: string }; comments: { id: string; body: string; createdAt: string; author: { id: string; name: string } }[] };
type HandoverTask = { id: string; text: string; priority: "NORMAL" | "URGENT"; status: "OPEN" | "IN_PROGRESS" | "DONE"; assignee: { id: string; name: string } | null; creator: { id: string; name: string } };
type EventLedger = { id: string; closed: boolean; event: { id: string; title: string; startsAt: string }; entries: { id: string; label: string; amountCents: number; kind: "INCOME" | "EXPENSE"; occurredAt: string }[] };
type Bootstrap = {
  user: { id: string; name: string; email: string; roles: Role[] };
  inventory: Item[];
  latestCount: { id: string; label: string; countedAt: string } | null;
  users?: User[];
  billRecipients?: User[];
  pendingInventoryItems?: PendingInventoryItem[];
  counts?: Count[];
  shoppingLists?: ShoppingList[];
  bills?: Bill[];
  recentConsumptions?: Consumption[];
  consumptionSummary?: { totalQuantity: number };
  openBillTotalCents?: number;
  correctionCandidates?: Consumption[];
  allocations?: CostAllocation[];
  correctionRequests?: ConsumptionCorrection[];
  barSettings?: { isOfficiallyOpen: boolean; updatedAt: string; dailySpecialTitle?: string | null; dailySpecialDescription?: string | null; dailySpecialPriceCents?: number | null; dailySpecialDate?: string | null; dailySpecialActive?: boolean };
  events?: BarEvent[];
  notes?: BulletinNote[];
  eventRecaps?: EventRecap[];
  publishedRecaps?: EventRecap[];
  socialPosts?: SocialPost[];
  handoverTasks?: HandoverTask[];
  eventLedgers?: EventLedger[];
  dailySpecial?: { title: string; description: string | null; priceCents: number; date: string } | null;
};

const demoRoles: Role[] = ["ADMIN", "MANAGER", "USER", "GUEST"];
type AppDownloadLink = { label: string; detail: string; href: string };

function publicHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const appDownloadLinks: AppDownloadLink[] = [
  {
    label: "iPhone & iPad",
    detail: "Im App Store öffnen",
    href: publicHttpsUrl(process.env.NEXT_PUBLIC_IOS_APP_URL) ?? "",
  },
  {
    label: "Android",
    detail: "Bei Google Play öffnen",
    href: publicHttpsUrl(process.env.NEXT_PUBLIC_ANDROID_APP_URL) ?? "",
  },
].filter((link): link is AppDownloadLink => Boolean(link.href));

const date = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const dateTimeInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const applicationStatusLabels: Record<EventApplicationStatus, string> = { APPLIED: "Offen", CONFIRMED: "Bestätigt", DECLINED: "Abgelehnt" };
const countValueFor = (quantity: number, packageSize: number): CountValue => packageSize === 1
  ? { packages: 0, units: Math.max(0, Math.floor(quantity)) }
  : splitQuantityIntoPackages(quantity, packageSize);
const countValuesFor = (items: Item[]): Record<string, CountValue> => Object.fromEntries(items.map((item) => [item.id, countValueFor(item.onHand, item.packageSize)]));
const formatStockQuantity = (quantity: number, item: Pick<Item, "unit" | "packageSize">) => {
  if (item.packageSize === 1) return `${quantity} ${item.unit}`;
  const { packages, units } = splitQuantityIntoPackages(quantity, item.packageSize);
  return `${packages} Gebinde${units > 0 ? ` + ${units} ${item.unit}` : ""}`;
};
const itemModeLabel = (item: Pick<Item, "trackInventory" | "showInMenu">) => item.trackInventory !== false && item.showInMenu !== false
  ? "Inventar & Getränkekarte"
  : item.trackInventory !== false
    ? "Nur Inventar"
    : item.showInMenu !== false
      ? "Nur Getränkekarte"
      : "Ausgeblendet";
async function readApiResponse<T extends object>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Der lokale Server hat eine leere Antwort gesendet. Prüfe, ob die Web-App vollständig gestartet ist.");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("Der lokale Server hat keine gültige JSON-Antwort gesendet. Prüfe die Webserver-Konsole.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Die Serverantwort hat ein ungültiges Format.");
  }
  return body as T;
}

export function Dashboard() {
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [tab, setTab] = useState("overview");
  const [countValues, setCountValues] = useState<Record<string, CountValue>>({});
  const [shoppingSource, setShoppingSource] = useState<"inventory" | "new">("inventory");
  const [showSetup, setShowSetup] = useState(false);
  const [initialAdminSetupAvailable, setInitialAdminSetupAvailable] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState<boolean | null>(null);
  const [showPublicProgram, setShowPublicProgram] = useState(false);

  const request = async <T extends object = { error?: string }>(path: string, init?: RequestInit): Promise<T> => {
    const visibleRoleHeader = activeRole;
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(demoToken ? { "x-bonanzbar-token": demoToken } : {}), ...(visibleRoleHeader ? { "x-bonanzbar-visible-role": visibleRoleHeader } : {}), ...(init?.headers ?? {}) },
    });
    if (response.status === 204) return {} as T;
    const body = await readApiResponse<T & { error?: string }>(response);
    if (!response.ok) throw new Error(body.error ?? "Anfrage fehlgeschlagen.");
    return body;
  };
  const refresh = async () => {
    if (!sessionActive) return;
    setLoading(true);
    try {
      const result = await request<Bootstrap>("/api/bootstrap");
      setData(result);
      setCountValues(countValuesFor(result.inventory.filter((item) => item.trackInventory !== false)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (sessionActive) void refresh();
  }, [sessionActive, demoToken, activeRole]);
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const result = await request<Bootstrap>("/api/bootstrap");
        setData(result);
        setCountValues(countValuesFor(result.inventory.filter((item) => item.trackInventory !== false)));
        setSessionActive(true);
      } catch {
        // A missing or expired cookie is expected before a user signs in.
      }
    };
    void restoreSession();
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const checkAuthenticationOptions = async () => {
      try {
        const [demoResponse, setupResponse] = await Promise.all([
          fetch("/api/auth/demo"),
          fetch("/api/auth/setup"),
        ]);
        if (demoResponse.ok) {
          const demo = await readApiResponse<{ enabled?: boolean }>(demoResponse);
          setDemoEnabled(demo.enabled === true);
        } else {
          setDemoEnabled(false);
        }
        if (setupResponse.ok) {
          const setup = await readApiResponse<{ available?: boolean }>(setupResponse);
          setInitialAdminSetupAvailable(setup.available === true);
        }
      } catch {
        setDemoEnabled(false);
        setInitialAdminSetupAvailable(false);
      }
    };
    void checkAuthenticationOptions();
  }, []);

  const signInDemo = async (role: Role) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const body = await readApiResponse<{ token: string; role: Role; error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      setDemoToken(body.token);
      setActiveRole(null);
      setSessionActive(true);
      setMessage(`Als lokale Demo-Rolle „${roleLabels[role]}“ angemeldet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const body = await readApiResponse<{ user: { name: string }; error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? "Anmeldung fehlgeschlagen.");
      setDemoToken(null);
      setActiveRole(null);
      setSessionActive(true);
      setMessage(`Als „${body.user.name}“ angemeldet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };
  const setUpInitialAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupToken: form.get("setupToken"),
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const body = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? "Erstzugang konnte nicht eingerichtet werden.");
      setDemoToken(null);
      setActiveRole(null);
      setSessionActive(true);
      setShowSetup(false);
      setMessage("Administrationszugang wurde eingerichtet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erstzugang konnte nicht eingerichtet werden.");
    } finally {
      setLoading(false);
    }
  };
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setDemoToken(null);
    setData(null);
    setActiveRole(null);
    setSessionActive(false);
    setMessage("");
  };
  const submit = async (event: FormEvent<HTMLFormElement>, path: string, payload: (form: HTMLFormElement) => unknown) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request(path, { method: "POST", body: JSON.stringify(payload(form)) });
      form.reset();
      setMessage("Gespeichert.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  };
  const updateCountValue = (item: Item, update: Partial<CountValue>) => {
    setCountValues((values) => {
      const current = values[item.id] ?? { packages: 0, units: 0 };
      const next = { ...current, ...update };
      return { ...values, [item.id]: countValueFor(next.packages * item.packageSize + next.units, item.packageSize) };
    });
  };
  const trackedInventory = useMemo(() => data?.inventory.filter((item) => item.trackInventory !== false) ?? [], [data]);
  const menuItems = useMemo(() => data?.inventory.filter((item) => item.showInMenu !== false) ?? [], [data]);
  const lowStock = useMemo(() => trackedInventory.filter((item) => item.onHand <= item.reorderLevel), [trackedInventory]);
  const upcomingEvents = useMemo(() => data?.events?.filter((event) => event.status === "PUBLISHED" && new Date(event.startsAt) >= new Date()) ?? [], [data]);
  const openBills = useMemo(() => data?.bills?.filter((bill) => bill.status === "OPEN").length ?? 0, [data]);
  const pendingCorrections = useMemo(() => data?.correctionRequests?.filter((correction) => correction.status === "PENDING").length ?? 0, [data]);
  const openShoppingLists = useMemo(() => data?.shoppingLists?.filter((list) => list.items.some((item) => !item.purchased)) ?? [], [data]);
  if (showWelcome) {
    return <div className="welcome-screen"><img src="/skull.png" alt="Bonanzbar Totenkopf" /><h1>WELCOME<br /><small>IN DER BONANZBAR</small></h1></div>;
  }
  if (!sessionActive || !data) {
    if (showPublicProgram) return <PublicProgram onSignIn={() => setShowPublicProgram(false)} />;
    return (
      <main className="auth-shell">
        <section className="hero">
          <img className="hero-logo" src="/bonanzbar-logo.png" alt="Bonanzbar" />
          <p className="eyebrow">BONANZBAR / CREW-BEREICH</p>
          <h1>Willkommen,<br />Crew!</h1>
          <p>Alles Wichtige für Betrieb, Programm und die gemeinsame Bar an einem Ort.</p>
        </section>
        <section className="login-card">
          {demoEnabled === null ? <><span className="pill">Lokale Entwicklung</span><h2>Anmeldung wird vorbereitet</h2><p>Prüfe verfügbare Anmeldeoptionen …</p></> : demoEnabled ? <><span className="pill">Lokale Entwicklung</span><h2>Zur Bar</h2><p>Wähle eine vorbereitete Rolle, um ihre Berechtigungen auszuprobieren.</p><div className="role-grid">
            {demoRoles.map((role) => <button key={role} disabled={loading} onClick={() => void signInDemo(role)}>{roleLabels[role]}<small>{role === "ADMIN" ? "Inventar & Mitglieder" : role === "MANAGER" ? "Betrieb & Auswertungen" : "Meine Getränke"}</small></button>)}
          </div></> : showSetup && initialAdminSetupAvailable ? <><span className="pill">Ersteinrichtung</span><h2>Administration einrichten</h2><p>Verwende den einmaligen Einrichtungsschlüssel aus der sicheren Vercel-Variable.</p><form onSubmit={(event) => void setUpInitialAdmin(event)}><Field name="setupToken" label="Einrichtungsschlüssel" type="password" autoComplete="off" /><Field name="name" label="Name" autoComplete="name" /><Field name="email" label="E-Mail-Adresse" type="email" autoComplete="email" /><Field name="password" label="Passwort (mindestens 12 Zeichen)" type="password" autoComplete="new-password" /><button className="primary" disabled={loading}>Administrationszugang erstellen</button><button className="text-button" type="button" onClick={() => setShowSetup(false)}>Zur Anmeldung</button></form></> : <><span className="pill">Sicherer Zugang</span><h2>Anmelden</h2><p>Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.</p><form onSubmit={(event) => void signIn(event)}><Field name="email" label="E-Mail-Adresse" type="email" autoComplete="email" /><Field name="password" label="Passwort" type="password" autoComplete="current-password" /><button className="primary" disabled={loading}>Anmelden</button>{initialAdminSetupAvailable && <button className="text-button" type="button" onClick={() => setShowSetup(true)}>Erstzugang einrichten</button>}</form></>}
          {appDownloadLinks.length > 0 && <section className="app-downloads" aria-label="Bonanzbar-Apps herunterladen">
            <span className="app-downloads-label">Unterwegs dabei</span>
            <div className="app-download-links">
              {appDownloadLinks.map((link) => <a href={link.href} key={link.label} target="_blank" rel="noreferrer"><b>{link.label}</b><small>{link.detail}</small></a>)}
            </div>
          </section>}
          <button type="button" className="text-button public-program-button" onClick={() => setShowPublicProgram(true)}>Öffentliches Programm ansehen</button>
          {message && <Notice message={message} onDismiss={() => setMessage("")} />}
        </section>
      </main>
    );
  }

  const visibleRole = activeRole && data.user.roles.includes(activeRole) ? activeRole : data.user.roles[0] ?? "USER";
  const isAdmin = visibleRole === "ADMIN";
  const isManager = visibleRole === "MANAGER";
  const isMember = visibleRole === "USER";
  const isGuest = visibleRole === "GUEST";
  const canManageOps = isAdmin || isManager;
  const homeActions = isAdmin
    ? [
        { tab: "inventory", title: "Inventar", description: "Artikel & Freigaben", status: lowStock.length > 0 ? `${lowStock.length} nachbestellen` : "Bestand im Blick", tone: lowStock.length > 0 ? "alert" : undefined },
        { tab: "users", title: "Mitglieder", description: "Konten & Rollen", status: `${data.users?.filter((user) => user.active).length ?? 0} aktiv` },
        { tab: "pricing", title: "Preise", description: "Betriebsmodus & Regeln", status: data.barSettings?.isOfficiallyOpen ? "Offiziell geöffnet" : "Helferbetrieb" },
        { tab: "events", title: "Programm", description: "Veranstaltungen & Bandinfos", status: upcomingEvents.length > 0 ? `${upcomingEvents.length} geplant` : "Noch nichts geplant" },
        { tab: "recaps", title: "Rückblicke", description: "Konzerte veröffentlichen", status: `${data.eventRecaps?.length ?? 0} angelegt` },
        { tab: "ledgers", title: "Abrechnung", description: "Einnahmen & Ausgaben", status: `${data.eventLedgers?.length ?? 0} eröffnet` },
        { tab: "social", title: "Social Wall", description: "Beiträge der Crew", status: `${data.socialPosts?.length ?? 0} aktuell` },
        { tab: "reset", title: "Datenverwaltung", description: "Betriebsdaten zurücksetzen", status: "Nur Administration", tone: "danger" },
      ]
    : isManager
      ? [
          { tab: "events", title: "Veranstaltungen", description: "Programm & Dienste", status: upcomingEvents.length > 0 ? `${upcomingEvents.length} geplant` : "Noch nichts geplant" },
          { tab: "shopping", title: "Einkaufsliste", description: "Was fehlt noch?", status: openShoppingLists.length > 0 ? `${openShoppingLists.length} offen` : "Keine offenen Listen", tone: openShoppingLists.length > 0 ? "alert" : undefined },
          { tab: "count", title: "Bestand", description: "Zählen & speichern", status: data.latestCount ? date(data.latestCount.countedAt) : "Noch nicht gezählt" },
          { tab: "bills", title: "Rechnungen", description: "Abrechnen & verwalten", status: openBills > 0 ? `${openBills} offen` : "Keine offenen Rechnungen" },
          { tab: "allocations", title: "Umlagen", description: "Gemeinsame Kosten verteilen", status: "Auf aktive Mitglieder" },
          { tab: "corrections", title: "Korrekturen", description: "Einträge prüfen", status: pendingCorrections > 0 ? `${pendingCorrections} offen` : "Keine offenen Anfragen", tone: pendingCorrections > 0 ? "alert" : undefined },
          { tab: "reports", title: "Verkaufsbericht", description: "Zwischen Zählungen auswerten", status: "Absatz im Überblick" },
          { tab: "notes", title: "Notizen", description: "Infos für die Crew", status: `${data.notes?.length ?? 0} aktuell` },
          { tab: "tasks", title: "Übergabe", description: "To-dos & Verantwortung", status: `${data.handoverTasks?.filter((task) => task.status !== "DONE").length ?? 0} offen` },
          { tab: "social", title: "Social Wall", description: "Beiträge der Crew", status: `${data.socialPosts?.length ?? 0} aktuell` },
        ]
      : isMember
        ? [
          { tab: "consume", title: "Drinklist", description: "Deine Getränkestriche", status: "Getränk eintragen" },
          { tab: "events", title: "Veranstaltungen", description: "Programm & Dienste", status: upcomingEvents.length > 0 ? `${upcomingEvents.length} geplant` : "Noch nichts geplant" },
          { tab: "notes", title: "Crew-Notizen", description: "Aktuelle Infos", status: `${data.notes?.filter((note) => note.pinned).length ?? 0} angeheftet` },
          { tab: "social", title: "Social Wall", description: "Beiträge der Crew", status: `${data.socialPosts?.length ?? 0} aktuell` },
        ]
        : [
          { tab: "menu", title: "Getränkekarte", description: "Aktuelle Gastpreise", status: `${data.inventory.length} Getränke` },
          { tab: "events", title: "Programm", description: "Live-Musik & Tickets", status: upcomingEvents.length > 0 ? `${upcomingEvents.length} geplant` : "Noch nichts geplant" },
          { tab: "social", title: "Social Wall", description: "Aus der Bonanzbar", status: `${data.socialPosts?.length ?? 0} aktuell` },
        ];
  const homeIntro = isAdmin
    ? "Pflege die Basis für einen gut organisierten Barbetrieb."
    : isManager
      ? "Koordiniere alles Wichtige für den nächsten Barabend."
      : isMember
        ? "Halte deinen Konsum aktuell und bleib mit der Crew verbunden."
        : "Entdecke Programm, Tagesangebot und die aktuelle Getränkekarte.";
  const currentAction = homeActions.find((action) => action.tab === tab);
  const switchRole = (role: Role) => {
    setActiveRole(role);
    setTab("overview");
    setMessage("");
  };
  const openTab = (nextTab: string) => {
    setTab(nextTab);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><img className="brand-logo" src="/bonanzbar-logo.png" alt="Bonanzbar" /></div>
        <div className="header-actions">
          <div className="role-switcher" role="tablist" aria-label="Bereich auswählen">
            {data.user.roles.map((role) => <button key={role} type="button" role="tab" aria-selected={role === visibleRole} className={role === visibleRole ? "active" : ""} onClick={() => switchRole(role)}>{roleLabels[role]}</button>)}
          </div>
          <div className="identity"><span>{data.user.name}</span><button className="text-button" onClick={() => void signOut()}>Abmelden</button></div>
        </div>
      </header>
      {message && <Notice className="app-notice" message={message} onDismiss={() => setMessage("")} />}
      {tab !== "overview" && <div className="menu-context"><button type="button" className="text-button" onClick={() => openTab("overview")}>← Hauptmenü</button><span>{currentAction?.title}</span></div>}

      {tab === "overview" && <section className="content home-content">
        <div className="home-heading"><div><p className="eyebrow">BONANZBAR · {roleLabels[visibleRole].toUpperCase()}</p><h1>Was steht an?</h1><p>{homeIntro}</p></div><button className="secondary" onClick={() => void refresh()} disabled={loading}>{loading ? "Lädt..." : "Aktualisieren"}</button></div>
        <div className="action-menu" aria-label={`Hauptmenü ${roleLabels[visibleRole]}`}>
          {homeActions.map((action, index) => <button key={action.tab} type="button" className={`action-tile${action.tone ? ` ${action.tone}` : ""}`} onClick={() => openTab(action.tab)}>
            <span className="action-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="action-copy"><strong>{action.title}</strong><small>{action.description}</small></span>
            <span className="action-status">{action.status}</span>
          </button>)}
        </div>
        {!isMember && !isGuest && lowStock.length > 0 && <section className="panel alert"><h2>Nachbestellung im Blick</h2>{lowStock.map((item) => <p key={item.id}>{item.name}: noch <b>{formatStockQuantity(item.onHand, item)}</b>; nachbestellen ab {formatStockQuantity(item.reorderLevel, item)}.</p>)}</section>}
      </section>}

      {isAdmin && tab === "inventory" && <section className="content"><section className="two-column"><section className="panel"><h1>Inventarartikel hinzufügen</h1><form onSubmit={(event) => void submit(event, "/api/inventory", (form) => ({ name: value(form, "name"), category: value(form, "category"), unit: value(form, "unit"), packageSize: Number(value(form, "packageSize")), reorderLevel: Number(value(form, "reorderLevel")), priceCents: Math.round(Number(value(form, "publicPrice")) * 100), helperPriceCents: Math.round(Number(value(form, "helperPrice")) * 100), guestPriceCents: Math.round(Number(value(form, "guestPrice")) * 100), trackInventory: checked(form, "trackInventory"), showInMenu: checked(form, "showInMenu") }))}><Field name="name" label="Name" /><Field name="category" label="Kategorie" /><Field name="unit" label="Einheit" initial="Flasche" /><Field name="packageSize" label="Gebindegröße (Einheiten je Gebinde)" type="number" initial="1" min="1" /><Field name="reorderLevel" label="Meldebestand (Einheiten)" type="number" initial="0" min="0" /><Field name="publicPrice" label="Regulärer Preis (EUR)" type="number" step="0.01" initial="0" min="0" /><Field name="helperPrice" label="Helferpreis (EUR)" type="number" step="0.01" initial="0" min="0" /><Field name="guestPrice" label="Gastpreis (EUR)" type="number" step="0.01" initial="0" min="0" /><InventoryModeFields /><button className="primary">Artikel hinzufügen</button></form></section><EditableInventoryCatalog items={data.inventory} request={request} setMessage={setMessage} onUpdated={refresh} /></section><PendingInventoryApprovals items={data.pendingInventoryItems ?? []} request={request} setMessage={setMessage} onApproved={refresh} /></section>}
      {isAdmin && tab === "users" && <section className="content two-column"><section className="panel"><h1>Mitglied hinzufügen</h1><form onSubmit={(event) => void submit(event, "/api/users", (form) => ({ name: value(form, "name"), email: value(form, "email"), roles: new FormData(form).getAll("roles").map(String), priceMode: value(form, "priceMode"), password: value(form, "password") }))}><Field name="name" label="Name" /><Field name="email" label="E-Mail" type="email" autoComplete="email" /><Field name="password" label="Startpasswort (mindestens 12 Zeichen)" type="password" autoComplete="new-password" /><RoleSelection /><PriceModeSelect name="priceMode" /><button className="primary">Konto anlegen</button></form></section><EditableUserList users={data.users ?? []} currentUserId={data.user.id} request={request} setMessage={setMessage} onUpdated={refresh} /></section>}
      {isAdmin && tab === "pricing" && <><PricingAdministration settings={data.barSettings ?? { isOfficiallyOpen: false, updatedAt: "" }} users={data.users ?? []} request={request} setMessage={setMessage} onUpdated={refresh} /><DailySpecialEditor settings={data.barSettings ?? { isOfficiallyOpen: false, updatedAt: "" }} request={request} setMessage={setMessage} onUpdated={refresh} /></>}
      {isAdmin && tab === "recaps" && <EventRecapAdministration events={data.events ?? []} recaps={data.eventRecaps ?? []} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {isAdmin && tab === "ledgers" && <EventLedgerAdministration events={data.events ?? []} ledgers={data.eventLedgers ?? []} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {isAdmin && tab === "reset" && <ResetDataPanel request={request} setMessage={setMessage} onReset={refresh} />}

      {isManager && tab === "count" && <section className="content"><section className="panel"><h1>Bestandszählung abschließen</h1><p className="muted">Zähle volle Gebinde und einzelne Reste. Die App speichert daraus die Gesamtmenge in Einheiten als unveränderbare Grundlage für Auswertungen.</p><form onSubmit={(event) => void submit(event, "/api/counts", (form) => ({ label: value(form, "label"), notes: value(form, "notes"), lines: trackedInventory.map((item) => { const count = countValues[item.id] ?? { packages: 0, units: 0 }; return { itemId: item.id, quantity: count.packages * item.packageSize + count.units }; }) }))}><Field name="label" label="Name der Zählung" initial={`Zählung ${new Date().toLocaleDateString("de-DE")}`} /><label>Notizen<textarea name="notes" rows={2} /></label><div className="count-grid">{trackedInventory.map((item) => { const count = countValues[item.id] ?? { packages: 0, units: 0 }; return <div className="count-item" key={item.id}><b>{item.name}</b><small>{item.packageSize === 1 ? "Wird einzeln gezählt" : `${item.packageSize} ${item.unit} je Gebinde`}</small><div className="count-inputs">{item.packageSize > 1 && <label>Volle Gebinde<input type="number" min="0" value={count.packages} onChange={(event) => updateCountValue(item, { packages: Number(event.target.value) })} /></label>}<label>{item.packageSize > 1 ? `Einzelne ${item.unit}` : item.unit}<input type="number" min="0" max={item.packageSize > 1 ? item.packageSize - 1 : undefined} value={count.units} onChange={(event) => updateCountValue(item, { units: Number(event.target.value) })} /></label></div><small>Gesamt: {formatStockQuantity(count.packages * item.packageSize + count.units, item)}</small></div>; })}</div><button className="primary">Zählung abschließen</button></form></section></section>}
      {canManageOps && tab === "events" && <EventManagement events={data.events ?? []} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {isManager && tab === "notes" && <NotesBoard notes={data.notes ?? []} events={data.events ?? []} canManage request={request} setMessage={setMessage} onUpdated={refresh} />}
      {isManager && tab === "shopping" && <section className="content two-column"><section className="panel"><h1>Einkaufsliste erstellen</h1><form onSubmit={(event) => void submit(event, "/api/shopping-lists", (form) => { const itemId = value(form, "itemId"); const item = trackedInventory.find((candidate) => candidate.id === itemId); return { title: value(form, "title"), items: [shoppingSource === "inventory" ? { itemId, name: item?.name ?? "", quantity: Number(value(form, "quantity")) } : { name: value(form, "newItemName"), quantity: Number(value(form, "quantity")) }] }; })}><Field name="title" label="Name der Liste" initial="Neue Nachbestellung" /><fieldset className="shopping-source"><legend>Artikelquelle</legend><label><input type="radio" checked={shoppingSource === "inventory"} onChange={() => setShoppingSource("inventory")} />Aus Inventar auswählen</label><label><input type="radio" checked={shoppingSource === "new"} onChange={() => setShoppingSource("new")} />Neuen Artikel eingeben</label></fieldset>{shoppingSource === "inventory" ? <label>Inventarartikel<select name="itemId">{trackedInventory.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label> : <><Field name="newItemName" label="Neuer Artikel" /><p className="muted">Der Artikel erscheint erst nach Freigabe durch die Administration in der Inventur.</p></>}<Field name="quantity" label="Menge" type="number" initial="1" /><button className="primary">Liste erstellen</button></form></section><ShoppingLists lists={data.shoppingLists ?? []} request={request} setMessage={setMessage} onUpdated={refresh} /></section>}
      {isManager && tab === "bills" && <section className="content two-column"><section className="panel"><h1>Rechnung erstellen</h1><form onSubmit={(event) => void submit(event, "/api/bills", (form) => ({ recipientId: value(form, "recipientId"), dueAt: new Date(`${value(form, "dueDate")}T12:00:00.000Z`).toISOString(), lines: [{ itemId: value(form, "itemId"), quantity: Number(value(form, "quantity")) }] }))}><label>Mitglied<select name="recipientId">{(data.billRecipients ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>Artikel<select name="itemId">{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name} — regulär {formatCurrency(item.priceCents)}, Helfer {formatCurrency(item.helperPriceCents)}</option>)}</select></label><p className="muted">Der Rechnungspreis wird beim Erstellen anhand der Preisregel des Mitglieds und des aktuellen Betriebsmodus festgelegt.</p><Field name="quantity" label="Menge" type="number" initial="1" /><Field name="dueDate" label="Fällig am" type="date" initial={new Date(Date.now() + 12096e5).toISOString().slice(0, 10)} /><button className="primary">Rechnung ausstellen</button></form></section><section className="panel"><h2>Letzte Rechnungen</h2>{(data.bills ?? []).map((bill) => <div className="row" key={bill.id}><span><b>{bill.recipient.name}</b><small>{bill.lines.map((line) => `${line.quantity}× ${line.description}`).join(", ")}</small></span><b>{formatCurrency(bill.totalCents)}</b></div>)}</section></section>}
      {isManager && tab === "allocations" && <CostAllocationPanel recipients={data.billRecipients ?? []} allocations={data.allocations ?? []} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {isManager && tab === "corrections" && <CorrectionInbox corrections={data.correctionRequests ?? []} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {isManager && tab === "reports" && <SalesReport counts={data.counts ?? []} request={request} setMessage={setMessage} />}
      {isManager && tab === "tasks" && <HandoverTaskBoard tasks={data.handoverTasks ?? []} assignees={data.billRecipients ?? []} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {!canManageOps && (isMember || isGuest) && tab === "events" && <EventBoard events={data.events ?? []} request={request} setMessage={setMessage} onUpdated={refresh} canApply={!isGuest} />}
      {isMember && tab === "notes" && <NotesBoard notes={data.notes ?? []} events={data.events ?? []} canManage={false} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {tab === "social" && <SocialWall posts={data.socialPosts ?? []} currentUserId={data.user.id} canSubmit={isAdmin || isManager || isMember || isGuest} canComment={!isGuest} canModerate={isAdmin} isGuest={isGuest} request={request} setMessage={setMessage} onUpdated={refresh} />}
      {isGuest && tab === "menu" && <section className="content two-column"><section className="panel"><h1>Getränkekarte</h1><p className="muted">Aktive Getränke und aktuelle Gastpreise.</p><GuestDrinkMenu items={menuItems} /></section><section className="panel"><h2>Tagesangebot</h2>{data.dailySpecial ? <><b>{data.dailySpecial.title}</b><p>{data.dailySpecial.description}</p><strong className="guest-special-price">{formatCurrency(data.dailySpecial.priceCents)}</strong></> : <p className="muted">Heute gibt es kein aktives Tagesangebot.</p>}</section></section>}
      {isMember && tab === "consume" && <section className="content"><section className="panel"><h1>Getränk eintragen</h1><p className="muted">Der Eintrag wird deinem Konto zugeordnet und kann in die nächste Rechnung übernommen werden.</p><form onSubmit={(event) => void submit(event, "/api/consumptions", (form) => ({ itemId: value(form, "itemId"), quantity: Number(value(form, "quantity")) }))}><label>Was hattest du?<select name="itemId">{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name} — {formatCurrency(item.effectivePriceCents)}</option>)}</select></label><Field name="quantity" label="Menge" type="number" initial="1" /><button className="primary">Zu meinem Konto hinzufügen</button></form></section><RecentConsumptions consumptions={data.recentConsumptions ?? []} request={request} setMessage={setMessage} onUpdated={refresh} /><CorrectionRequestPanel consumptions={data.correctionCandidates ?? []} corrections={data.correctionRequests ?? []} request={request} setMessage={setMessage} onUpdated={refresh} /></section>}
    </main>
  );
}

function value(form: HTMLFormElement, name: string) { return String(new FormData(form).get(name) ?? ""); }
function Notice({ message, className, onDismiss }: { message: string; className?: string; onDismiss: () => void }) {
  return <div className={`notice${className ? ` ${className}` : ""}`} role="status"><span>{message}</span><button type="button" className="notice-close" onClick={onDismiss} aria-label="Hinweis schließen">×</button></div>;
}
function Field({ name, label, type = "text", initial, step, min, max, autoComplete, required = true }: { name: string; label: string; type?: string; initial?: string; step?: string; min?: string; max?: string; autoComplete?: string; required?: boolean }) { return <label>{label}<input name={name} type={type} defaultValue={initial} step={step} min={min} max={max} autoComplete={autoComplete} required={required} /></label>; }
function checked(form: HTMLFormElement, name: string) { return new FormData(form).get(name) === "on"; }
function InventoryModeFields({ item }: { item?: Pick<Item, "trackInventory" | "showInMenu"> }) {
  return <fieldset className="inventory-mode-fields">
    <legend>Artikelmodus</legend>
    <label className="checkbox-label"><input name="trackInventory" type="checkbox" defaultChecked={item?.trackInventory !== false} />Im Inventar führen</label>
    <small className="muted">Bestand zählen, Meldebestand prüfen und für Nachbestellungen anbieten.</small>
    <label className="checkbox-label"><input name="showInMenu" type="checkbox" defaultChecked={item?.showInMenu !== false} />Auf der Getränkekarte anbieten</label>
    <small className="muted">Für Mitglieder auswählbar sowie in der Gast-Getränkekarte und auf Rechnungen verfügbar.</small>
  </fieldset>;
}
function RoleSelection({ selectedRoles = ["USER"] }: { selectedRoles?: Role[] }) { return <fieldset className="role-selection"><legend>Rollen</legend><p className="muted">Rollen sind additiv. Administration erhält automatisch auch Barleitung und Mitglied.</p>{availableRoles.map((role) => <label key={role}><input name="roles" type="checkbox" value={role} defaultChecked={selectedRoles.includes(role)} />{roleLabels[role]}</label>)}</fieldset>; }
function EditableUserList({ users, currentUserId, request, setMessage, onUpdated }: { users: User[]; currentUserId: string; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const updateUser = async (event: FormEvent<HTMLFormElement>, user: User) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const formData = new FormData(form);
      const password = String(formData.get("password") ?? "");
      await request(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          roles: formData.getAll("roles").map(String),
          priceMode: String(formData.get("priceMode") ?? ""),
          active: formData.get("active") === "on",
          ...(password ? { password } : {}),
        }),
      });
      setEditingId(null);
      setMessage(`${user.name} wurde aktualisiert.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mitglied konnte nicht aktualisiert werden.");
    }
  };
  return <section className="panel"><h2>Mitglieder</h2><p className="muted">Klicke auf ein Mitglied, um dessen Daten zu bearbeiten.</p><div className="member-list">{users.map((user) => <div className="member-record" key={user.id}><button type="button" className={`member-summary ${editingId === user.id ? "selected" : ""}`} onClick={() => setEditingId(editingId === user.id ? null : user.id)} aria-expanded={editingId === user.id}><span><b>{user.name}</b><small>{user.email} · {user.priceMode && priceModeLabels[user.priceMode]}</small><span className="pill">{user.roles?.map((assignedRole) => roleLabels[assignedRole]).join(" · ")}</span>{!user.active && <span className="inactive-label">Deaktiviert</span>}</span><span className="edit-link">Bearbeiten</span></button>{editingId === user.id && <form className="member-edit-form" onSubmit={(event) => void updateUser(event, user)}><div className="edit-heading"><b>{user.name} bearbeiten</b><button type="button" className="text-button" onClick={() => setEditingId(null)}>Abbrechen</button></div>{user.id === currentUserId && user.roles?.includes("ADMIN") && <p className="muted">Zum Schutz kannst du dein eigenes Administrationskonto weder deaktivieren noch die Administrationsrolle entfernen.</p>}<div className="approval-fields"><Field name="name" label="Name" initial={user.name} /><Field name="email" label="E-Mail" type="email" initial={user.email} autoComplete="email" /><Field name="password" label="Neues Passwort (optional)" type="password" autoComplete="new-password" required={false} /></div><RoleSelection selectedRoles={user.roles ?? []} /><PriceModeSelect name="priceMode" initial={user.priceMode ?? "DYNAMIC"} /><fieldset className="role-selection"><legend>Status</legend><label><input name="active" type="checkbox" defaultChecked={user.active} />Konto ist aktiv</label></fieldset><button className="primary">Änderungen speichern</button></form>}</div>)}</div></section>;
}
function PriceModeSelect({ name, initial = "DYNAMIC" }: { name: string; initial?: PriceMode }) { return <label>Preisregel<select name={name} defaultValue={initial}>{priceModes.map((mode) => <option value={mode} key={mode}>{priceModeLabels[mode]}</option>)}</select></label>; }
function Metric({ label, value, accent, onClick }: { label: string; value: string; accent?: boolean; onClick?: () => void }) {
  const content = <><small>{label}</small><strong>{value}</strong></>;
  return onClick ? <button type="button" className={`metric metric-button ${accent ? "metric-alert" : ""}`} onClick={onClick} aria-label={`${label} öffnen`}>{content}</button> : <div className={`metric ${accent ? "metric-alert" : ""}`}>{content}</div>;
}
function RoleOverviewBanner({ role, lowStock }: { role: Role; lowStock: number }) {
  const content = role === "ADMIN"
    ? { eyebrow: "ADMINISTRATION", title: "Die Basis der Bonanzbar im Blick.", text: "Mitglieder, Inventar und Preisregeln sind zentral gepflegt und für den Betrieb bereit.", action: "Konten und Katalog verwalten" }
    : role === "MANAGER"
      ? { eyebrow: "BETRIEB & CREW", title: "Heute gemeinsam organisieren.", text: lowStock > 0 ? `${lowStock} Artikel brauchen Aufmerksamkeit, bevor es losgeht.` : "Der Bestand ist aktuell im grünen Bereich. Plane den nächsten Barabend oder prüfe offene Aufgaben.", action: "Veranstaltungen und Betrieb koordinieren" }
      : { eyebrow: "MITGLIEDERBEREICH", title: "Schön, dass du da bist.", text: "Sieh nach, was da ist, halte deinen Konsum aktuell und trage dich für den nächsten Einsatz ein.", action: "Deinen Beitrag zur Crew leisten" };
  return <section className="role-overview"><div><p className="eyebrow">{content.eyebrow}</p><h2>{content.title}</h2><p>{content.text}</p></div><span>{content.action}</span></section>;
}
function GuestDrinkMenu({ items }: { items: Array<Pick<Item, "id" | "name" | "category" | "effectivePriceCents">> }) { return <div className="table guest-drink-menu">{items.map((item) => <div className="table-row" key={item.id}><span><b>{item.name}</b><small>{item.category}</small></span><strong>{formatCurrency(item.effectivePriceCents)}</strong></div>)}</div>; }
function InventoryTable({ items, onDeactivate }: { items: Item[]; onDeactivate?: (item: Item) => void }) { return <div className="table">{items.map((item) => <div className="table-row" key={item.id}><span><b>{item.name}</b><small>{item.category} · {formatCurrency(item.effectivePriceCents)} · {item.packageSize} {item.unit} je Gebinde</small></span><span className={item.onHand <= item.reorderLevel ? "low" : ""}>{formatStockQuantity(item.onHand, item)}<small>Meldebestand: {formatStockQuantity(item.reorderLevel, item)}</small>{onDeactivate && <button className="text-button inline-action" onClick={() => onDeactivate(item)}>Ausmustern</button>}</span></div>)}</div>; }
function PricingAdministration({ settings, users, request, setMessage, onUpdated }: { settings: { isOfficiallyOpen: boolean; updatedAt: string }; users: User[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const updateServiceMode = async (isOfficiallyOpen: boolean) => {
    try {
      await request("/api/bar-settings", { method: "PATCH", body: JSON.stringify({ isOfficiallyOpen }) });
      setMessage(isOfficiallyOpen ? "Betriebsmodus auf „Offiziell geöffnet“ gestellt." : "Betriebsmodus auf „Helferbetrieb“ gestellt.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Betriebsmodus konnte nicht aktualisiert werden.");
    }
  };
  const updateUserPriceMode = async (user: User, priceMode: PriceMode) => {
    try {
      await request(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ priceMode }) });
      setMessage(`Preisregel für ${user.name} gespeichert.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preisregel konnte nicht gespeichert werden.");
    }
  };

  return <section className="content"><section className="panel pricing-mode"><p className="eyebrow">AKTUELLER BETRIEBSMODUS</p><h1>{settings.isOfficiallyOpen ? "Offiziell geöffnet" : "Helferbetrieb"}</h1><p className="muted">Die Einstellung gilt sofort für Mitglieder mit der Regel „Nach Betriebsmodus“.</p><div className="mode-actions"><button type="button" className={settings.isOfficiallyOpen ? "primary" : "secondary"} onClick={() => void updateServiceMode(true)}>Offiziell geöffnet</button><button type="button" className={!settings.isOfficiallyOpen ? "primary" : "secondary"} onClick={() => void updateServiceMode(false)}>Helferbetrieb</button></div></section><section className="panel"><h2>Preisregel je Person</h2><p className="muted">„Immer regulärer Preis“ und „Immer Helferpreis“ ignorieren den Betriebsmodus. „Nach Betriebsmodus“ wechselt beim Umschalten oben.</p><div className="pricing-users">{users.filter((user) => user.active).map((user) => <div className="pricing-user" key={user.id}><span><b>{user.name}</b><small>{user.email}</small></span><label>Preisregel<select value={user.priceMode ?? "DYNAMIC"} onChange={(event) => { const priceMode = priceModes.find((mode) => mode === event.currentTarget.value); if (priceMode) void updateUserPriceMode(user, priceMode); }}>{priceModes.map((mode) => <option value={mode} key={mode}>{priceModeLabels[mode]}</option>)}</select></label></div>)}</div></section></section>;
}
function parseEuroCents(input: string) {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
function CostAllocationPanel({ recipients, allocations, request, setMessage, onUpdated }: { recipients: User[]; allocations: CostAllocation[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const totalCents = parseEuroCents(amount);
  const shares = totalCents === null ? [] : recipients.map((recipient, index) => ({
    recipient,
    amountCents: Math.floor(totalCents / recipients.length) + (index < totalCents % recipients.length ? 1 : 0),
  }));
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (totalCents === null || totalCents < 1) return;
    try {
      await request("/api/allocations", { method: "POST", body: JSON.stringify({ title, totalCents }) });
      setTitle("");
      setAmount("");
      setMessage("Umlage wurde als offene Rechnung für alle aktiven Mitglieder gebucht.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Umlage konnte nicht gebucht werden.");
    }
  };
  return <section className="content two-column"><section className="panel"><h1>Kosten umlegen</h1><p className="muted">Der Betrag wird gleichmäßig auf alle aktiven Mitglieder verteilt. Restcent erhalten die ersten Mitglieder der alphabetischen Liste.</p><form onSubmit={(event) => void create(event)}><label>Verwendungszweck<input value={title} maxLength={300} onChange={(event) => setTitle(event.currentTarget.value)} required /></label><label>Gesamtbetrag in EUR<input value={amount} inputMode="decimal" placeholder="0,00" onChange={(event) => setAmount(event.currentTarget.value)} required /></label>{shares.length > 0 && <div className="allocation-preview"><h3>Verteilung vor dem Buchen</h3>{shares.map((share) => <div className="row" key={share.recipient.id}><span>{share.recipient.name}</span><b>{formatCurrency(share.amountCents)}</b></div>)}</div>}<button className="primary" disabled={!title.trim() || totalCents === null || totalCents < 1 || recipients.length === 0}>Umlage verbindlich buchen</button></form></section><section className="panel"><h2>Gebuchte Umlagen</h2>{allocations.length === 0 ? <p className="muted">Noch keine Umlage gebucht.</p> : <div className="allocation-history">{allocations.map((allocation) => <article className="event-card" key={allocation.id}><div className="event-heading"><div><h3>{allocation.title}</h3><small>{dateTime(allocation.createdAt)} · {formatCurrency(allocation.totalCents)}</small></div></div>{allocation.bills.map((bill) => <div className="row" key={bill.id}><span>{bill.recipient.name}<small>{bill.status === "OPEN" ? "offene Rechnung" : "bezahlt"}</small></span><b>{formatCurrency(bill.totalCents)}</b></div>)}</article>)}</div>}</section></section>;
}
function CorrectionRequestPanel({ consumptions, corrections, request, setMessage, onUpdated }: { consumptions: Consumption[]; corrections: ConsumptionCorrection[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const availableItems = Array.from(new Map(consumptions.filter((consumption) => !consumption.voidedAt).map((consumption) => [consumption.item.id, consumption.item])).values());
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request("/api/corrections", { method: "POST", body: JSON.stringify({ itemId: value(form, "itemId"), note: value(form, "note") }) });
      form.reset();
      setMessage("Korrekturanfrage wurde an die Barleitung gesendet.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Korrekturanfrage konnte nicht gesendet werden.");
    }
  };
  return <section className="panel"><h2>Korrektur anfragen</h2><p className="muted">Die Barleitung kann nur noch offene Getränke stornieren. Bereits ausgestellte Rechnungen bleiben unverändert.</p>{availableItems.length === 0 ? <p className="muted">Zurzeit gibt es kein offenes Getränk, das korrigiert werden kann.</p> : <form onSubmit={(event) => void create(event)}><label>Artikel<select name="itemId">{availableItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Nachricht an die Barleitung<textarea name="note" rows={3} maxLength={2_000} required /></label><button className="secondary">Anfrage senden</button></form>}<div className="correction-history">{corrections.map((correction) => <div className="row" key={correction.id}><span><b>{correction.item.name}</b><small>{correction.status === "PENDING" ? "Prüfung offen" : `${correction.voidedQuantity} Getränk(e) storniert`}{correction.response ? ` · ${correction.response}` : ""}</small></span><span className={`application-status ${correction.status.toLocaleLowerCase("en-US")}`}>{correction.status === "PENDING" ? "Offen" : "Erledigt"}</span></div>)}</div></section>;
}
function CorrectionInbox({ corrections, request, setMessage, onUpdated }: { corrections: ConsumptionCorrection[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const resolve = async (event: FormEvent<HTMLFormElement>, correction: ConsumptionCorrection) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request(`/api/corrections/${correction.id}`, { method: "PATCH", body: JSON.stringify({ voidedQuantity: Number(value(form, "voidedQuantity")), response: value(form, "response") }) });
      setMessage(`Korrekturanfrage von ${correction.user?.name ?? "dem Mitglied"} wurde abgeschlossen.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Korrekturanfrage konnte nicht abgeschlossen werden.");
    }
  };
  return <section className="content"><section className="panel"><h1>Korrekturanfragen</h1><p className="muted">Storniere nur noch offene Getränke. Bereits ausgestellte Rechnungen werden nie rückwirkend verändert.</p>{corrections.length === 0 ? <p className="muted">Keine Korrekturanfragen vorhanden.</p> : <div className="event-list">{corrections.map((correction) => <article className="event-card" key={correction.id}><div className="event-heading"><div><h3>{correction.user?.name ?? "Mitglied"} · {correction.item.name}</h3><small>{dateTime(correction.createdAt)} · {correction.user?.email}</small><p>{correction.note}</p></div><span className={`application-status ${correction.status.toLocaleLowerCase("en-US")}`}>{correction.status === "PENDING" ? "Offen" : "Erledigt"}</span></div>{correction.status === "PENDING" ? <form onSubmit={(event) => void resolve(event, correction)}><p className="muted">Noch offen: <b>{correction.openQuantity ?? 0} Getränk(e)</b>. Gib die Anzahl der zu stornierenden Getränke ein; <b>0</b> schließt die Anfrage ohne Storno ab.</p><Field name="voidedQuantity" label={`Zu stornierende Getränke (maximal ${correction.openQuantity ?? 0})`} type="number" initial="0" min="0" max={String(correction.openQuantity ?? 0)} /><label>Antwort an das Mitglied<textarea name="response" rows={2} maxLength={300} required /></label><button className="primary">Prüfen und abschließen</button></form> : <p className="muted">{correction.voidedQuantity} Getränk(e) storniert{correction.response ? ` · ${correction.response}` : ""}</p>}</article>)}</div>}</section></section>;
}
function ResetDataPanel({ request, setMessage, onReset }: { request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onReset: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState("");
  const reset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await request("/api/admin/reset", { method: "POST", body: JSON.stringify({ confirmation }) });
      setConfirmation("");
      setMessage("Alle Betriebsdaten wurden gelöscht. Mitgliedskonten und Rollen bleiben erhalten.");
      await onReset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Daten konnten nicht zurückgesetzt werden.");
    }
  };
  return <section className="content"><section className="panel alert"><h1>Alle Betriebsdaten zurücksetzen</h1><p>Diese Aktion löscht Inventar, Zählungen, Einkaufslisten, Rechnungen, Umlagen, Konsumeinträge, Veranstaltungen, Dienstbewerbungen, Notizen und Korrekturanfragen. Mitgliedskonten und ihre Rollen bleiben erhalten.</p><p><b>Erstelle vorher eine Datenbanksicherung.</b> Dieser Vorgang kann in der App nicht rückgängig gemacht werden.</p><form onSubmit={(event) => void reset(event)}><label>Zur Bestätigung exakt „reset“ eingeben<input value={confirmation} autoComplete="off" onChange={(event) => setConfirmation(event.currentTarget.value)} required /></label><button className="danger-button" disabled={confirmation !== "reset"}>Jetzt endgültig zurücksetzen</button></form></section></section>;
}
function parseDuties(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, slots = "1"] = line.split(";", 2);
    return { label: label.trim(), slots: Number(slots.trim()) };
  });
}
function EventManagement({ events, request, setMessage, onUpdated }: { events: BarEvent[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const startsAt = new Date(value(form, "startsAt"));
      const endsValue = value(form, "endsAt");
      await request("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: value(form, "title"),
          description: value(form, "description"),
          location: value(form, "location"),
          ...(value(form, "bandInfo") ? { bandInfo: value(form, "bandInfo") } : {}),
          ...(value(form, "bandHomepageUrl") ? { bandHomepageUrl: value(form, "bandHomepageUrl") } : {}),
          ...(value(form, "ticketUrl") ? { ticketUrl: value(form, "ticketUrl") } : {}),
          ...(value(form, "youtubeUrl") ? { youtubeUrl: value(form, "youtubeUrl") } : {}),
          bandImageUrls: value(form, "bandImageUrls").split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
          startsAt: startsAt.toISOString(),
          ...(endsValue ? { endsAt: new Date(endsValue).toISOString() } : {}),
          status: value(form, "status"),
          duties: parseDuties(value(form, "duties")),
        }),
      });
      form.reset();
      setMessage("Veranstaltung angelegt.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Veranstaltung konnte nicht angelegt werden.");
    }
  };
  const updateStatus = async (event: BarEvent, status: BarEvent["status"]) => {
    try {
      await request(`/api/events/${event.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage(`„${event.title}“ wurde ${status === "PUBLISHED" ? "veröffentlicht" : status === "CANCELLED" ? "abgesagt" : "als Entwurf gespeichert"}.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Veranstaltung konnte nicht aktualisiert werden.");
    }
  };
  const updateEvent = async (submitEvent: FormEvent<HTMLFormElement>, event: BarEvent) => {
    submitEvent.preventDefault();
    const form = submitEvent.currentTarget;
    try {
      const endsAt = value(form, "endsAt");
      await request(`/api/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: value(form, "title"),
          description: value(form, "description") || null,
          location: value(form, "location") || null,
          bandInfo: value(form, "bandInfo") || null,
          bandHomepageUrl: value(form, "bandHomepageUrl") || null,
          ticketUrl: value(form, "ticketUrl") || null,
          youtubeUrl: value(form, "youtubeUrl") || null,
          bandImageUrls: value(form, "bandImageUrls").split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
          startsAt: new Date(value(form, "startsAt")).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          status: value(form, "status"),
        }),
      });
      setEditingId(null);
      setMessage(`„${event.title}“ wurde aktualisiert.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Veranstaltung konnte nicht aktualisiert werden.");
    }
  };
  const updateApplication = async (event: BarEvent, application: EventApplication, status: EventApplicationStatus) => {
    try {
      await request(`/api/events/${event.id}/applications/${application.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage(`Bewerbung von ${application.user?.name ?? "dem Mitglied"} wurde ${applicationStatusLabels[status].toLocaleLowerCase("de-DE")}.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dienstbewerbung konnte nicht aktualisiert werden.");
    }
  };
  return <section className="content two-column"><section className="panel"><h1>Veranstaltung anlegen</h1><form onSubmit={(event) => void create(event)}><Field name="title" label="Titel" /><div className="approval-fields"><Field name="startsAt" label="Beginn" type="datetime-local" initial={new Date(Date.now() + 6048e5).toISOString().slice(0, 16)} /><Field name="endsAt" label="Ende (optional)" type="datetime-local" required={false} /><Field name="location" label="Ort (optional)" required={false} /></div><label>Beschreibung<textarea name="description" rows={3} /></label><label>Bandinfos<textarea name="bandInfo" rows={3} /></label><div className="approval-fields"><Field name="bandHomepageUrl" label="Band-Homepage (URL)" type="url" required={false} /><Field name="ticketUrl" label="Ticket-Link (URL)" type="url" required={false} /><Field name="youtubeUrl" label="YouTube-Link (URL)" type="url" required={false} /></div><label>Bandbild-URLs (maximal 4, eine URL je Zeile)<textarea name="bandImageUrls" rows={3} /></label><label>Status<select name="status" defaultValue="DRAFT"><option value="DRAFT">Entwurf</option><option value="PUBLISHED">Veröffentlicht</option></select></label><label>Dienste und Sollbesetzung<textarea name="duties" rows={5} defaultValue={"Theke;2\nEintritt;1\nJoker;1"} /><small>Ein Dienst je Zeile im Format „Bezeichnung; Anzahl“.</small></label><button className="primary">Veranstaltung speichern</button></form></section><section className="panel"><h2>Veranstaltungen verwalten</h2>{events.length === 0 ? <p className="muted">Noch keine Veranstaltung geplant.</p> : <div className="event-list">{events.map((event) => <article className="event-card" key={event.id}>{editingId === event.id ? <form className="event-edit-form" onSubmit={(submitEvent) => void updateEvent(submitEvent, event)}><div className="edit-heading"><b>{event.title} bearbeiten</b><button type="button" className="text-button" onClick={() => setEditingId(null)}>Abbrechen</button></div><div className="approval-fields"><Field name="title" label="Titel" initial={event.title} /><Field name="startsAt" label="Beginn" type="datetime-local" initial={dateTimeInput(event.startsAt)} /><Field name="endsAt" label="Ende (optional)" type="datetime-local" initial={event.endsAt ? dateTimeInput(event.endsAt) : undefined} required={false} /><Field name="location" label="Ort (optional)" initial={event.location ?? undefined} required={false} /></div><label>Beschreibung<textarea name="description" rows={3} defaultValue={event.description ?? ""} /></label><label>Bandinfos<textarea name="bandInfo" rows={3} defaultValue={event.bandInfo ?? ""} /></label><div className="approval-fields"><Field name="bandHomepageUrl" label="Band-Homepage (URL)" type="url" initial={event.bandHomepageUrl ?? undefined} required={false} /><Field name="ticketUrl" label="Ticket-Link (URL)" type="url" initial={event.ticketUrl ?? undefined} required={false} /><Field name="youtubeUrl" label="YouTube-Link (URL)" type="url" initial={event.youtubeUrl ?? undefined} required={false} /></div><label>Bandbild-URLs (maximal 4, eine URL je Zeile)<textarea name="bandImageUrls" rows={3} defaultValue={event.bandImageUrls.join("\n")} /></label><label>Status<select name="status" defaultValue={event.status}><option value="DRAFT">Entwurf</option><option value="PUBLISHED">Veröffentlicht</option><option value="CANCELLED">Abgesagt</option></select></label><button className="primary">Änderungen speichern</button></form> : <><EventHeader event={event} /><div className="event-actions"><button type="button" className="text-button" onClick={() => setEditingId(event.id)}>Bearbeiten</button>{event.status !== "PUBLISHED" && <button type="button" className="secondary" onClick={() => void updateStatus(event, "PUBLISHED")}>Veröffentlichen</button>}{event.status !== "DRAFT" && <button type="button" className="text-button" onClick={() => void updateStatus(event, "DRAFT")}>Als Entwurf</button>}{event.status !== "CANCELLED" && <button type="button" className="text-button danger-action" onClick={() => void updateStatus(event, "CANCELLED")}>Absagen</button>}</div><div className="duty-list">{event.duties.map((duty) => { const confirmed = duty.applications.filter((application) => application.status === "CONFIRMED").length; return <section className="duty-card" key={duty.id}><div><b>{duty.label}</b><small>{confirmed} von {duty.slots} bestätigt</small></div>{duty.applications.length === 0 ? <small className="muted">Noch keine Bewerbungen.</small> : <div className="application-list">{duty.applications.map((application) => <div className="application-row" key={application.id}><span><b>{application.user?.name ?? "Mitglied"}</b><small>{application.note || application.user?.email}</small></span><span className="application-actions"><span className={`application-status ${application.status.toLocaleLowerCase("en-US")}`}>{applicationStatusLabels[application.status]}</span>{application.status !== "CONFIRMED" && <button type="button" className="text-button" onClick={() => void updateApplication(event, application, "CONFIRMED")}>Bestätigen</button>}{application.status !== "DECLINED" && <button type="button" className="text-button danger-action" onClick={() => void updateApplication(event, application, "DECLINED")}>Ablehnen</button>}</span></div>)}</div>}</section>; })}</div></>}</article>)}</div>}</section></section>;
}
function EventBoard({ events, request, setMessage, onUpdated, canApply }: { events: BarEvent[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void>; canApply: boolean }) {
  const apply = async (event: BarEvent, duty: EventDuty) => {
    try {
      await request(`/api/events/${event.id}/applications`, { method: "POST", body: JSON.stringify({ dutyId: duty.id }) });
      setMessage(`Deine Bewerbung für „${duty.label}“ wurde eingetragen.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dienstbewerbung konnte nicht gespeichert werden.");
    }
  };
  const withdraw = async (event: BarEvent, application: EventApplication) => {
    try {
      await request(`/api/events/${event.id}/applications/${application.id}`, { method: "DELETE" });
      setMessage("Deine offene Bewerbung wurde zurückgezogen.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dienstbewerbung konnte nicht zurückgezogen werden.");
    }
  };
  const upcoming = events.filter((event) => new Date(event.startsAt) >= new Date());
  return <section className="content"><section className="panel"><h1>Veranstaltungen</h1><p className="muted">{canApply ? "Hier findest du veröffentlichte Termine und kannst dich für freie Dienste eintragen." : "Hier findest du veröffentlichte Termine, Bandinfos und Tickets."}</p>{upcoming.length === 0 ? <p className="muted">Zurzeit sind keine zukünftigen Veranstaltungen veröffentlicht.</p> : <div className="event-list">{upcoming.map((event) => <article className="event-card" key={event.id}><EventHeader event={event} />{canApply && <div className="duty-list">{event.duties.map((duty) => { const application = duty.applications[0]; return <section className="duty-card" key={duty.id}><div><b>{duty.label}</b><small>{duty.slots} benötigte Person{duty.slots === 1 ? "" : "en"}</small></div>{application ? <span className="application-actions"><span className={`application-status ${application.status.toLocaleLowerCase("en-US")}`}>{applicationStatusLabels[application.status]}</span>{application.status === "APPLIED" && <button type="button" className="text-button danger-action" onClick={() => void withdraw(event, application)}>Zurückziehen</button>}</span> : <button type="button" className="secondary" onClick={() => void apply(event, duty)}>Bewerben</button>}</section>; })}</div>}</article>)}</div>}</section></section>;
}
function EventHeader({ event }: { event: BarEvent }) { return <div className="event-heading"><div><h3>{event.title}</h3><small>{dateTime(event.startsAt)}{event.endsAt ? ` – ${dateTime(event.endsAt)}` : ""}{event.location ? ` · ${event.location}` : ""}</small></div><span className={`event-status ${event.status.toLocaleLowerCase("en-US")}`}>{event.status === "PUBLISHED" ? "Veröffentlicht" : event.status === "CANCELLED" ? "Abgesagt" : "Entwurf"}</span>{event.description && <p>{event.description}</p>}{event.bandInfo && <p>{event.bandInfo}</p>}{(event.bandHomepageUrl || event.youtubeUrl || event.ticketUrl) && <div className="event-links">{event.bandHomepageUrl && <a href={event.bandHomepageUrl} target="_blank" rel="noreferrer">Band-Homepage ↗</a>}{event.youtubeUrl && <a href={event.youtubeUrl} target="_blank" rel="noreferrer">Video ↗</a>}{event.ticketUrl && <a href={event.ticketUrl} target="_blank" rel="noreferrer">Tickets ↗</a>}</div>}</div>; }
function NotesBoard({ notes, events, canManage, request, setMessage, onUpdated }: { notes: BulletinNote[]; events: BarEvent[]; canManage: boolean; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: value(form, "title"),
          body: value(form, "body"),
          pinned: new FormData(form).get("pinned") === "on",
          eventId: value(form, "eventId") || null,
        }),
      });
      form.reset();
      setMessage("Notiz veröffentlicht.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notiz konnte nicht gespeichert werden.");
    }
  };
  const update = async (note: BulletinNote, payload: object, message: string) => {
    try {
      await request(`/api/notes/${note.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setMessage(message);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notiz konnte nicht aktualisiert werden.");
    }
  };
  const remove = async (note: BulletinNote) => {
    try {
      await request(`/api/notes/${note.id}`, { method: "DELETE" });
      setMessage("Notiz gelöscht.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notiz konnte nicht gelöscht werden.");
    }
  };
  const list = <section className="panel"><h2>{canManage ? "Aktuelle Notizen" : "Notizen der Barleitung"}</h2>{notes.length === 0 ? <p className="muted">Zurzeit gibt es keine Notizen.</p> : <div className="note-list">{notes.map((note) => <article className={`note-card ${note.pinned ? "pinned" : ""}`} key={note.id}><div className="note-heading"><span><b>{note.title}</b><small>{date(note.createdAt)}{note.event ? ` · ${note.event.title}` : ""}</small></span>{note.pinned && <span className="pill">Angeheftet</span>}</div><p>{note.body}</p>{canManage && <div className="note-actions"><button type="button" className="text-button" onClick={() => void update(note, { pinned: !note.pinned }, note.pinned ? "Notiz gelöst." : "Notiz angeheftet.")}>{note.pinned ? "Lösen" : "Anheften"}</button><button type="button" className="text-button danger-action" onClick={() => void remove(note)}>Löschen</button></div>}</article>)}</div>}</section>;
  if (!canManage) return <section className="content">{list}</section>;
  return <section className="content two-column"><section className="panel"><h1>Notiz veröffentlichen</h1><form onSubmit={(event) => void create(event)}><Field name="title" label="Titel" /><label>Inhalt<textarea name="body" rows={6} required /></label><label>Veranstaltung (optional)<select name="eventId" defaultValue=""><option value="">Keine Zuordnung</option>{events.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}</select></label><label className="checkbox-label"><input name="pinned" type="checkbox" />Für alle anheften</label><button className="primary">Notiz veröffentlichen</button></form></section>{list}</section>;
}
function EditableInventoryCatalog({ items, request, setMessage, onUpdated }: { items: Item[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const update = async (event: FormEvent<HTMLFormElement>, item: Item) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request(`/api/inventory/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: value(form, "name"),
          category: value(form, "category"),
          unit: value(form, "unit"),
          packageSize: Number(value(form, "packageSize")),
          reorderLevel: Number(value(form, "reorderLevel")),
          priceCents: Math.round(Number(value(form, "publicPrice")) * 100),
          helperPriceCents: Math.round(Number(value(form, "helperPrice")) * 100),
          guestPriceCents: Math.round(Number(value(form, "guestPrice")) * 100),
          trackInventory: checked(form, "trackInventory"),
          showInMenu: checked(form, "showInMenu"),
        }),
      });
      setEditingId(null);
      setMessage(`${item.name} wurde aktualisiert.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventarartikel konnte nicht aktualisiert werden.");
    }
  };
  const retire = async (item: Item) => {
    try {
      await request(`/api/inventory/${item.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
      setMessage(`${item.name} wurde ausgemustert.`);
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventarartikel konnte nicht ausgemustert werden.");
    }
  };

  return <section className="panel"><h2>Aktueller Katalog</h2><p className="muted">Artikel lassen sich direkt bearbeiten. Änderungen gelten für künftige Zählungen und Rechnungen.</p><div className="editable-inventory">{items.map((item) => editingId === item.id ? <form className="inventory-edit-form" key={item.id} onSubmit={(event) => void update(event, item)}><div className="edit-heading"><b>{item.name} bearbeiten</b><button type="button" className="text-button" onClick={() => setEditingId(null)}>Abbrechen</button></div><div className="approval-fields"><Field name="name" label="Name" initial={item.name} /><Field name="category" label="Kategorie" initial={item.category} /><Field name="unit" label="Einheit" initial={item.unit} /><Field name="packageSize" label="Gebindegröße (Einheiten je Gebinde)" type="number" initial={String(item.packageSize)} min="1" /><Field name="reorderLevel" label="Meldebestand (Einheiten)" type="number" initial={String(item.reorderLevel)} min="0" /><Field name="publicPrice" label="Regulärer Preis (EUR)" type="number" step="0.01" initial={(item.priceCents / 100).toFixed(2)} min="0" /><Field name="helperPrice" label="Helferpreis (EUR)" type="number" step="0.01" initial={(item.helperPriceCents / 100).toFixed(2)} min="0" /><Field name="guestPrice" label="Gastpreis (EUR)" type="number" step="0.01" initial={(item.guestPriceCents / 100).toFixed(2)} min="0" /></div><InventoryModeFields item={item} /><button className="primary">Änderungen speichern</button></form> : <div className="editable-inventory-row" key={item.id}><span><b>{item.name}</b><small>{item.category} · {item.packageSize} {item.unit} je Gebinde · Meldebestand: {formatStockQuantity(item.reorderLevel, item)} · {itemModeLabel(item)}</small></span><span className="catalog-actions"><b>Regulär: {formatCurrency(item.priceCents)}</b><small>Helfer: {formatCurrency(item.helperPriceCents)}</small><small>Gast: {formatCurrency(item.guestPriceCents)}</small><button type="button" className="text-button" onClick={() => setEditingId(item.id)}>Bearbeiten</button><button type="button" className="text-button danger-action" onClick={() => void retire(item)}>Ausmustern</button></span></div>)}</div></section>;
}
function PendingInventoryApprovals({ items, request, setMessage, onApproved }: { items: PendingInventoryItem[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onApproved: () => Promise<void> }) {
  const saveDraft = async (event: FormEvent<HTMLFormElement>, shoppingItemId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request(`/api/inventory/approvals/${shoppingItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: value(form, "name"),
          category: value(form, "category"),
          unit: value(form, "unit"),
          packageSize: Number(value(form, "packageSize")),
          reorderLevel: Number(value(form, "reorderLevel")),
          priceCents: Math.round(Number(value(form, "price")) * 100),
          helperPriceCents: Math.round(Number(value(form, "helperPrice")) * 100),
        }),
      });
      setMessage("Entwurf für den neuen Artikel gespeichert.");
      await onApproved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Artikelentwurf konnte nicht gespeichert werden.");
    }
  };
  const approve = async (shoppingItemId: string) => {
    try {
      await request("/api/inventory/approvals", { method: "POST", body: JSON.stringify({ shoppingItemId }) });
      setMessage("Artikel für künftige Inventuren freigegeben.");
      await onApproved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Artikel konnte nicht freigegeben werden.");
    }
  };

  return <section className="panel"><h2>Neue Artikel für Inventur freigeben</h2><p className="muted">Freie Positionen aus Einkaufslisten können hier erst bearbeitet und anschließend für künftige Inventuren freigegeben werden.</p>{items.length === 0 ? <p className="muted">Keine neuen Artikel warten auf Freigabe.</p> : <div className="approval-list">{items.map((item) => <form className="approval-form" key={item.id} onSubmit={(event) => void saveDraft(event, item.id)}><div className="approval-heading"><span><b>{item.name}</b><small>{item.quantity}× auf „{item.list.title}“ {item.list.status === "PURCHASED" ? "eingekauft" : "offen"}</small></span><span className="pill">Noch nicht im Inventar</span></div><div className="approval-fields"><Field name="name" label="Name" initial={item.name} /><Field name="category" label="Kategorie" initial={item.proposedCategory ?? "Sonstiges"} /><Field name="unit" label="Einheit" initial={item.proposedUnit ?? "Flasche"} /><Field name="packageSize" label="Gebindegröße (Einheiten je Gebinde)" type="number" initial={String(item.proposedPackageSize ?? 1)} min="1" /><Field name="reorderLevel" label="Meldebestand (Einheiten)" type="number" initial={String(item.proposedReorderLevel ?? 0)} min="0" /><Field name="price" label="Regulärer Preis (EUR)" type="number" step="0.01" initial={((item.proposedPriceCents ?? 0) / 100).toFixed(2)} min="0" /><Field name="helperPrice" label="Helferpreis (EUR)" type="number" step="0.01" initial={((item.proposedHelperPriceCents ?? 0) / 100).toFixed(2)} min="0" /></div><div className="approval-actions"><button className="secondary">Änderungen speichern</button><button type="button" className="primary" onClick={() => void approve(item.id)}>Für Inventur freigeben</button></div></form>)}</div>}</section>;
}
function ShoppingLists({ lists, request, setMessage, onUpdated }: { lists: ShoppingList[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const openLists = lists.filter((list) => list.status === "OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(openLists[0]?.id ?? null);
  const selected = openLists.find((list) => list.id === selectedId) ?? openLists[0];
  const changeItem = async (item: ShoppingList["items"][number]) => {
    if (!selected) return;
    try {
      await request(`/api/shopping-lists/${selected.id}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ purchased: !item.purchased }) });
      setMessage(item.purchased ? "Position wieder geöffnet." : "Position als eingekauft markiert.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Einkaufsposition konnte nicht aktualisiert werden.");
    }
  };
  const completeList = async () => {
    if (!selected) return;
    try {
      await request(`/api/shopping-lists/${selected.id}`, { method: "PATCH", body: JSON.stringify({ markAllPurchased: true }) });
      setMessage("Die gesamte Einkaufsliste wurde als eingekauft markiert.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Einkaufsliste konnte nicht aktualisiert werden.");
    }
  };

  return <section className="panel"><h2>Offene Listen</h2>{openLists.length === 0 ? <p className="muted">Zurzeit gibt es keine offenen Einkaufslisten.</p> : <><div className="shopping-list-tabs">{openLists.map((list) => <button type="button" className={selected?.id === list.id ? "selected" : ""} onClick={() => setSelectedId(list.id)} key={list.id}>{list.title}<small>{list.items.filter((item) => !item.purchased).length} offen</small></button>)}</div>{selected && <div className="shopping-list-detail"><div className="list-detail-heading"><div><h3>{selected.title}</h3><p className="muted">{selected.items.filter((item) => item.purchased).length} von {selected.items.length} Positionen eingekauft</p></div><button type="button" className="primary" onClick={() => void completeList()}>Alles eingekauft</button></div><div className="shopping-items">{selected.items.map((item) => <label className={`shopping-item ${item.purchased ? "purchased" : ""}`} key={item.id}><input type="checkbox" checked={item.purchased} onChange={() => void changeItem(item)} /><span><b>{item.quantity}× {item.name}</b><small>{item.purchased ? "Eingekauft" : "Noch offen"}{!item.itemId ? " · Neuer Artikel, noch nicht für Inventur freigegeben" : ""}</small></span></label>)}</div></div>}</>}</section>;
}
function ManagerOverview({ data }: { data: Bootstrap }) { return <section className="split"><section className="panel"><h2>Offene Einkäufe</h2>{(data.shoppingLists ?? []).slice(0, 3).map((list) => <p key={list.id}><b>{list.title}</b><br /><span className="muted">{list.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}</span></p>)}</section><section className="panel"><h2>Offene Rechnungen</h2>{(data.bills ?? []).slice(0, 3).map((bill) => <p key={bill.id}><b>{bill.recipient.name}</b><br /><span className="muted">{formatCurrency(bill.totalCents)} · {bill.status === "OPEN" ? "offen" : "bezahlt"}</span></p>)}</section></section>; }
function RecentConsumptions({ consumptions, request, setMessage, onUpdated }: { consumptions: Consumption[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void; onUpdated: () => Promise<void> }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  const undo = async (entry: Consumption) => {
    try {
      await request(`/api/consumptions/${entry.id}`, { method: "DELETE" });
      setMessage("Getränkestrich zurückgenommen.");
      await onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Getränkestrich konnte nicht zurückgenommen werden.");
    }
  };
  return <section className="panel"><h2>Meine letzten Einträge</h2>{consumptions.length ? consumptions.map((entry) => {
    const remainingSeconds = Math.max(0, Math.ceil((new Date(entry.occurredAt).getTime() + 10_000 - now) / 1000));
    return <div className="row" key={entry.id}><span>{entry.quantity}× {entry.item.name}<small>{date(entry.occurredAt)}{entry.voidedAt ? " · Storniert" : ""}{!entry.voidedAt && remainingSeconds > 0 ? ` · noch ${remainingSeconds}s rücknehmbar` : ""}</small></span><span className="consumption-actions"><b className={entry.voidedAt ? "muted" : ""}>{formatCurrency(entry.quantity * entry.unitCents)}</b>{!entry.voidedAt && remainingSeconds > 0 && <button type="button" className="text-button danger-action" onClick={() => void undo(entry)}>Rückgängig</button>}</span></div>;
  }) : <p className="muted">Noch keine Getränke eingetragen.</p>}</section>;
}
function SalesReport({ counts, request, setMessage }: { counts: Count[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void }) {
  const [report, setReport] = useState<{ sold: { name: string; quantity: number; unit: string; revenueCents: number }[]; totalRevenueCents: number; methodology: string } | null>(null);
  const run = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; try { const body = await request(`/api/reports/sold?fromCountId=${value(form, "from")}&toCountId=${value(form, "to")}`) as typeof report; setReport(body); } catch (error) { setMessage(error instanceof Error ? error.message : "Bericht konnte nicht erstellt werden."); } };
  return <section className="content two-column"><section className="panel"><h1>Verkaufsbericht</h1><form onSubmit={(event) => void run(event)}><label>Eröffnungszählung<select name="from">{[...counts].reverse().map((count) => <option value={count.id} key={count.id}>{count.label} · {date(count.countedAt)}</option>)}</select></label><label>Abschlusszählung<select name="to">{counts.map((count) => <option value={count.id} key={count.id}>{count.label} · {date(count.countedAt)}</option>)}</select></label><button className="primary" disabled={counts.length < 2}>Bericht erstellen</button></form></section><section className="panel"><h2>Ergebnis</h2>{report ? <><div className="metric"><small>Geschätzter Verkaufswert</small><strong>{formatCurrency(report.totalRevenueCents)}</strong></div>{report.sold.map((line) => <div className="row" key={line.name}><span>{line.name}<small>{line.quantity} {line.unit} verkauft</small></span><b>{formatCurrency(line.revenueCents)}</b></div>)}<p className="muted">{report.methodology}</p></> : <p className="muted">Wähle zwei abgeschlossene Zählungen in zeitlicher Reihenfolge.</p>}</section></section>;
}
