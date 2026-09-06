# Bonanzbar

Bonanzbar ist ein TypeScript-Monorepo für den Betrieb einer gemeinschaftlich genutzten Bar: Inventarkatalog, Bestandszählungen, Einkauf, Mitgliederrechnungen und Verkaufsberichte.

| Arbeitsbereich | Zweck |
|---|---|
| `apps/web` | Next.js-Betriebsdashboard und HTTP-API |
| `apps/mobile` | Expo-/React-Native-Begleit-App für iOS und Android |
| `packages/shared` | Rollenrechte, Domänentypen und Formatierungswerkzeuge |

## Schnellstart

**Voraussetzungen:** Node.js 20.18+ und npm. Die erste Anwendungsversion benötigt weder Docker noch externe Dienste.

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:web
```

Öffne anschließend [http://localhost:3000](http://localhost:3000). Der lokale Anmeldebildschirm enthält bewusst vorbereitete Konten für Administration, Barleitung und Mitglied, damit jede Rolle ausprobiert werden kann:

| Rolle | Lokales Konto | Berechtigungen |
|---|---|---|
| Administration | Ada Administration | Inventar und Mitgliederkonten verwalten |
| Barleitung | Max Barleitung | Bestandszählungen, Einkaufslisten, Rechnungen und Verkaufsberichte zwischen zwei Zählungen |
| Mitglied | Mia Mitglied | Verfügbares Inventar sehen und den eigenen Konsum erfassen |

Starte die mobile App in einem weiteren Terminal:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.x.x:3000" # LAN-Adresse des Computers für ein physisches Gerät verwenden
npm run dev:mobile
```

Für einen Android-Emulator ist der Host üblicherweise über `http://10.0.2.2:3000` erreichbar; für den iOS-Simulator verwende `http://localhost:3000`. Ohne `EXPO_PUBLIC_API_URL` verwendet die App standardmäßig localhost.

## Autorisierung und Sicherheitsgrenzen

Die API überprüft jede Änderung serverseitig; die Oberfläche ist nur eine Bedienhilfe. Die Rollenauswahl wird nie an Geschäftslogik-Endpunkte übergeben:

- Das Anlegen von Inventarartikeln und Benutzern erfordert `ADMIN`.
- Bestandszählungen, Einkaufslisten, Rechnungen und Verkaufsberichte erfordern `MANAGER`.
- Konsumeinträge verwenden immer die Identität des angemeldeten Benutzers, niemals eine vom Client übermittelte Benutzer-ID.
- Einzelpreise für Rechnungen berechnet der Server anhand des Inventars und der Preisregel; der Client kann Preise nicht manipulieren.
- Zod validiert jede Änderungsanfrage und Prisma parametrisiert alle Datenbankzugriffe.

Die lokale Rollenauswahl verwendet absichtlich Bearer-Token nur für die Entwicklung, damit die Grundlage sofort ausprobiert werden kann. `POST /api/auth/demo` gibt unter `NODE_ENV=production` den Status 404 zurück und kann lokal mit `DEMO_AUTH_ENABLED=false` deaktiviert werden. Dies ist **keine** Produktionsauthentifizierung. Vor dem Produktivbetrieb muss `lib/auth.ts` durch eine echte Identitätsanbieter-/Sitzungsintegration ersetzt werden. Entferne die lokalen Demo-Token, erzwinge HTTPS-Cookies oder kurzlebige Bearer-Token und setze ein starkes `AUTH_SECRET`.

## Neue Artikel aus Einkaufslisten

Die Barleitung kann beim Erstellen einer Einkaufsliste zwischen einem bekannten Inventarartikel und **„Neuen Artikel eingeben“** wählen. Ein frei eingegebener Artikel bleibt zunächst ausschließlich eine Einkaufsposition und erscheint nicht in Bestandszählungen oder der Inventarliste.

Unter **Inventar → Neue Artikel für Inventur freigeben** kann die Administration zunächst Name, Kategorie, Einheit, Meldebestand und Preis als Entwurf bearbeiten und speichern. Erst die anschließende Freigabe legt den Artikel im Inventarkatalog an und nimmt ihn in künftige Inventuren auf. Die lokalen Beispieldaten enthalten mit **Tonic Water** bereits eine solche noch nicht freigegebene Einkaufsposition.

## Zwei Getränkepreise und Preisregeln

Jeder Inventarartikel hat einen **regulären Preis** für den offiziellen Betrieb und einen **Helferpreis**. Unter **Preise** wählt die Administration den aktuellen Betriebsmodus:

- **Offiziell geöffnet:** Personen mit „Nach Betriebsmodus“ zahlen den regulären Preis.
- **Helferbetrieb:** Personen mit „Nach Betriebsmodus“ zahlen den Helferpreis.

Zusätzlich kann die Administration pro Person wählen, ob sie immer den regulären Preis, immer den Helferpreis oder den vom Betriebsmodus abhängigen Preis erhält. Diese Einstellung wird beim Anlegen eines Mitglieds gesetzt und unter **Preise** jederzeit geändert. Beim Eintragen eines Getränks und beim Erstellen einer Rechnung wird der passende Preis serverseitig berechnet und als Einzelpreis gespeichert; spätere Preis- oder Modusänderungen verändern abgeschlossene Einträge nicht.

