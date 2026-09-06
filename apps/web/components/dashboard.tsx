"use client";

import { formatCurrency, priceModeLabels, priceModes, roleLabels, type PriceMode, type Role } from "@bonanzbar/shared";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; category: string; unit: string; priceCents: number; helperPriceCents: number; effectivePriceCents: number; reorderLevel: number; onHand: number };
type Count = { id: string; label: string; countedAt: string; lines: { itemId: string; quantity: number }[] };
type User = { id: string; name: string; email: string; role?: Role; priceMode?: PriceMode; active?: boolean };
type ShoppingList = { id: string; title: string; status: string; items: { id: string; itemId: string | null; name: string; quantity: number; purchased: boolean }[] };
type PendingInventoryItem = {
  id: string;
  name: string;
  quantity: number;
  proposedCategory: string | null;
  proposedUnit: string | null;
  proposedReorderLevel: number | null;
  proposedPriceCents: number | null;
  proposedHelperPriceCents: number | null;
  list: { title: string; status: string };
};
type Bill = { id: string; totalCents: number; status: string; issuedAt: string; recipient: { name: string }; lines: { id: string; description: string; quantity: number; unitCents: number }[] };
type Consumption = { id: string; quantity: number; unitCents: number; occurredAt: string; item: { name: string } };
type Bootstrap = {
  user: { id: string; name: string; email: string; role: Role };
  inventory: Item[];
  latestCount: { id: string; label: string; countedAt: string } | null;
  users?: User[];
  pendingInventoryItems?: PendingInventoryItem[];
  counts?: Count[];
  shoppingLists?: ShoppingList[];
  bills?: Bill[];
  recentConsumptions?: Consumption[];
  barSettings?: { isOfficiallyOpen: boolean; updatedAt: string };
};

const demoRoles: Role[] = ["ADMIN", "MANAGER", "USER"];
const date = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));

