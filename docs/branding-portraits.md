# Shio no Kuni – Branding und Portraits

Stand: 15.10.2026. Bestehende Kampagnensysteme werden erweitert; Karten sind
nicht Bestandteil dieser Iteration.

## Original und Branding

Die bereitgestellte Originalgrafik liegt unverändert unter
`public/branding/shiogakure-original.png`. Das grosse Standardemblem und die
vorhandene „Engraved“-Variante wurden ausschliesslich ausgeschnitten und skaliert,
nicht neu gezeichnet. `scripts/build-branding.mjs` dokumentiert die Ausschnitte
und erzeugt mit `node scripts/build-branding.mjs`:

- `logo-light.png`: Originalemblem auf hellem Grund.
- `logo-dark.png`: Original-Engraved-Variante für dunklen Grund.
- 32-, 180-, 192- und 512-Pixel-Icons, `src/app/favicon.ico` und Social-Bild.

`BrandLogo` steht im globalen Header unmittelbar vor der Kampagnennavigation.
Root-Metadaten enthalten die Identität **Shio no Kuni – Naruto D&D**,
Seitentitel-Vorlage, OpenGraph/Twitter-Bild, Apple Touch Icon und App-Manifest.
Die Dorfidentität bleibt **Shiogakure**. Bestehende dunkle Oberflächenfarben,
Gold und Sonnenrot werden wiederverwendet. Next-/Vercel-Standardgrafiken und
Standardmetadaten wurden entfernt. `PUBLIC_APP_URL` muss in Produktion auf die
öffentliche HTTPS-Adresse gesetzt werden; lokal gilt `http://localhost:3000`.
Metadaten enthalten keine privaten Kampagnen- oder Charakterinformationen.

## Datenmodell und vorhandene URL-Felder

Die additive Migration `20261014220000_portraits` ergänzt:

- `Character.portraitOwnerKey`: nullable SHA-256-Kennung des Erstellerzugangs.
  Kein Authentifizierungstoken und keine automatische Besitzübernahme alter Daten.
- `Portrait`: genau eine Character-, NPC- oder EnemyTemplate-Zuordnung,
  Kampagne, frei benennbare Variante, Standardflag, Version, interner Storage-Key,
  MIME-Typ, Dimensionen, Bytezahl und Erstellungsdatum.

SQL-Checks erzwingen genau eine Entität; partielle Unique-Indizes erlauben
höchstens ein Standardportrait pro Entität. Es gibt keine Bild-BLOBs in Prisma.
Vorhandene `Character.portraitUrl`- und `Npc.portraitUrl`-Werte bleiben erhalten.
Sie werden nicht ungefragt heruntergeladen oder in den privaten Speicher kopiert.
Der bisherige NPC-Portrait-Link bleibt verfügbar; neue Bilder laufen ausschliesslich
über die geschützte Verwaltung. Legacy-URLs werden nicht als private Uploads behandelt.

Ein NPC mit verknüpftem Character verwendet dieselbe Portrait-Sammlung in beiden
Ansichten. Beim Verknüpfen werden Character-Varianten atomar an die NPC-Identität
übertragen; ein bestehendes NPC-Standardbild hat Vorrang. Mehr als zehn kombinierte
Varianten müssen vor der Verknüpfung reduziert werden. Namen, Rollen und Kampfdaten
werden durch Portraitaktionen nicht verändert.

## Bedienung

Im Character Creator ist ein optionales Bild mit Vorschau wählbar. Nach erfolgreicher
Charaktererstellung folgt der geschützte Upload. Scheitert nur dieser, bleibt der
erstellte Charakter bestehen; die Meldung verweist zur erneuten Auswahl im Bogen.
Der Charakter muss nicht erneut erstellt werden.

Character Sheet, NPC-/Sensei-Details und eigene Bestiary-Vorlagen enthalten dieselbe
Komponente **Bild auswählen** (Portrait-Studio):