Der Betriebsmodus ist in dieser ersten Version absichtlich ein expliziter Admin-Schalter, da keine festen Öffnungszeiten vorgegeben wurden. Dadurch kann er auch bei Sonderveranstaltungen, Aufbau oder Abbau zuverlässig gesetzt werden.

## Persistenz und Migrationsweg für den Produktivbetrieb

Die Entwicklung verwendet Prisma mit einer lokalen SQLite-Datei unter `apps/web/prisma/dev.db`: ohne weitere Konfiguration, mit typisierten Abfragen, Schemamigrationen und Daten, die Neustarts überstehen. Inventarmengen sind Momentaufnahmen in unveränderlichen `StockCount`-Einträgen. Der Verkaufsbericht berechnet für jeden Artikel den Abgang zwischen zwei abgeschlossenen Zählungen und weist derzeit darauf hin, dass Nachlieferungen noch nicht gegengerechnet werden.

Für den Produktivbetrieb kann Prisma dasselbe Modell und relationale Datenbankdesign weiterverwenden. Eine MariaDB-Datenbank wird durch Primas `mysql`-Datenquellenanbieter unterstützt; eine separate MySQL-Datenbank ist nicht erforderlich. Setze den Anbieter vor dem ersten Produktiv-Rollout auf `mysql` und hinterlege `DATABASE_URL` im Format `mysql://BENUTZER:PASSWORT@HOST:3306/DATENBANK`.

Die vorhandenen Migrationen sind für die lokale SQLite-Entwicklung erstellt und können nicht direkt auf MariaDB angewendet werden. Erzeuge vor dem ersten MariaDB-Rollout deshalb aus dem aktuellen Prisma-Schema eine neue MariaDB-Ausgangsmigration und wende diese in der CI-Umgebung mit `prisma migrate deploy` an. Behalte entweder ein separates SQLite-Schema für die lokale Entwicklung bei oder stelle auch die Entwicklungsumgebung auf MariaDB um. Importiere vorhandene SQLite-Daten nur einmalig nach SQL und führe `prisma migrate dev` nicht in der Produktionsumgebung aus.

## Spätere Bereitstellung bei Strato

Die Web-App ist mit Next.js `output: "standalone"` konfiguriert, sodass `npm run build` ein kompaktes Node-Bereitstellungspaket erzeugt. Prüfe, dass das gewählte Strato-Paket einen dauerhaft laufenden Node-Prozess und eine verwaltete SQL-Datenbank unterstützt; Pakete für rein statische Websites können die API-Endpunkte nicht bereitstellen. Hinterlege Produktionsgeheimnisse über die Verwaltungsoberfläche des Anbieters, nicht in eingecheckten `.env`-Dateien.

## Bereitstellung mit Vercel

Vercel kann die Next.js-Web-App direkt aus dem GitHub-Repository bereitstellen. Die Git-Integration erstellt automatisch Vorschauen für Pull Requests und eine Produktionsbereitstellung für jeden Push auf den Produktions-Branch `main`.

1. Melde dich bei Vercel mit dem GitHub-Konto an und importiere `blackbyte9/bonanzbar-app` als neues Projekt.
2. Wähle als **Root Directory** `apps/web` und als Framework **Next.js**.
3. Setze den Build-Befehl auf `npm run build`. Dieser erzeugt vor dem Next.js-Build den nicht eingecheckten Prisma-Client.
4. Hinterlege die benötigten Umgebungsvariablen ausschließlich in Vercel. Verwende für Vorschauen eine von der Produktionsdatenbank getrennte Datenbank, damit Testdaten keine echten Bestände oder Rechnungen verändern.
5. Füge unter **Settings → Domains** `app.bonanzbar.de` hinzu. Strato muss dafür für die Subdomain den von Vercel angezeigten CNAME-Eintrag erhalten; Vercel richtet das TLS-Zertifikat anschließend selbst ein.

Die lokale SQLite-Datenbank ist nicht für Vercel geeignet, da Serverless-Funktionen keinen dauerhaften lokalen Datenträger bereitstellen. Verwende für Vercel daher eine verwaltete, von außen erreichbare PostgreSQL-Datenbank, beispielsweise Neon über den Vercel Marketplace. Vor dem ersten Rollout muss das Prisma-Schema auf `postgresql` umgestellt und eine neue PostgreSQL-Ausgangsmigration erzeugt werden; die vorhandenen SQLite-Migrationen können nicht wiederverwendet werden.

Die aktuelle Anmeldung ist absichtlich nur für die lokale Entwicklung vorgesehen und wird in der Produktionsumgebung deaktiviert. Vor einer öffentlichen Bereitstellung muss deshalb eine echte Anmeldung mit sicheren Sitzungen und einem in Vercel gesetzten `AUTH_SECRET` ergänzt werden. Führe Datenbankmigrationen anschließend in einer gesonderten, geschützten CI-Aufgabe mit `prisma migrate deploy` aus, nicht während eines Vercel-Builds.

## Nützliche Befehle

```powershell
npm run typecheck
npm run build
npm run db:seed
npm run dev:web
npm run dev:mobile
```
