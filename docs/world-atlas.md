# Universeller interaktiver Weltatlas

Stand: 15.10.2026. Der Atlas erweitert die vorhandene Kampagnenverwaltung.
Eigene Karten funktionieren unabhängig von der vorbereiteten Shio-Welt.

## Bedienung

1. Kampagne öffnen und **Atlas** wählen. Suche und Archivfilter helfen bei der Auswahl.
2. Als DM **Karte erstellen** öffnen, eigene Karte anlegen oder **Shio no Kuni als
   Welt importieren** bestätigen. Der Import ist ausdrücklich und kampagnengebunden.
3. Eigene Karte im Bearbeitungsmodus mit PNG, JPEG oder WebP versehen. Vorschau
   prüfen und Upload bestätigen. Ersetzen und Entfernen haben eine Bestätigung.
4. Im Bearbeitungsmodus eine freie Bildstelle anklicken. Titel, Kategorie, Symbol,
   Farbe, Sichtbarkeit und optional bestehenden Ort bzw. direkte Detailkarte wählen.
   Marker speichern; vorhandene Marker können gezogen oder in der Liste bearbeitet werden.
5. Unter Karteneinstellungen übergeordnete Karte, zentralen Ort, Reihenfolge,
   Beschreibung, DM-Notizen und Freigabe setzen. Hierarchien werden serverseitig geprüft.
6. Im Betrachtungsmodus Marker auswählen, Ortsinformationen öffnen und über
   Detailkarten, Kartenauswahl oder Breadcrumbs navigieren. Kategorien lassen sich
   als Markerebenen ein-/ausblenden; die Markerliste ist durchsuchbar.
7. Mausrad, Plus/Minus, Ziehen, Touch-Panning und Pinch-Zoom steuern die Karte.
   Fokussierte Karte unterstützt Pfeiltasten und Plus/Minus; Marker sind per Tastatur
   erreichbar. Ansicht zurücksetzen und Vollbild sind vorhanden.
8. Vor Löschen zuerst archivieren. Löschen erfordert den exakten Kartennamen;
   untergeordnete Karten und eingehende Detailkarten-Marker müssen vorher gelöst werden.
   Zugehörige Locations werden beim Löschen einer Karte nicht entfernt.

Ladezustände, Bestätigungen, Fehlermeldungen und Toasts begleiten die Aktionen.
Ein Konflikt mit einem zweiten Editor liefert HTTP 409 und lädt den aktuellen Stand.
Die Änderung muss anschliessend auf diesem Stand erneut vorgenommen werden.

## Architektur und Datenmodelle

Leaflet 1.9 mit `CRS.Simple` zeigt ausschliesslich das hochgeladene Bild an;
es gibt keine geografischen Tiles, Geocoding-Dienste oder externen Kartenabrufe.
Leaflet wird erst im Client geladen. Next-Server-Komponenten und API-Routen prüfen
den vorhandenen Campaign-Zugang. Die Speicherabstraktion wird mit Portraits geteilt.

| Modell | Aufgabe |
| --- | --- |
| `WorldMap` | Kampagne, Metadaten, Typ, Parent, optional Location, private Bildreferenz und Dimensionen, Sichtbarkeit, Archiv, Version, Seed-Key |
| `MapMarker` | Normalisierte Position, Titel, Beschreibung, Kategorie, Symbol, Farbe, Sichtbarkeit, Location und direkte Detailkarte |
| `AtlasWorldTemplate` | Globale unveränderliche Importdefinition mit Manifest-Hash |
| `AtlasImport` | Einmaliger Importbeleg je Kampagne und Vorlagen-Key |
| `AtlasLocationSeed` | Stabile Bindung importierter Keys an bestehende normale Locations |
| `AtlasChange` | Request-ID, Payload-Hash und Ergebnis für wiederholbare Schreibaktionen |

Migration `20261015010000_world_atlas` ergänzt diese sechs Tabellen und Indizes.
Bestehende Modelle erhalten nur Prisma-Rückrelationen, keine veränderten skalaren
Felder. SQL-Checks sichern Koordinaten und direkte Selbstverweise zusätzlich ab.
Karten unterstützen WORLD, REGION, ISLAND, CITY, VILLAGE, DISTRICT, BUILDING,
DUNGEON und CUSTOM. Zyklen und kampagnenfremde Referenzen sind nicht erlaubt.

`Location` bleibt die einzige Ortsdatenbank. Die bisherige Route
`/campaign/[campaignId]/world/[slug]` bleibt erhalten und verwendet jetzt dieselbe
sichere Ortsprojektion wie der Atlas. Orte zeigen vorhandene NPCs, Organisationen,
veröffentlichte Missionen, Unterorte und Detailkarten; Encounter sind DM-only.
Character Sheets, Organisationen, Missionen und Encounter-Snapshots werden durch
Kartenaktionen nicht verändert.

### Koordinaten und Parallelität

