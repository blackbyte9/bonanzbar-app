# Bonanzbar

Bonanzbar ist ein TypeScript-Monorepo für den Betrieb einer gemeinschaftlich genutzten Bar: Inventarkatalog, Bestandszählungen, Einkauf, Mitgliederrechnungen und Verkaufsberichte.

| Arbeitsbereich | Zweck |
|---|---|
| `apps/web` | Next.js-Betriebsdashboard und HTTP-API |
| `apps/mobile` | Expo-/React-Native-Begleit-App für iOS und Android |
| `packages/shared` | Rollenrechte, Domänentypen und Formatierungswerkzeuge |

## Architektur und Umgebungen

Die Web-App wird mit Vercel und einer über den Vercel Marketplace verbundenen Neon-PostgreSQL-Datenbank betrieben. Prisma verwendet die Projektvariable `DATABASE_URL`. Falls die Neon-Integration zusätzlich `DB_*`-Variablen anlegt, bleiben diese unverändert; setze oder verweise `DATABASE_URL` je Umgebung auf die passende Neon-Verbindungs-URL.

| Umgebung | Git-Auslöser | Datenbank |
|---|---|---|
| Development | Lokaler Start | Dauerhafter Neon-Branch `development` |
| Preview | Push auf einen Branch außer `main` oder Pull Request | Automatischer, isolierter Neon-Branch je Vorschau |
| Production | Push auf `main` | Primärer Neon-Produktions-Branch |

Preview-Branches dürfen niemals für echte Bar-Daten verwendet werden. Sie dienen ausschließlich Tests, Abnahmen und Pull-Request-Vorschauen.

## Lokale Entwicklung

**Voraussetzungen:** Node.js 20.18+, npm und ein Neon-Branch für die Entwicklung.

Erstelle `apps/web/.env.local` anhand von `apps/web/.env.example`. Trage die URL des Neon-Entwicklungs-Branchs als `DATABASE_URL` ein. Setze zusätzlich einen eigenen `AUTH_SECRET` mit mindestens 32 zufälligen Zeichen. Diese Datei bleibt lokal und wird nicht eingecheckt.

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:web
```

`npm run db:migrate` erstellt ausschließlich für die Entwicklungsdatenbank neue Migrationen. `npm run db:seed` löscht deren Inhalt und legt die Beispieldaten neu an; gegen Production darf dieser Befehl niemals ausgeführt werden.

Öffne anschließend [http://localhost:3000](http://localhost:3000). In der lokalen Entwicklung stehen vorbereitete Demo-Rollen zur Verfügung:

| Rolle | Lokales Konto | Berechtigungen |
|---|---|---|
| Administration | Ada Administration | Inventar und Mitgliederkonten verwalten |
| Barleitung | Max Barleitung | Bestandszählungen, Einkaufslisten, Rechnungen und Verkaufsberichte zwischen zwei Zählungen |
| Mitglied | Mia Mitglied | Verfügbares Inventar sehen und den eigenen Konsum erfassen |

Die drei Demo-Konten verwenden bei der Passwortanmeldung jeweils `bonanzbar-demo`. Die Rollen-Auswahl mit Demo-Token existiert nur außerhalb der Produktionsumgebung und kann lokal mit `DEMO_AUTH_ENABLED=false` deaktiviert werden.

Starte die mobile App in einem weiteren Terminal:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.x.x:3000" # LAN-Adresse des Computers für ein physisches Gerät verwenden
npm run dev:mobile
```

Für einen Android-Emulator ist der Host üblicherweise über `http://10.0.2.2:3000` erreichbar; für den iOS-Simulator verwende `http://localhost:3000`. Ohne `EXPO_PUBLIC_API_URL` verwendet die App standardmäßig localhost. Produktive mobile Builds verwenden dieselbe E-Mail-/Passwortanmeldung wie die Web-App.

## Autorisierung und Sicherheitsgrenzen

Die API überprüft jede Änderung serverseitig; die Oberfläche ist nur eine Bedienhilfe. Die Rollenauswahl wird nie an Geschäftslogik-Endpunkte übergeben:

- Das Anlegen von Inventarartikeln und Benutzern erfordert `ADMIN`.
- Bestandszählungen, Einkaufslisten, Rechnungen und Verkaufsberichte erfordern `MANAGER`.
- Konsumeinträge verwenden immer die Identität des angemeldeten Benutzers, niemals eine vom Client übermittelte Benutzer-ID.
- Einzelpreise für Rechnungen berechnet der Server anhand des Inventars und der Preisregel; der Client kann Preise nicht manipulieren.
- Zod validiert jede Änderungsanfrage und Prisma parametrisiert alle Datenbankzugriffe.

