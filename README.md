# Bonanzbar

Bonanzbar ist ein TypeScript-Monorepo für den Betrieb einer gemeinschaftlich genutzten Bar: Inventarkatalog, Bestandszählungen, Einkauf, Mitgliederrechnungen, Veranstaltungsorganisation und eine öffentliche Programmseite.

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

Erstelle `apps/web/.env.local` anhand von `apps/web/.env.example`. Trage die URL des Neon-Entwicklungs-Branchs als `DATABASE_URL` ein. Setze zusätzlich einen eigenen `AUTH_SECRET` mit mindestens 32 zufälligen Zeichen. Diese Datei bleibt lokal und wird nicht eingecheckt; **kopiere sie nicht nach `.env`**. Next.js lädt `.env.local` mit Vorrang, und die lokalen Prisma-Befehle verwenden sie ebenfalls.

> **Hinweis bei einer lokalen Umstellung von SQLite:** Eine frühere `DATABASE_URL` wie `file:./prisma/dev.db` in `.env` funktioniert nicht mehr, weil die Anwendung PostgreSQL verwendet. Erstelle stattdessen `apps/web/.env.local` mit der PostgreSQL-Verbindungs-URL des Neon-Development-Branches aus Vercel oder Neon. Nach der Änderung den lokalen Server neu starten und einmal `npm run db:deploy` ausführen.

```powershell
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:environment -- development
npm.cmd run db:seed
npm.cmd test
npm.cmd run dev:web
```

`npm.cmd run db:deploy` wendet die bereits im Repository vorhandenen Migrationen auf den Entwicklungs-Branch an. Verwende `npm.cmd run db:migrate` nur, wenn du nach einer Schemaänderung selbst eine neue Migration erstellen möchtest.

Vor dem ersten Seed markierst du den verbundenen Datenbank-Branch explizit:

```powershell
npm.cmd run db:environment -- development
```

Der Befehl zeigt den verbundenen Neon-Endpoint an und speichert den Marker `development` in der Datenbank. Vor jedem Seed kannst du den Zustand rein lesend prüfen:

```powershell
npm.cmd run db:environment -- show
```

Die Ausgabe muss sowohl bei **Erwartete lokale Umgebung** als auch bei **Datenbankmarker** `development` zeigen. `npm.cmd run db:seed` prüft anschließend **beides**: `BONANZBAR_DATABASE_ENVIRONMENT="development"` in `.env.local` und den Datenbankmarker. Weicht einer der Werte ab oder fehlt der Marker, bricht der Seed ab, bevor er Daten löscht. Der Marker wird absichtlich nicht vom Seed selbst gesetzt, damit ein versehentlich auf Production zeigendes `.env.local` nicht automatisch freigegeben wird.

`npm.cmd run db:seed` löscht danach den Inhalt der so markierten Entwicklungsdatenbank und legt die Beispieldaten neu an; gegen Production darf dieser Befehl niemals ausgeführt werden.