1. Variante benennen, etwa Kind/Akademie, Genin, Chunin, Jonin oder eigener Name.
2. Datei auswählen und Vorschau prüfen.
3. Optional quadratischen Ausschnitt wählen und Fokus horizontal/vertikal einstellen.
4. Hochladen; das erste Bild wird automatisch Standard.
5. Weitere Varianten hinzufügen, als Standard wählen, gezielt ersetzen oder bestätigt
   entfernen. Entfernen des Standardbilds wählt das älteste verbleibende Bild.

Das Uploadformular behält bei Serverfehlern seine Auswahl. Varianten ändern niemals
Ninja-Rang, Level oder Kampfwerte. Ohne Bild erscheinen Initialen. Gemeinsame
`Portrait`-Komponenten zeigen Bilder in Charakter-/NPC-Listen, Teams, Bestiary,
Encounter-Teilnehmern und bei Missions-NPCs.

Encounter-Statblocks bleiben unveränderte Kampfsnapshots. Ihre Portraits zeigen die
aktuelle, berechtigungsgeprüfte Quelle; sie sind keine historischen Bildkopien.
Wird eine Quelle oder ein Portrait entfernt, erscheint der Fallback. Kampfwerte
und bestehende Runs werden nicht verändert.

## Rechte und private Abrufe

- DM: eigene Kampagnencharaktere, NPCs und eigene Enemy Templates.
- PLAYER: schreibend nur eigener, nicht als NPC verknüpfter Spielercharakter.
- Alte Charaktere ohne Besitzer bleiben schreibend DM-only.
- Globale Enemy Templates bleiben unveränderlich; erst eine Kampagnenkopie bearbeiten.
- Lesen folgt vorhandenen Character-/NPC-Freigaben. Eigene Bilder gewähren keinen
  Zugriff auf andere Kampagnen. NPC-Geheimnisse werden nicht über Bildrouten umgangen.

Das bestehende Projekt kennt gemeinsame PLAYER-Zugänge, keine dauerhaften Benutzer-
konten. Neue Spielercharaktere erhalten die gehashte Kennung ihrer Ersteller-Session.
Nach Cookieverlust, Ablauf oder Neuanmeldung kann der DM im Charakterbogen einen
aktiven Spielerzugang zuweisen oder wieder auf „Nur DM“ setzen. Spieler sehen ihr
Zugangskürzel und können es mit dem DM abgleichen. Die Auswahl liefert ausschliesslich
Hashes, niemals verwendbare Session-Cookies. Besitzeränderungen vergleichen den
bisherigen Wert, Portraitänderungen die Portraitversion.

`GET /api/portraits/[portraitId]` prüft jedes Mal Session, Kampagne und aktuelle
Sichtbarkeit. Unberechtigte und unbekannte Bilder liefern 404. Antworten verwenden
`private, no-store`, WebP-Content-Type, `nosniff` und restriktive CSP. Es gibt keine
öffentlichen Upload-URLs. Die Collection-Route gibt keine Dateipfade/Storage-Keys aus.
POST prüft zusätzlich Origin gegen den HTTP-Host; Cookies allein reichen für
einen fremden Website-Ursprung nicht aus. Reverse Proxies müssen den korrekten Host
weiterreichen und dürfen den privaten Bildpfad nicht öffentlich ausliefern/cachen.

## Upload-Sicherheit und Speicher

`portrait-image.ts` verwendet die explizite `sharp`-Abhängigkeit zur tatsächlichen
Dekodierung. Erlaubt sind PNG, JPEG und WebP mit passendem MIME/Decoderformat.
Grenzen: 5 MiB pro Datei, 4096 × 4096 Pixel, maximal 16.777.216 Eingangspixel;
animierte/mehrseitige, beschädigte und fremde Formate werden abgewiesen. Der
HTTP-Body wird beim Lesen auf 6 MiB inklusive Multipart-Begrenzungen begrenzt.