`x` und `y` liegen zwischen 0 und 1, Ursprung links oben. Leaflet erhält
`lat = (1 - y) * Bildhöhe`, `lng = x * Bildbreite`. Zoom und Bildschirmgrösse
verändern diese gespeicherten Werte nicht. Verschieben speichert absolute Positionen.
Ein Bildwechsel erhält die normalisierten Markerpositionen; bei anderem Bildinhalt
müssen Marker vom DM kontrolliert werden.

Jede Kartenänderung einschliesslich Markeränderungen prüft die Kartenversion und
erhöht sie atomar. Request-IDs mit Payload-Hash verhindern doppelte Anwendung;
dieselbe ID mit anderem Inhalt wird abgelehnt. Mehrere DMs sehen Änderungen nach
Reload, es gibt keinen Live-Push.

## Upload und privater Speicher

- PNG, JPEG und WebP bis 25 MiB; Multipart-Body maximal 26 MiB.
- Decoderprüfung tatsächlicher Inhalte und MIME-Abgleich; keine Animationen.
- Maximal 64 Millionen Pixel und 12.000 Pixel je Bildkante.
- EXIF-Orientierung wird angewendet, Metadaten entfernt, verlustloses WebP ohne
  Verkleinerung erzeugt. Die Original-PNGs der vorbereiteten Welt bleiben erhalten.
- Zufällige UUID-Dateinamen, private Verzeichnis-/Dateirechte, keine Benutzerpfade.
- Maximal 100 Karten, 1.000 Marker je Karte und 512 MiB gespeicherte Kartenbilder
  je Kampagne; maximal zehn Uploads pro Zugang in zehn Minuten je Serverprozess.
- Ersetzen/Löschen räumt ungenutzte Dateien nach dem Commit auf; fehlgeschlagene
  Transaktionen entfernen neu geschriebene Dateien.

Entwicklung: `.atlas-storage/`. Produktion: explizites `ATLAS_STORAGE_ROOT` auf
einem privaten persistenten Volume ausserhalb von `public`. Datenbank und beide
Bildverzeichnisse konsistent gemeinsam sichern. Ephemere Serverless-Dateisysteme
reichen nicht aus. Mehrere Instanzen benötigen denselben persistenten Speicher
oder einen späteren Object-Storage-Adapter; Rate-Limits sind derzeit pro Prozess.
Die Originaldateien unter `assets/world-atlas/shio/` müssen im Deployment enthalten
sein, damit Seed und expliziter Import funktionieren.

Wartung: `npx tsx scripts/atlas-storage-gc.ts` meldet unreferenzierte reguläre
UUID-WebP-Dateien älter als 24 Stunden. Erst mit `--delete` werden diese nach
erneuter Referenzprüfung gelöscht. Nicht während Imports/Uploads ausführen.

## Berechtigungen und Spieleransicht

Alle Lesezugriffe prüfen Kampagnenzugehörigkeit. Schreiben und Import verlangen
DM-Rechte; Origin/Host-Prüfung schützt Multipart-Mutationen. Der Image-Endpunkt
prüft dieselben Rechte wie die Karte und liefert `private, no-store` sowie nosniff.
Speicherpfade werden nie ausgeliefert. Original-Assets liegen ausserhalb von `public`.

Spieler erhalten ausschliesslich sichtbare, nicht archivierte Karten mit einer
vollständig freigegebenen Vorfahrenkette. Marker mit verborgenem Ort oder verborgener
Detailkarte werden ebenfalls ausgeschlossen. DM-Notizen, geheime Marker und
verborgene Beziehungen fehlen bereits in der Serverantwort und im HTML/JSON.
Ortsprojektionen filtern NPCs, Organisationen, Missionen und Eltern separat.

**Rastergrenze:** Ein ausgeblendeter Marker entfernt keine Beschriftung aus dem
Bild. Beispielsweise steht das ANBU-Quartier bereits auf der Reigan-Originalkarte.
Alle importierten Karten sind deshalb zunächst verborgen. Vor Freigabe die gesamte
Grafik kontrollieren und gegebenenfalls selbst eine bereinigte Spielerversion
hochladen. Es gibt in dieser Iteration keinen Fog of War oder Bildredaktionseditor.

## Shio no Kuni: Vorlagen und Import

Die sechs bereitgestellten Originalbilder sind unverändert unter
`assets/world-atlas/shio/` abgelegt (Dateizuordnung siehe dortige README).
Marker wurden anhand dieser tatsächlichen Bilder positioniert.

- Naruto-Weltkarte → Shio-Insel → Reigan / Shiogakure, Kanezaki, Shioura.
- Die freigestellte Insel ist eine zusätzliche Unterkarte der Insel. Sie besitzt
  bewusst keine übernommenen Marker, da ihr Bildausschnitt anders ausgerichtet ist.