Öffne anschließend [http://localhost:3000](http://localhost:3000). In der lokalen Entwicklung stehen vorbereitete Demo-Rollen zur Verfügung:

| Rolle | Lokales Konto | Berechtigungen |
|---|---|---|
| Administration | Ada Administration | Inventar und Mitgliederkonten verwalten |
| Barleitung | Max Barleitung | Bestandszählungen, Einkaufslisten, Rechnungen und Verkaufsberichte zwischen zwei Zählungen |
| Mitglied | Mia Mitglied | Verfügbares Inventar sehen und den eigenen Konsum erfassen |
| Gast | Gina Gast | Tagesangebot und Getränkekarte mit Gastpreisen ansehen |

Die vier Demo-Konten verwenden bei der Passwortanmeldung jeweils `bonanzbar-demo`. Die Rollen-Auswahl mit Demo-Token existiert nur außerhalb der Produktionsumgebung und kann lokal mit `DEMO_AUTH_ENABLED=false` deaktiviert werden.

`npm.cmd test` prüft zusätzlich ohne Datenbankzugriff den Demo-/Produktionsvertrag: Die Demo-Konten müssen dieselben effektiven Rollen und Berechtigungen wie gleich konfigurierte Produktionskonten erhalten; in Production bleibt die Demo-Anmeldung immer deaktiviert.

## Additive Rollen und Vorschau

Konten können mehrere Rollen gleichzeitig haben. In der Mitgliederverwaltung werden die Rollen per Auswahlfeld kombiniert. Die effektiven Rollen werden serverseitig hierarchisch ergänzt: **Administration** erhält zusätzlich **Barleitung**, **Mitglied** und **Gast**; **Barleitung** erhält zusätzlich **Mitglied**. Dadurch kann die Barleitung auch den eigenen Konsum verwalten, während die Administration neben Inventar, Benutzerkonten und Preisen sämtliche Betriebsfunktionen nutzen kann. **Gast** ist bewusst nicht additiv: Ein reines Gastkonto sieht nur die Getränkekarte und kann keine Konsumeinträge oder Betriebsdaten schreiben.

Die Bereiche **Administration**, **Barleitung**, **Mitglied** und **Gast** bleiben in der Oberfläche getrennt. Im Header kann ein Konto mit mehreren Rollen zwischen seinen zugewiesenen Bereichen wechseln; Navigation und Übersicht zeigen anschließend nur die Funktionen der gewählten Rolle. Die serverseitige Berechtigungsprüfung bleibt davon unabhängig und prüft weiterhin alle zugewiesenen Rollen. Eine Rollen-Vorschau im Administrationsbereich setzt zusätzlich einen Request-Header; die API lehnt damit jeden schreibenden Request mit `403` ab. Sie ist nur eine sichere UI-Vorschau und ersetzt keine Berechtigungsprüfung.

In der Administrationsansicht öffnet ein Klick auf einen Eintrag der Mitgliederliste dessen Bearbeitungsformular. Name, E-Mail-Adresse, Passwort, Rollen, Preisregel und Kontostatus können dort aktualisiert werden.

Starte die mobile App in einem weiteren Terminal:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.x.x:3000" # LAN-Adresse des Computers für ein physisches Gerät verwenden
npm.cmd run dev:mobile
```

Für einen Android-Emulator ist der Host üblicherweise über `http://10.0.2.2:3000` erreichbar; für den iOS-Simulator verwende `http://localhost:3000`. Ohne `EXPO_PUBLIC_API_URL` verwendet die App standardmäßig localhost. Produktive mobile Builds verwenden dieselbe E-Mail-/Passwortanmeldung wie die Web-App.

## Mobile Apps veröffentlichen

Die nativen Apps werden mit [Expo Application Services (EAS)](https://expo.dev/eas) gebaut. Die Build-Profile liegen versioniert in `apps/mobile/eas.json`; die Expo-Projekt-ID und alle Zugangsdaten bleiben außerhalb des Repositories.

### Einmalig vorbereiten

1. Richte einen Expo-Account, den [Apple Developer Account](https://developer.apple.com/programs/) und ein [Google-Play-Entwicklerkonto](https://play.google.com/console/signup) ein. Die Bundle- bzw. Paketkennung dieser App ist bereits `com.bonanzbar.app`; registriere sie beim ersten Store-Eintrag genau so.
2. Lege vor dem Store-Build ein undurchsichtiges App-Icon mit mindestens 1.024 × 1.024 Pixeln sowie die erforderlichen Store-Screenshots und Datenschutzhinweise bereit. Hinterlege das Icon anschließend in `apps/mobile/app.json`; veröffentliche keine App mit dem Expo-Standardicon.
3. Initialisiere das Expo-Projekt im Verzeichnis `apps/mobile`. Der folgende Befehl fordert zur Anmeldung auf und schreibt die nicht geheime Expo-Projekt-ID in die App-Konfiguration:

   ```powershell
   Set-Location apps\mobile
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

4. Konfiguriere die öffentliche Production-API für die Builds. Für `app.bonanzbar.de` lautet der Wert beispielsweise:

   ```powershell
   npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://app.bonanzbar.de --environment preview --visibility plaintext
   npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://app.bonanzbar.de --environment production --visibility plaintext
   ```

   `EXPO_PUBLIC_API_URL` ist keine geheime Variable, wird aber beim Build eingebettet. Sie muss auf die produktive HTTPS-Web-App zeigen, niemals auf `localhost`, einen Preview-Branch oder eine Neon-URL.

### Testen und einreichen

1. Erzeuge zuerst einen internen Test-Build:

   ```powershell
   Set-Location apps\mobile
   npx eas-cli@latest build --platform all --profile preview
   ```

   Android erzeugt dabei eine installierbare APK. Für iOS werden zum internen Verteilen registrierte Testgeräte benötigt; alternativ baue direkt das Production-Profil und teste über TestFlight.

2. Erzeuge nach dem Smoke-Test einen Store-Build:

   ```powershell
   npx eas-cli@latest build --platform all --profile production
   ```

   Der Android-Build ist ein `.aab` für Google Play; der iOS-Build ist für App Store Connect vorgesehen. Prüfe vor dem Einreichen insbesondere Production-Anmeldung, Konsumeinträge und die Verbindung zu `https://app.bonanzbar.de`.

3. Lade die iOS-Version mit EAS in App Store Connect hoch und teste sie zuerst in TestFlight:

   ```powershell
   npx eas-cli@latest submit --platform ios --profile production
   ```

   Erstelle zuvor in App Store Connect einen App-Eintrag mit `com.bonanzbar.app`, fülle Datenschutzangaben, Screenshots, Beschreibung und Altersfreigabe aus und reiche erst nach dem TestFlight-Test zur Apple-Prüfung ein.

4. Lade die Android-`.aab` aus dem EAS-Build in der Google Play Console zuerst unter **Interner Test** hoch. Nach erfolgreichem Test erstelle eine Production-Veröffentlichung. Das automatisierte `eas submit` für Android ist optional und benötigt zusätzlich ein Google-Servicekonto.

5. Nach Freigabe trage die tatsächlichen Store-URLs in Vercel ein und redeploye die Web-App:

   ```text
   NEXT_PUBLIC_IOS_APP_URL=https://apps.apple.com/app/id<APPLE_APP_ID>
   NEXT_PUBLIC_ANDROID_APP_URL=https://play.google.com/store/apps/details?id=com.bonanzbar.app
   ```

### Download-Links auf der Anmeldung

Sobald die nativen Apps veröffentlicht sind, können auf der Web-Anmeldung Store-Links angezeigt werden. Setze dazu in Vercel für die jeweilige Umgebung ausschließlich vollständige HTTPS-URLs:

```text
NEXT_PUBLIC_IOS_APP_URL=https://apps.apple.com/...
NEXT_PUBLIC_ANDROID_APP_URL=https://play.google.com/store/apps/details?id=...
```

Die Buttons werden nur für konfigurierte, gültige HTTPS-URLs angezeigt. Nach der Änderung ist ein neues Deployment erforderlich.

## Autorisierung und Sicherheitsgrenzen

Die API überprüft jede Änderung serverseitig; die Oberfläche ist nur eine Bedienhilfe. Die Rollenauswahl wird nie an Geschäftslogik-Endpunkte übergeben:

- Das Anlegen von Inventarartikeln und Benutzern erfordert `ADMIN`.
- Bestandszählungen, Einkaufslisten, Rechnungen, Umlagen, Korrekturentscheidungen und Verkaufsberichte erfordern `MANAGER`.
- Konsumeinträge verwenden immer die Identität des angemeldeten Benutzers, niemals eine vom Client übermittelte Benutzer-ID.
- Gastkonten dürfen keine Konsumeinträge, Social-Wall-Beiträge oder sonstige Betriebsdaten erstellen.
- Einzelpreise für Rechnungen berechnet der Server anhand des Inventars und der Preisregel; der Client kann Preise nicht manipulieren.
- Der globale Datenreset ist ausschließlich für `ADMIN` erreichbar und erfordert zusätzlich die wörtliche Bestätigung `reset`.
- Zod validiert jede Änderungsanfrage und Prisma parametrisiert alle Datenbankzugriffe.

`GET /api/public/events` ist absichtlich die einzige nicht authentifizierte Betriebs-API. Sie liefert ausschließlich veröffentlichte Veranstaltungstermine und freigegebene Rückblicke mit dafür vorgesehenen redaktionellen Feldern. Crew-Notizen, Dienstbewerbungen, Benutzer-, Rollen- und Abrechnungsdaten sind dort nicht enthalten.

In Preview und Production melden sich Benutzer mit E-Mail-Adresse und Passwort an. Passwörter werden mit scrypt gehasht gespeichert. Die Anmeldung erzeugt eine acht Stunden gültige, signierte HTTP-only-Sitzung mit `Secure`- und `SameSite=Strict`-Cookie. Die mobile App nutzt einen gleich kurzlebigen Bearer-Token. Ändernde Cookie-Anfragen prüfen zusätzlich die Herkunft der Anfrage.

Setze je Umgebung einen eigenen `AUTH_SECRET` mit mindestens 32 zufälligen Zeichen. Verwende in Production niemals den Beispielwert aus der `.env.example`.

Der erste Administrationszugang ist geschützt: Setze ausschließlich für Production die Vercel-Variable `INITIAL_ADMIN_SETUP_TOKEN` auf einen langen, zufälligen Einmalwert. Nach dem ersten Deployment kann der Wert auf der Anmeldeseite über **„Erstzugang einrichten“** verwendet werden. Entferne die Variable danach wieder in Vercel und starte ein neues Deployment. Die Datenbank verhindert unabhängig davon einen zweiten Erstzugang.

## Neue Artikel aus Einkaufslisten

Die Barleitung kann beim Erstellen einer Einkaufsliste zwischen einem bekannten Inventarartikel und **„Neuen Artikel eingeben“** wählen. Ein frei eingegebener Artikel bleibt zunächst ausschließlich eine Einkaufsposition und erscheint nicht in Bestandszählungen oder der Inventarliste.

Unter **Inventar → Neue Artikel für Inventur freigeben** kann die Administration zunächst Name, Kategorie, Einheit, Gebindegröße, Meldebestand und Preis als Entwurf bearbeiten und speichern. Erst die anschließende Freigabe legt den Artikel im Inventarkatalog an und nimmt ihn in künftige Inventuren auf. Die Beispieldaten enthalten mit **Tonic Water** bereits eine solche noch nicht freigegebene Einkaufsposition.

## Gebinde und Bestandszählungen

Jeder Inventarartikel hat eine **Gebindegröße**: die Anzahl einzelner Einheiten pro Kasten, Karton oder anderem Gebinde. Beispielsweise hat Pils die Einheit „Flasche“ und die Gebindegröße `20`, Wein üblicherweise `6`; einzelne Spirituosen bleiben bei `1`.

Bei einer Bestandszählung werden für Artikel mit Gebindegröße größer als `1` volle Gebinde und einzelne Restmengen getrennt eingetragen. Die Anwendung speichert daraus ausschließlich die Gesamtzahl einzelner Einheiten. Damit bleiben Verbrauch, Rechnungen und Verkaufsberichte korrekt, auch wenn die Gebindegröße später angepasst wird. Bestehende Artikel und Zählungen werden mit Gebindegröße `1` weitergeführt.

## Zusammenführung mit Bonanzbar Online

Die fachlichen Organisationsfunktionen aus [`blackbyte9/bonanzbar-online`](https://github.com/blackbyte9/bonanzbar-online) werden in diese Anwendung überführt. Diese App bleibt die technische Grundlage: Prisma/Neon speichert normalisierte Daten, die bestehende E-Mail-/Passwort-Anmeldung und die additiven Rollen bleiben maßgeblich. Das parallele Supabase-Auth-System und sein einzelnes JSON-Zustandsdokument werden nicht zusätzlich betrieben.

Die übernommene Grundlage ist das **Veranstaltungsboard mit Dienstbewerbungen**:

- Barleitung erstellt Entwürfe, veröffentlicht oder sagt Veranstaltungen ab und legt Dienste mit einer Sollbesetzung an.
- Mitglieder sehen nur veröffentlichte zukünftige Termine und können ihre offenen Bewerbungen selbst zurückziehen.
- Barleitung bestätigt oder lehnt Bewerbungen ab; die API verhindert eine Bestätigung über die Sollbesetzung hinaus.
- Barleitung veröffentlicht gemeinsame Notizen, ordnet sie bei Bedarf einer Veranstaltung zu und kann wichtige Hinweise anheften; alle Mitglieder sehen die gleichen Notizen.
- Barleitung kann gemeinsame Kosten als **Umlage** centgenau gleichmäßig auf alle aktiven Mitglieder verteilen. Pro Anteil wird eine nachvollziehbare offene Rechnung erzeugt; Restcent folgen einer stabilen alphabetischen Reihenfolge.
- Mitglieder können für eigene offene Konsumeinträge **Korrekturen** anfragen. Die Barleitung beantwortet und schließt diese ab; nur explizit ausgewählte offene Einträge werden als storniert markiert. Bereits ausgestellte Rechnungen bleiben unverändert.
- Die Administration kann alle Betriebsdaten nach einer bewussten Bestätigung zurücksetzen. Benutzerkonten, Rollen und die Ersteinrichtungsmarkierung bleiben dabei erhalten.

Die folgenden Erweiterungen bauen darauf auf:

- Eine öffentliche Programmseite zeigt veröffentlichte Termine, Bandinformationen, Bild-URLs sowie Ticket- und Video-Links ohne Anmeldung.
- Rückblicke können erst nach dem Termin veröffentlicht werden. Bilder werden nur bei dokumentierter Fotoeinwilligung eingebunden.
- Die Social Wall ermöglicht Mitgliedern Beiträge und Kommentare. Gäste können eigene Beiträge mit optionaler Bild-URL zur Freigabe einreichen; sie bleiben bis zur Administrationsfreigabe für andere unsichtbar. Autorinnen, Autoren und Administration dürfen Beiträge entsprechend löschen.
- Barleitung organisiert Übergabeaufgaben mit Status, Priorität und verantwortlicher Person.
- Die Administration führt pro Veranstaltung ein manuelles Einnahmen-/Ausgabenledger. Ein Abschluss sperrt weitere Buchungen.
- Ein gerade erfasster eigener Konsum kann für zehn Sekunden atomar storniert werden; danach bleibt der bestehende Korrekturprozess maßgeblich.
- Tagesangebot und Gastpreise sind Teil der zentralen Bareinstellungen bzw. des Inventars. Bilddaten werden nicht als Base64 in der Datenbank gespeichert; redaktionelle Bilder sind validierte HTTP(S)-URLs.

Die Migrationen `20260921193000_add_events_and_duties`, `20260921200000_add_bulletin_notes`, `20260921203000_add_allocations_and_corrections` und `20260924170000_add_public_events_and_operations` legen die relationalen Tabellen und Spalten an. Die letzte Migration übernimmt bei bestehenden Artikeln den bisherigen regulären Preis als Startwert für den Gastpreis; vorhandene Artikel werden deshalb nicht versehentlich kostenlos. Führe für jedes Deployment ausschließlich `prisma migrate deploy` bzw. den vorhandenen Build-Befehl aus, niemals `db:seed`.

Für Daten aus einer bereits genutzten `bonanzbar-online`-Supabase-Instanz ist vor einem Import eine fachliche Zuordnung der Mitglieder erforderlich; es werden keine Authentifizierungs- oder Geschäftsdaten automatisch zwischen Datenbanken kopiert.

Der frühere Supabase-Passwort-Reset wird nicht übernommen, da die Prisma-Anwendung dafür einen eigens konfigurierten E-Mail-Anbieter und sichere Recovery-URLs benötigt. Ebenso gibt es keinen automatischen Homepage-Import: externe Terminseiten müssen zuerst als vertrauenswürdige Quelle und ihr Datenformat fachlich festgelegt werden.

## Drei Getränkepreise und Preisregeln

Jeder Inventarartikel hat einen **regulären Preis** für den offiziellen Betrieb, einen **Helferpreis** und einen **Gastpreis**. Unter **Preise** wählt die Administration den aktuellen Betriebsmodus:

- **Offiziell geöffnet:** Personen mit „Nach Betriebsmodus“ zahlen den regulären Preis.
- **Helferbetrieb:** Personen mit „Nach Betriebsmodus“ zahlen den Helferpreis.

Zusätzlich kann die Administration pro Person wählen, ob sie immer den regulären Preis, immer den Helferpreis, immer den Gastpreis oder den vom Betriebsmodus abhängigen Preis erhält. Reine Gastkonten erhalten serverseitig stets die Gastpreisregel. Diese Einstellung wird beim Anlegen eines Mitglieds gesetzt und unter **Preise** jederzeit geändert. Beim Eintragen eines Getränks und beim Erstellen einer Rechnung wird der passende Preis serverseitig berechnet und als Einzelpreis gespeichert; spätere Preis- oder Modusänderungen verändern abgeschlossene Einträge nicht.

Der Betriebsmodus ist in dieser ersten Version absichtlich ein expliziter Admin-Schalter, da keine festen Öffnungszeiten vorgegeben wurden. Dadurch kann er auch bei Sonderveranstaltungen, Aufbau oder Abbau zuverlässig gesetzt werden.

## Bereitstellung mit Vercel

1. Importiere `blackbyte9/bonanzbar-app` als Vercel-Projekt, wähle **Root Directory** `apps/web` und das Framework **Next.js**.
2. Setze den Build-Befehl auf `npm run build`. Dieser führt `prisma migrate deploy`, `prisma generate` und anschließend den Next.js-Build aus. Kurzzeitige PostgreSQL-Migrationssperren bei parallelen Vercel-Deployments werden bis zu zweimal erneut versucht.
3. Verbinde die Neon-Datenbank in Vercel mit **Production** und **Preview**. Setze `DATABASE_URL` in jeder Umgebung auf die jeweilige Neon-Verbindungs-URL: primärer Neon-Branch für Production, automatischer Neon-Branch für Preview.
4. Setze `AUTH_SECRET` getrennt für Production und Preview. Setze `INITIAL_ADMIN_SETUP_TOKEN` nur für Production und entferne ihn nach dem Erstzugang.
5. Stelle sicher, dass der erste Deployment-Branch `main` ist. Der Build wendet alle noch offenen, additiven Migrationen – einschließlich der Veranstaltungs-, Gast- und Betriebsfunktionen – automatisch auf den neuen Neon-Branch an.
6. Füge unter **Settings → Domains** `app.bonanzbar.de` hinzu. Strato benötigt dafür den von Vercel angezeigten CNAME-Eintrag für die Subdomain. Vercel richtet das TLS-Zertifikat ein.

Nach Änderungen an Vercel-Variablen muss ein neues Deployment gestartet werden, weil bereits existierende Deployments keine neuen Werte übernehmen.

## Nützliche Befehle

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run db:deploy
npm.cmd run db:environment -- development
npm.cmd run db:seed
npm.cmd run dev:web
npm.cmd run dev:mobile
```