Bilder werden orientiert, optional beschnitten, auf maximal 1024 × 1024 verkleinert
und als WebP neu kodiert. Originalname, EXIF und angehängte Originalpayloads werden
nicht gespeichert. Storage-Keys sind servergenerierte UUIDs; Pfadsegmente aus
Dateinamen oder Requests werden nie verwendet. Lesen/Löschen akzeptiert nur dieses
enge Keyformat. Maximal zehn Varianten pro Entität, 2000 Bilder/100 MiB pro Kampagne;
zusätzlich 20 Uploadversuche pro Zugang und zehn Minuten im jeweiligen Prozess.
Ein vorgeschaltetes Upload-/Rate-Limit ist bei mehreren Produktionsinstanzen sinnvoll.

`PortraitStorage` abstrahiert `put`, `read`, `remove`. Die aktuelle Implementierung
verwendet lokal `.portrait-storage/`, in Produktion explizit `PORTRAIT_STORAGE_ROOT`.
`public` und Unterverzeichnisse sind verboten. Produktions-Uploads ohne Konfiguration
werden mit 503 abgewiesen statt versehentlich ephemer gespeichert.

Produktion benötigt ein privates persistentes Volume, das alle App-Instanzen sehen,
passende Servicekonto-Rechte und gemeinsame Backups von SQLite und Bildverzeichnis.
Verzeichnisse/Dateien werden mit 0700/0600 angelegt, soweit das Betriebssystem diese
Modi unterstützt; Windows benötigt passende ACLs. Serverless ohne persistentes Volume
benötigt zuerst einen privaten Object-Storage-Adapter hinter derselben Schnittstelle.
Ein S3-/Cloud-Adapter ist nicht Bestandteil dieser Implementierung.

Dateien werden vor dem DB-Commit geschrieben und bei abgewiesenen Mutationen
entfernt. Ersetzte/gelöschte Dateien werden nach Commit entfernt. Abstürze oder
Kaskadenlöschungen einer Entität können unreferenzierte Dateien hinterlassen;
diese sind über die Bildendpunkte nicht erreichbar. Für deren Bereinigung:

```powershell
# Nur prüfen, keine Dateien löschen:
npx tsx scripts/portrait-storage-gc.ts
# Nach Prüfung bewusst bereinigen:
npx tsx scripts/portrait-storage-gc.ts --delete
```

Das Skript berücksichtigt ausschliesslich unreferenzierte reguläre UUID-WebP-Dateien
älter als 24 Stunden und prüft vor Löschung erneut die Datenbank. Es arbeitet ohne
rekursive Löschung. Der lokale Dry-run meldete null Kandidaten.

## Migration, Seeds und Prüfungen

Vor lokalem Deployment: `.local-backups/pre-portraits-1792015559509.sqlite`.
Hashes aller 39 bestehenden Tabellen sind vor/nach Migration identisch (ausgenommen
die neue nullable Character-Spalte). Keine Fremdschlüsselverletzung; kein Reset.
Alle 14 Migrationen wurden zusätzlich isoliert auf SQLite eingespielt, ohne
Schemaabweichung. Auch die lokale Datenbank ist aktuell und ohne Schema-Diff.

Nach weiterer Sicherung wurden alle registrierten Seeds zweimal ausgeführt:

| Daten | Vorher | Nach Lauf 1 | Nach Lauf 2 |
| --- | ---: | ---: | ---: |
| Globale Jutsu, davon registrierte Seeds | 589 / 579 | 589 / 579 | 589 / 579 |
| Globale Enemy Templates | 20 | 20 | 20 |
| Globale Missionsvorlagen | 6 | 6 | 6 |
| Chakra-Naturen | 7 | 7 | 7 |
| Kampagnen / Charaktere / NPCs | 3 / 4 / 1 | 3 / 4 / 1 | 3 / 4 / 1 |
| Kampagnenmissionen / GameSessions / Runs | 1 / 1 / 0 | 1 / 1 / 0 | 1 / 1 / 0 |

Keine Duplikate, keine automatischen Missionsimporte, Kampagneninhalte unverändert.
Die bekannten 221 nicht auflösbaren Jutsu-Voraussetzungstexte bleiben Altbestand;
die Clan-Hiden-Entwurfsdateien bleiben ausserhalb des registrierten Seeds.

