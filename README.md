# Bonanzbar

Bonanzbar is a TypeScript monorepo for running a shared bar: inventory cataloguing, stock counts, purchasing, member tabs, and sales estimates.

| Workspace | Purpose |
|---|---|
| `apps/web` | Next.js operational dashboard and HTTP API |
| `apps/mobile` | Expo / React Native companion for iOS and Android |
| `packages/shared` | Role permissions, domain types, and formatting utilities |

## Quick start

**Prerequisites:** Node.js 20.18+ and npm. The initial application uses no Docker or external services.

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000). The local sign-in screen has intentionally seeded Admin, Manager, and Member accounts so each role can be tested:

| Role | Local account | Scope |
|---|---|---|
| Administration | Ada Administration | Manage inventory and member accounts |
| Barleitung | Max Barleitung | Stock counts, shopping lists, bills, and count-to-count sales reports |
| Mitglied | Mia Mitglied | See available stock and record their own consumption |

Run the mobile app in another terminal:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.x.x:3000" # use your computer's LAN address for a physical device
npm run dev:mobile
```

For an Android emulator, `http://10.0.2.2:3000` normally reaches the host; use `http://localhost:3000` for an iOS simulator. The app defaults to localhost if `EXPO_PUBLIC_API_URL` is not supplied.

## Authorization and security boundaries

The API verifies authorization server-side for every mutation; the UI is only a convenience layer. Role selection never arrives at the business routes:

- Inventory and user creation require `ADMIN`.
- Counts, shopping lists, bills, and sold-item reports require `MANAGER`.
- Consumption records always use the authenticated user identity, never a client-provided user ID.
- Bill line prices are retrieved from the inventory catalog on the server, preventing client-side price changes.
- Zod validates every mutation request and Prisma parameterizes all database access.

The local role selector intentionally uses development-only seeded bearer tokens to make the foundation immediately explorable. `POST /api/auth/demo` returns 404 under `NODE_ENV=production` (and can be disabled locally with `DEMO_AUTH_ENABLED=false`). It is **not** production authentication. Before deployment, replace `lib/auth.ts` with a real identity-provider/session integration, remove local demo tokens, require HTTPS cookies or short-lived bearer tokens, and set a strong `AUTH_SECRET`.

## Neue Artikel aus Einkaufslisten

Die Barleitung kann beim Erstellen einer Einkaufsliste zwischen einem bekannten Inventarartikel und **„Neuen Artikel eingeben“** wählen. Ein frei eingegebener Artikel bleibt zunächst ausschließlich eine Einkaufsposition und erscheint nicht in Bestandszählungen oder der Inventarliste.

Unter **Inventar → Neue Artikel für Inventur freigeben** kann die Administration zunächst Name, Kategorie, Einheit, Meldebestand und Preis als Entwurf bearbeiten und speichern. Erst die anschließende Freigabe legt den Artikel im Inventarkatalog an und nimmt ihn in künftige Inventuren auf. Die lokalen Beispieldaten enthalten mit **Tonic Water** bereits eine solche noch nicht freigegebene Einkaufsposition.

## Zwei Getränkepreise und Preisregeln

Jeder Inventarartikel hat einen **regulären Preis** für den offiziellen Betrieb und einen **Helferpreis**. Unter **Preise** wählt die Administration den aktuellen Betriebsmodus:

- **Offiziell geöffnet:** Personen mit „Nach Betriebsmodus“ zahlen den regulären Preis.
- **Helferbetrieb:** Personen mit „Nach Betriebsmodus“ zahlen den Helferpreis.

Zusätzlich kann die Administration pro Person wählen, ob sie immer den regulären Preis, immer den Helferpreis oder den vom Betriebsmodus abhängigen Preis erhält. Diese Einstellung wird beim Anlegen eines Mitglieds gesetzt und unter **Preise** jederzeit geändert. Beim Eintragen eines Getränks und beim Erstellen einer Rechnung wird der passende Preis serverseitig berechnet und als Einzelpreis gespeichert; spätere Preis- oder Modusänderungen verändern abgeschlossene Einträge nicht.

Der Betriebsmodus ist in dieser ersten Version absichtlich ein expliziter Admin-Schalter, da keine festen Öffnungszeiten vorgegeben wurden. Dadurch kann er auch bei Sonderveranstaltungen, Aufbau oder Abbau zuverlässig gesetzt werden.

## Persistence and production migration

Development uses Prisma with a local SQLite file at `apps/web/prisma/dev.db`: zero configuration, typed queries, schema migrations, and data that survives restarts. Inventory quantities are snapshots in immutable `StockCount` records. The sold-items report calculates each item’s decrease between two finalized counts; the report currently labels that restocks are not yet netted out.

For production, Prisma keeps the same model and relational design. Change the Prisma datasource provider to `postgresql` (or a Strato-supported managed SQL service), set `DATABASE_URL`, create and apply the migration in CI with `prisma migrate deploy`, then run a one-time SQLite-to-SQL import. Do not run `prisma migrate dev` in production.

## Hosting on Strato later

The web app is configured with Next.js `output: "standalone"` so `npm run build` creates a compact Node deployment bundle. Confirm that the selected Strato package supports a persistent Node process and a managed SQL database; static-only packages cannot host the API routes. Supply production secrets through the hosting control panel rather than committed `.env` files.

## Useful commands

```powershell
npm run typecheck
npm run build
npm run db:seed
npm run dev:web
npm run dev:mobile
```