In Preview und Production melden sich Benutzer mit E-Mail-Adresse und Passwort an. Passwörter werden mit scrypt gehasht gespeichert. Die Anmeldung erzeugt eine acht Stunden gültige, signierte HTTP-only-Sitzung mit `Secure`- und `SameSite=Strict`-Cookie. Die mobile App nutzt einen gleich kurzlebigen Bearer-Token. Ändernde Cookie-Anfragen prüfen zusätzlich die Herkunft der Anfrage.

Setze je Umgebung einen eigenen `AUTH_SECRET` mit mindestens 32 zufälligen Zeichen. Verwende in Production niemals den Beispielwert aus der `.env.example`.

Der erste Administrationszugang ist geschützt: Setze ausschließlich für Production die Vercel-Variable `INITIAL_ADMIN_SETUP_TOKEN` auf einen langen, zufälligen Einmalwert. Nach dem ersten Deployment kann der Wert auf der Anmeldeseite über **„Erstzugang einrichten“** verwendet werden. Entferne die Variable danach wieder in Vercel und starte ein neues Deployment. Die Datenbank verhindert unabhängig davon einen zweiten Erstzugang.

## Neue Artikel aus Einkaufslisten

Die Barleitung kann beim Erstellen einer Einkaufsliste zwischen einem bekannten Inventarartikel und **„Neuen Artikel eingeben“** wählen. Ein frei eingegebener Artikel bleibt zunächst ausschließlich eine Einkaufsposition und erscheint nicht in Bestandszählungen oder der Inventarliste.

Unter **Inventar → Neue Artikel für Inventur freigeben** kann die Administration zunächst Name, Kategorie, Einheit, Meldebestand und Preis als Entwurf bearbeiten und speichern. Erst die anschließende Freigabe legt den Artikel im Inventarkatalog an und nimmt ihn in künftige Inventuren auf. Die Beispieldaten enthalten mit **Tonic Water** bereits eine solche noch nicht freigegebene Einkaufsposition.

## Zwei Getränkepreise und Preisregeln

Jeder Inventarartikel hat einen **regulären Preis** für den offiziellen Betrieb und einen **Helferpreis**. Unter **Preise** wählt die Administration den aktuellen Betriebsmodus:

- **Offiziell geöffnet:** Personen mit „Nach Betriebsmodus“ zahlen den regulären Preis.
- **Helferbetrieb:** Personen mit „Nach Betriebsmodus“ zahlen den Helferpreis.

Zusätzlich kann die Administration pro Person wählen, ob sie immer den regulären Preis, immer den Helferpreis oder den vom Betriebsmodus abhängigen Preis erhält. Diese Einstellung wird beim Anlegen eines Mitglieds gesetzt und unter **Preise** jederzeit geändert. Beim Eintragen eines Getränks und beim Erstellen einer Rechnung wird der passende Preis serverseitig berechnet und als Einzelpreis gespeichert; spätere Preis- oder Modusänderungen verändern abgeschlossene Einträge nicht.

Der Betriebsmodus ist in dieser ersten Version absichtlich ein expliziter Admin-Schalter, da keine festen Öffnungszeiten vorgegeben wurden. Dadurch kann er auch bei Sonderveranstaltungen, Aufbau oder Abbau zuverlässig gesetzt werden.

## Bereitstellung mit Vercel

1. Importiere `blackbyte9/bonanzbar-app` als Vercel-Projekt, wähle **Root Directory** `apps/web` und das Framework **Next.js**.
2. Setze den Build-Befehl auf `npm run build`. Dieser führt `prisma migrate deploy`, `prisma generate` und anschließend den Next.js-Build aus.
3. Verbinde die Neon-Datenbank in Vercel mit **Production** und **Preview**. Setze `DATABASE_URL` in jeder Umgebung auf die jeweilige Neon-Verbindungs-URL: primärer Neon-Branch für Production, automatischer Neon-Branch für Preview.
4. Setze `AUTH_SECRET` getrennt für Production und Preview. Setze `INITIAL_ADMIN_SETUP_TOKEN` nur für Production und entferne ihn nach dem Erstzugang.
5. Stelle sicher, dass der erste Deployment-Branch `main` ist. Die Migration `20260912110000_initial_postgresql` wird beim ersten Production-Build automatisch auf den neuen Neon-Branch angewandt.
6. Füge unter **Settings → Domains** `app.bonanzbar.de` hinzu. Strato benötigt dafür den von Vercel angezeigten CNAME-Eintrag für die Subdomain. Vercel richtet das TLS-Zertifikat ein.

Nach Änderungen an Vercel-Variablen muss ein neues Deployment gestartet werden, weil bereits existierende Deployments keine neuen Werte übernehmen.

## Nützliche Befehle

```powershell
npm run typecheck
npm run build
npm run db:deploy
npm run db:seed
npm run dev:web
npm run dev:mobile
```