Der echte Edge-Production-Browserlauf auf separater DB-Kopie prüfte neun Schritte:
Branding/Metadaten/Icons, NPC-Verwaltung, Dateiauswahl/Vorschau/Ausschnitt,
Persistenz nach Reload, zweite Variante/Standard, Ersetzen/Entfernen, minimale
API-Projektion, Tablet-Layout ohne Überlauf und private Bilder als Spieler/anonym.
Ergebnisse/Screenshot liegen lokal unter `.local-backups/portrait-browser-results.json`
und `.local-backups/portrait-tablet.png`. Manuelle Prüfung auf Safari/Firefox,
echten Touch-Geräten und mit Screenreader steht aus.

Automatisierte Verifikation: **441 Tests in 29 Dateien** erfolgreich, davon 18 neue
Tests für Decoder/MIME/Grössenlimits, Varianten/Standard/Ersetzen/Löschen,
Quoten und Dateibereinigung nach Fehlern, Besitzerzuweisung, private Abrufe,
Kampagnenisolation, NPC-Character-Zusammenführung, Origin/Host-Prüfung und sofortige
Aktualisierung des Fallback-Portraits nach Upload. Bestehende Migrationstests
verwenden für historische Character-Zeilen explizite alte Datenprojektionen;
damit wird die additive Erweiterung ohne Zurücksetzen weiter geprüft.
Typecheck, ESLint, Production Build und Prisma Validation erfolgreich.

## Karten-Ausblick

Es wurden keine Kartenmodelle oder Location-Seeds angelegt. Für die spätere,
gesonderte Prüfung werden die tatsächlichen kanonischen Dateien benötigt:
Inselkarte/freigestellte Insel, Reigan/Shiogakure, Kanezaki, Shioura und Naruto-
Weltkarte. Shio no Kuni liegt östlich von Konoha, südlich des Blitzreichs und
nordwestlich des Wasserreichs. Benannte Orte werden erst nach Bildprüfung als
strukturierte idempotente Seeds mit vorhandenen Location-Beziehungen erfasst.

## Generische Portraits und kompaktere Einbindung

Vier eigens generierte Motive liegen als lokale WebP-Dateien unter
`public/portraits/`: `shinobi.webp`, `kunoichi.webp`, `medic.webp`, `merchant.webp`.
Sie sind öffentlich sichtbare generische Vorlagen und enthalten keine Kampagnendaten.
Die Erstellung erfolgte mit dem eingebauten Imagegen-Tool; die Prompt-Spezifikation
steht in [portrait-preset-prompts.json](portrait-preset-prompts.json).

Das Profil zeigt ein grösseres Portrait neben Name und Eckdaten. Ein schmaler
Bereich „Bild auswählen“ öffnet das native, tastaturbedienbare Portrait-Studio.
Die Vorlagengalerie und der Bereich „Eigenes Bild“ sind getrennt auswählbar;
gespeicherte Varianten sowie Zugriffsrechte sind eingeklappt. Das lange Formular
belegt damit keinen Platz mehr im eigentlichen Charakter-/NPC-Profil.

Erst „Vorlage übernehmen“ speichert die Auswahl als private, unabhängige WebP-Kopie
und setzt sie als Standard. Der Server akzeptiert nur die vier fest definierten
Preset-IDs; Dateipfade und fremde URLs sind ausgeschlossen. Rechte, Quoten,
Versionsprüfung, Ersetzen und Entfernen verwenden die vorhandene Upload-Logik.
Keine Änderung am Prisma-Schema und keine automatischen Zuweisungen an Kampagnen.

Verifikation dieses Nachtrags: 443 Tests in 30 Dateien, Typecheck, ESLint und
Production Build erfolgreich. Zwei neue Tests prüfen den ausdrücklichen Auswahl-
und Speichervorgang sowie erlaubte Presets, Rechte und Standardwechsel. Sechs
Edge-Browserprüfschritte auf separater Datenbank bestätigen Galerie, Laden aller
vier Motive, Speicherung, direkte Aktualisierung im Profil, Tablet-Layout,
Öffnen/Schliessen des Studios und weiterhin verfügbare Upload-Kontrollen.