- Insgesamt sechs Karten, 67 strukturierte Locations und 67 Marker.
- Enthalten sind alle verlangten Inselorte, fünf Reigan-Stadtbereiche und die
  benannten Einrichtungen der drei Stadtbilder. Der eindeutig beschriftete
  Kanezaki-Nordpfad ist zusätzlich erfasst. Gebäudebeziehungen zu Stadtteilen werden
  nur verwendet, wo sie hinreichend eindeutig sind.
- Shio liegt gemäss Vorgabe östlich von Konoha, südlich des Blitzreichs und
  nordwestlich des Wasserreichs. Widersprüchliche Richtungstexte im Insel-Raster
  wurden nicht eigenmächtig verändert; die textliche Vorgabe ist massgeblich.

`npm run db:seed` registriert die globale Vorlage `shio-atlas:v1` idempotent über
einen Hash von Definition und Originalbildern. Es importiert keine Locations oder
Karten in bestehende Kampagnen. Der DM startet den separaten Import im Atlas.

Der Import kopiert Bilder und Daten in kampagneneigene Datensätze. Eindeutig
passende vorhandene Locations werden nach Möglichkeit wiederverwendet, einschliesslich
der Reigan-/Shiogakure-Aliase. Vorhandene Namen, Texte, Sichtbarkeiten und Eltern
werden dabei nicht überschrieben. Bei Mehrdeutigkeit wird eine eigene Location
angelegt. Der Importbeleg verhindert Duplikate auch bei Wiederholung; manuelle
Änderungen oder Löschungen werden nicht stillschweigend zurückgesetzt. Ein erneuter
Import öffnet die vorhandene Welt, er dient nicht als Reparatur- oder Updatefunktion.
Die kopierten Karten sind anschliessend unabhängig bearbeitbar. Eine globale
Export-/Template-Verwaltung für eigene Welten ist noch nicht implementiert.

## Prüfung und Datenerhalt

- 461 Tests in 33 Dateien erfolgreich: bestehende Systeme sowie Karten-/Marker-CRUD,
  Bildinhalte und Limits, Koordinaten, Hierarchien/Zyklen, Location-Referenzen,
  Kampagnenisolation, Spielerprojektionen, privater Bildzugriff, Versionskonflikte,
  Request-Wiederholung, Import-Idempotenz und unveränderte bestehende Locations.
- Typecheck, ESLint, Production Build und Prisma Validation erfolgreich.
- Alle 15 Migrationen isoliert auf neuer SQLite-Datei angewendet; Schema-Diff ohne
  Abweichung. Migration lokal nach Sicherung angewendet: 40 vorhandene Tabellen
  inhaltlich unverändert, Foreign-Key-Check erfolgreich. Kein Datenbank-Reset.
- Vorherige DB-Sicherung: `.local-backups/pre-atlas-1792053574579.sqlite`.
- Atlas-Seed zweimal auf der Entwicklungsdatenbank ausgeführt: eine globale
  Atlasvorlage; 46 übrige Tabellen unverändert. 589 globale Jutsu, einschliesslich
  aller 579 registrierten Seeds, 20 Enemy Templates und sechs Missionsvorlagen
  bleiben erhalten. Vollständiges bestehendes Seeding zusätzlich isoliert geprüft.
- 14 echte Edge-Browserprüfschritte gegen Production Build auf separater DB-Kopie:
  Import, Marker-/Location-Auswahl, Unterkarten/Breadcrumbs, eigene Karte, PNG-Upload
  mit Vorschau, Klickplatzierung, echtes Markerziehen, Zoom/Panning/Reload,
  Spielerfreigabe ohne DM-Notizen, private Dateien und mobiles Layout ohne Überlauf;
  zusätzlich Mausrad-Zoom, emulierter Mehrfinger-Pinch und Vollbild per echtem Klick.
  Keine JavaScript-Laufzeitexception im erfolgreichen Durchlauf.
- Lokale Artefakte: `.local-backups/atlas-browser-results.json`,
  `atlas-browser-gestures-results.json`, `atlas-seed-results.json`,
  `atlas-reigan-desktop.png` und `atlas-mobile.png`.
  Diese Dateien und Browser-Testdaten sind nicht für das Repository vorgesehen.

Vitest verwendet maximal vier Worker, damit Datenbank-/Sharp-Tests unter Windows
zuverlässig starten. Manuell offen bleiben echte Mehrfinger-Gesten auf Hardware,
Safari/Firefox, Screenreader und grosse reale Kampagnen. Die Leaflet-Touchbedienung
ist aktiviert; Emulation ersetzt keine Prüfung auf echten Geräten.

Grosse Bilder werden vollständig geladen. Es gibt weder Tile-Pyramiden noch
Vektorebenen; die dokumentierten Bildgrenzen schützen Decoder und Speicher.
Missionen und Encounter bleiben über bestehende Locations verknüpft; ein neuer
geografischer Routing-/Reisezeiten- oder Session-Positionsdienst ist nicht enthalten.