export function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("overview");
  const [countValues, setCountValues] = useState<Record<string, number>>({});
  const [shoppingSource, setShoppingSource] = useState<"inventory" | "new">("inventory");

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", "x-bonanzbar-token": token ?? "", ...(init?.headers ?? {}) },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Anfrage fehlgeschlagen.");
    return body;
  };
  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await request("/api/bootstrap");
      setData(result);
      setCountValues(Object.fromEntries(result.inventory.map((item: Item) => [item.id, item.onHand])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (token) void refresh(); }, [token]);

  const signIn = async (role: Role) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setToken(body.token);
      setMessage(`Als lokale Demo-Rolle „${roleLabels[role]}“ angemeldet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>, path: string, payload: (form: HTMLFormElement) => unknown) => {
    event.preventDefault();
    try {
      await request(path, { method: "POST", body: JSON.stringify(payload(event.currentTarget)) });
      event.currentTarget.reset();
      setMessage("Gespeichert.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  };
  const deactivate = async (path: string, label: string) => {
    try {
      await request(path, { method: "PATCH", body: JSON.stringify({ active: false }) });
      setMessage(`${label} wurde deaktiviert.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Datensatz konnte nicht aktualisiert werden.");
    }
  };

  const lowStock = useMemo(() => data?.inventory.filter((item) => item.onHand <= item.reorderLevel) ?? [], [data]);
  if (!token || !data) {
    return (
      <main className="auth-shell">
        <section className="hero">
          <img className="hero-logo" src="/bonanzbar-logo.png" alt="Bonanzbar" />
          <p className="eyebrow">BONANZBAR / INVENTARVERWALTUNG</p>
          <h1>Entspannt ausschenken.</h1>
          <p>Ein Ort für Bestand, Mitgliedskonten und den nächsten Einkauf.</p>
        </section>
        <section className="login-card">
          <span className="pill">Lokale Entwicklung</span>
          <h2>Zur Bar</h2>
          <p>Wähle eine vorbereitete Rolle, um ihre Berechtigungen auszuprobieren.</p>
          <div className="role-grid">
            {demoRoles.map((role) => <button key={role} disabled={loading} onClick={() => void signIn(role)}>{roleLabels[role]}<small>{role === "ADMIN" ? "Inventar & Mitglieder" : role === "MANAGER" ? "Betrieb & Auswertungen" : "Meine Getränke"}</small></button>)}
          </div>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  const role = data.user.role;
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const isMember = role === "USER";
  const navigation = isAdmin
    ? [["overview", "Übersicht"], ["inventory", "Inventar"], ["users", "Mitglieder"], ["pricing", "Preise"]]
    : isManager
      ? [["overview", "Übersicht"], ["count", "Neue Zählung"], ["shopping", "Einkauf"], ["bills", "Rechnungen"], ["reports", "Verkaufsbericht"]]
      : [["overview", "Verfügbare Getränke"], ["consume", "Getränk eintragen"]];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><img className="brand-logo" src="/bonanzbar-logo.png" alt="Bonanzbar" /></div>
        <div className="identity"><span>{data.user.name}</span><b>{roleLabels[role]}</b><button className="text-button" onClick={() => { setToken(null); setData(null); }}>Demo wechseln</button></div>
      </header>
      <nav>{navigation.map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {message && <p className="notice app-notice">{message}</p>}

      {tab === "overview" && <section className="content">
        <div className="section-heading"><div><p className="eyebrow">HEUTE IM ÜBERBLICK</p><h1>{isMember ? "Was ist noch da?" : "Die Bar im Fluss halten"}</h1></div><button className="primary" onClick={() => void refresh()} disabled={loading}>{loading ? "Lädt..." : "Aktualisieren"}</button></div>
        <div className="metrics">
          <Metric label="Aktive Artikel" value={String(data.inventory.length)} />
          <Metric label="Nachbestellen" value={String(lowStock.length)} accent={lowStock.length > 0} />
          <Metric label="Letzte Zählung" value={data.latestCount ? date(data.latestCount.countedAt) : "Noch nicht gezählt"} />
        </div>
        {!isMember && lowStock.length > 0 && <section className="panel alert"><h2>Nachbestellung im Blick</h2>{lowStock.map((item) => <p key={item.id}>{item.name}: noch <b>{item.onHand} {item.unit}</b>; nachbestellen ab {item.reorderLevel}.</p>)}</section>}
        <section className="panel"><h2>Inventarübersicht</h2><InventoryTable items={data.inventory} /></section>
        {isManager && <ManagerOverview data={data} />}
        {isMember && <RecentConsumptions consumptions={data.recentConsumptions ?? []} />}
      </section>}

      {isAdmin && tab === "inventory" && <section className="content"><section className="two-column"><section className="panel"><h1>Inventarartikel hinzufügen</h1><form onSubmit={(event) => void submit(event, "/api/inventory", (form) => ({ name: value(form, "name"), category: value(form, "category"), unit: value(form, "unit"), reorderLevel: Number(value(form, "reorderLevel")), priceCents: Math.round(Number(value(form, "publicPrice")) * 100), helperPriceCents: Math.round(Number(value(form, "helperPrice")) * 100) }))}><Field name="name" label="Name" /><Field name="category" label="Kategorie" /><Field name="unit" label="Einheit" initial="Flasche" /><Field name="reorderLevel" label="Meldebestand" type="number" initial="0" /><Field name="publicPrice" label="Regulärer Preis (EUR)" type="number" step="0.01" initial="0" /><Field name="helperPrice" label="Helferpreis (EUR)" type="number" step="0.01" initial="0" /><button className="primary">Artikel hinzufügen</button></form></section><EditableInventoryCatalog items={data.inventory} request={request} setMessage={setMessage} onUpdated={refresh} /></section><PendingInventoryApprovals items={data.pendingInventoryItems ?? []} request={request} setMessage={setMessage} onApproved={refresh} /></section>}
      {isAdmin && tab === "users" && <section className="content two-column"><section className="panel"><h1>Mitglied hinzufügen</h1><form onSubmit={(event) => void submit(event, "/api/users", (form) => ({ name: value(form, "name"), email: value(form, "email"), role: value(form, "role"), priceMode: value(form, "priceMode") }))}><Field name="name" label="Name" /><Field name="email" label="E-Mail" type="email" /><label>Rolle<select name="role"><option value="USER">Mitglied</option><option value="MANAGER">Barleitung</option><option value="ADMIN">Administration</option></select></label><PriceModeSelect name="priceMode" /><button className="primary">Konto anlegen</button></form></section><section className="panel"><h2>Mitglieder</h2>{(data.users ?? []).map((user) => <div className="row" key={user.id}><span><b>{user.name}</b><small>{user.email} · {user.priceMode && priceModeLabels[user.priceMode]}</small></span><span><span className="pill">{user.role && roleLabels[user.role]}</span>{user.active && user.id !== data.user.id && <button className="text-button inline-action" onClick={() => void deactivate(`/api/users/${user.id}`, user.name)}>Deaktivieren</button>}</span></div>)}</section></section>}
      {isAdmin && tab === "pricing" && <PricingAdministration settings={data.barSettings ?? { isOfficiallyOpen: false, updatedAt: "" }} users={data.users ?? []} request={request} setMessage={setMessage} onUpdated={refresh} />}

      {isManager && tab === "count" && <section className="content"><section className="panel"><h1>Bestandszählung abschließen</h1><p className="muted">Die Zählung wird als unveränderbare Grundlage für Auswertungen gespeichert. Die Mengen entsprechen zunächst der letzten Zählung.</p><form onSubmit={(event) => void submit(event, "/api/counts", (form) => ({ label: value(form, "label"), notes: value(form, "notes"), lines: data.inventory.map((item) => ({ itemId: item.id, quantity: countValues[item.id] ?? 0 })) }))}><Field name="label" label="Name der Zählung" initial={`Zählung ${new Date().toLocaleDateString("de-DE")}`} /><label>Notizen<textarea name="notes" rows={2} /></label><div className="count-grid">{data.inventory.map((item) => <label key={item.id}>{item.name}<input type="number" min="0" value={countValues[item.id] ?? 0} onChange={(event) => setCountValues({ ...countValues, [item.id]: Number(event.target.value) })} /><small>{item.unit}</small></label>)}</div><button className="primary">Zählung abschließen</button></form></section></section>}
      {isManager && tab === "shopping" && <section className="content two-column"><section className="panel"><h1>Einkaufsliste erstellen</h1><form onSubmit={(event) => void submit(event, "/api/shopping-lists", (form) => { const itemId = value(form, "itemId"); const item = data.inventory.find((candidate) => candidate.id === itemId); return { title: value(form, "title"), items: [shoppingSource === "inventory" ? { itemId, name: item?.name ?? "", quantity: Number(value(form, "quantity")) } : { name: value(form, "newItemName"), quantity: Number(value(form, "quantity")) }] }; })}><Field name="title" label="Name der Liste" initial="Neue Nachbestellung" /><fieldset className="shopping-source"><legend>Artikelquelle</legend><label><input type="radio" checked={shoppingSource === "inventory"} onChange={() => setShoppingSource("inventory")} />Aus Inventar auswählen</label><label><input type="radio" checked={shoppingSource === "new"} onChange={() => setShoppingSource("new")} />Neuen Artikel eingeben</label></fieldset>{shoppingSource === "inventory" ? <label>Inventarartikel<select name="itemId">{data.inventory.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label> : <><Field name="newItemName" label="Neuer Artikel" /><p className="muted">Der Artikel erscheint erst nach Freigabe durch die Administration in der Inventur.</p></>}<Field name="quantity" label="Menge" type="number" initial="1" /><button className="primary">Liste erstellen</button></form></section><ShoppingLists lists={data.shoppingLists ?? []} request={request} setMessage={setMessage} onUpdated={refresh} /></section>}
      {isManager && tab === "bills" && <section className="content two-column"><section className="panel"><h1>Rechnung erstellen</h1><form onSubmit={(event) => void submit(event, "/api/bills", (form) => ({ recipientId: value(form, "recipientId"), dueAt: new Date(`${value(form, "dueDate")}T12:00:00.000Z`).toISOString(), lines: [{ itemId: value(form, "itemId"), quantity: Number(value(form, "quantity")) }] }))}><label>Mitglied<select name="recipientId">{(data.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>Artikel<select name="itemId">{data.inventory.map((item) => <option value={item.id} key={item.id}>{item.name} — regulär {formatCurrency(item.priceCents)}, Helfer {formatCurrency(item.helperPriceCents)}</option>)}</select></label><p className="muted">Der Rechnungspreis wird beim Erstellen anhand der Preisregel des Mitglieds und des aktuellen Betriebsmodus festgelegt.</p><Field name="quantity" label="Menge" type="number" initial="1" /><Field name="dueDate" label="Fällig am" type="date" initial={new Date(Date.now() + 12096e5).toISOString().slice(0, 10)} /><button className="primary">Rechnung ausstellen</button></form></section><section className="panel"><h2>Letzte Rechnungen</h2>{(data.bills ?? []).map((bill) => <div className="row" key={bill.id}><span><b>{bill.recipient.name}</b><small>{bill.lines.map((line) => `${line.quantity}× ${line.description}`).join(", ")}</small></span><b>{formatCurrency(bill.totalCents)}</b></div>)}</section></section>}
      {isManager && tab === "reports" && <SalesReport counts={data.counts ?? []} request={request} setMessage={setMessage} />}
      {isMember && tab === "consume" && <section className="content"><section className="panel"><h1>Getränk eintragen</h1><p className="muted">Der Eintrag wird deinem Konto zugeordnet und kann in die nächste Rechnung übernommen werden.</p><form onSubmit={(event) => void submit(event, "/api/consumptions", (form) => ({ itemId: value(form, "itemId"), quantity: Number(value(form, "quantity")) }))}><label>Was hattest du?<select name="itemId">{data.inventory.map((item) => <option value={item.id} key={item.id}>{item.name} — {formatCurrency(item.effectivePriceCents)}</option>)}</select></label><Field name="quantity" label="Menge" type="number" initial="1" /><button className="primary">Zu meinem Konto hinzufügen</button></form></section></section>}
    </main>
  );
}

function value(form: HTMLFormElement, name: string) { return String(new FormData(form).get(name) ?? ""); }
function Field({ name, label, type = "text", initial, step }: { name: string; label: string; type?: string; initial?: string; step?: string }) { return <label>{label}<input name={name} type={type} defaultValue={initial} step={step} required /></label>; }
function PriceModeSelect({ name, initial = "DYNAMIC" }: { name: string; initial?: PriceMode }) { return <label>Preisregel<select name={name} defaultValue={initial}>{priceModes.map((mode) => <option value={mode} key={mode}>{priceModeLabels[mode]}</option>)}</select></label>; }
function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div className={`metric ${accent ? "metric-alert" : ""}`}><small>{label}</small><strong>{value}</strong></div>; }
function InventoryTable({ items, onDeactivate }: { items: Item[]; onDeactivate?: (item: Item) => void }) { return <div className="table">{items.map((item) => <div className="table-row" key={item.id}><span><b>{item.name}</b><small>{item.category} · {formatCurrency(item.effectivePriceCents)}</small></span><span className={item.onHand <= item.reorderLevel ? "low" : ""}>{item.onHand} <small>{item.unit}</small>{onDeactivate && <button className="text-button inline-action" onClick={() => onDeactivate(item)}>Ausmustern</button>}</span></div>)}</div>; }
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
          reorderLevel: Number(value(form, "reorderLevel")),
          priceCents: Math.round(Number(value(form, "publicPrice")) * 100),
          helperPriceCents: Math.round(Number(value(form, "helperPrice")) * 100),
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

  return <section className="panel"><h2>Aktueller Katalog</h2><p className="muted">Artikel lassen sich direkt bearbeiten. Änderungen gelten für künftige Zählungen und Rechnungen.</p><div className="editable-inventory">{items.map((item) => editingId === item.id ? <form className="inventory-edit-form" key={item.id} onSubmit={(event) => void update(event, item)}><div className="edit-heading"><b>{item.name} bearbeiten</b><button type="button" className="text-button" onClick={() => setEditingId(null)}>Abbrechen</button></div><div className="approval-fields"><Field name="name" label="Name" initial={item.name} /><Field name="category" label="Kategorie" initial={item.category} /><Field name="unit" label="Einheit" initial={item.unit} /><Field name="reorderLevel" label="Meldebestand" type="number" initial={String(item.reorderLevel)} /><Field name="publicPrice" label="Regulärer Preis (EUR)" type="number" step="0.01" initial={(item.priceCents / 100).toFixed(2)} /><Field name="helperPrice" label="Helferpreis (EUR)" type="number" step="0.01" initial={(item.helperPriceCents / 100).toFixed(2)} /></div><button className="primary">Änderungen speichern</button></form> : <div className="editable-inventory-row" key={item.id}><span><b>{item.name}</b><small>{item.category} · {item.unit} · Meldebestand: {item.reorderLevel}</small></span><span className="catalog-actions"><b>Regulär: {formatCurrency(item.priceCents)}</b><small>Helfer: {formatCurrency(item.helperPriceCents)}</small><button type="button" className="text-button" onClick={() => setEditingId(item.id)}>Bearbeiten</button><button type="button" className="text-button danger-action" onClick={() => void retire(item)}>Ausmustern</button></span></div>)}</div></section>;
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

  return <section className="panel"><h2>Neue Artikel für Inventur freigeben</h2><p className="muted">Freie Positionen aus Einkaufslisten können hier erst bearbeitet und anschließend für künftige Inventuren freigegeben werden.</p>{items.length === 0 ? <p className="muted">Keine neuen Artikel warten auf Freigabe.</p> : <div className="approval-list">{items.map((item) => <form className="approval-form" key={item.id} onSubmit={(event) => void saveDraft(event, item.id)}><div className="approval-heading"><span><b>{item.name}</b><small>{item.quantity}× auf „{item.list.title}“ {item.list.status === "PURCHASED" ? "eingekauft" : "offen"}</small></span><span className="pill">Noch nicht im Inventar</span></div><div className="approval-fields"><Field name="name" label="Name" initial={item.name} /><Field name="category" label="Kategorie" initial={item.proposedCategory ?? "Sonstiges"} /><Field name="unit" label="Einheit" initial={item.proposedUnit ?? "Flasche"} /><Field name="reorderLevel" label="Meldebestand" type="number" initial={String(item.proposedReorderLevel ?? 0)} /><Field name="price" label="Regulärer Preis (EUR)" type="number" step="0.01" initial={((item.proposedPriceCents ?? 0) / 100).toFixed(2)} /><Field name="helperPrice" label="Helferpreis (EUR)" type="number" step="0.01" initial={((item.proposedHelperPriceCents ?? 0) / 100).toFixed(2)} /></div><div className="approval-actions"><button className="secondary">Änderungen speichern</button><button type="button" className="primary" onClick={() => void approve(item.id)}>Für Inventur freigeben</button></div></form>)}</div>}</section>;
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
function RecentConsumptions({ consumptions }: { consumptions: Consumption[] }) { return <section className="panel"><h2>Meine letzten Einträge</h2>{consumptions.length ? consumptions.map((entry) => <div className="row" key={entry.id}><span>{entry.quantity}× {entry.item.name}<small>{date(entry.occurredAt)}</small></span><b>{formatCurrency(entry.quantity * entry.unitCents)}</b></div>) : <p className="muted">Noch keine Getränke eingetragen.</p>}</section>; }
function SalesReport({ counts, request, setMessage }: { counts: Count[]; request: (path: string, init?: RequestInit) => Promise<unknown>; setMessage: (value: string) => void }) {
  const [report, setReport] = useState<{ sold: { name: string; quantity: number; unit: string; revenueCents: number }[]; totalRevenueCents: number; methodology: string } | null>(null);
  const run = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; try { const body = await request(`/api/reports/sold?fromCountId=${value(form, "from")}&toCountId=${value(form, "to")}`) as typeof report; setReport(body); } catch (error) { setMessage(error instanceof Error ? error.message : "Bericht konnte nicht erstellt werden."); } };
  return <section className="content two-column"><section className="panel"><h1>Verkaufsbericht</h1><form onSubmit={(event) => void run(event)}><label>Eröffnungszählung<select name="from">{[...counts].reverse().map((count) => <option value={count.id} key={count.id}>{count.label} · {date(count.countedAt)}</option>)}</select></label><label>Abschlusszählung<select name="to">{counts.map((count) => <option value={count.id} key={count.id}>{count.label} · {date(count.countedAt)}</option>)}</select></label><button className="primary" disabled={counts.length < 2}>Bericht erstellen</button></form></section><section className="panel"><h2>Ergebnis</h2>{report ? <><div className="metric"><small>Geschätzter Verkaufswert</small><strong>{formatCurrency(report.totalRevenueCents)}</strong></div>{report.sold.map((line) => <div className="row" key={line.name}><span>{line.name}<small>{line.quantity} {line.unit} verkauft</small></span><b>{formatCurrency(line.revenueCents)}</b></div>)}<p className="muted">{report.methodology}</p></> : <p className="muted">Wähle zwei abgeschlossene Zählungen in zeitlicher Reihenfolge.</p>}</section></section>;
}
