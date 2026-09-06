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

Für den Produktivbetrieb kann Prisma dasselbe Modell und relationale Datenbankdesign weiterverwenden. Ändere den Prisma-Datenquellenanbieter auf `postgresql` oder einen von Strato unterstützten verwalteten SQL-Dienst, setze `DATABASE_URL`, erstelle und wende die Migration in der CI-Umgebung mit `prisma migrate deploy` an und importiere SQLite-Daten einmalig nach SQL. Führe `prisma migrate dev` nicht in der Produktionsumgebung aus.

## Spätere Bereitstellung bei Strato

Die Web-App ist mit Next.js `output: "standalone"` konfiguriert, sodass `npm run build` ein kompaktes Node-Bereitstellungspaket erzeugt. Prüfe, dass das gewählte Strato-Paket einen dauerhaft laufenden Node-Prozess und eine verwaltete SQL-Datenbank unterstützt; Pakete für rein statische Websites können die API-Endpunkte nicht bereitstellen. Hinterlege Produktionsgeheimnisse über die Verwaltungsoberfläche des Anbieters, nicht in eingecheckten `.env`-Dateien.

## Nützliche Befehle

```powershell
npm run typecheck
npm run build
npm run db:seed
npm run dev:web
npm run dev:mobile
```
