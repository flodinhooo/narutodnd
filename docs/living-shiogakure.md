# Living Shiogakure

Aktueller Nachtrag: Das private Genin-Team-Paket enthält jetzt drei dokumentierte
NPC-Teams und ein bewusst leeres Spielerteam. Umfang, DM-Freigaben,
Jutsu-Sichtbarkeit und aktuelle Prüfungen stehen in
[genin-teams-integration.md](genin-teams-integration.md). Ältere Hinweise auf vier
leere Team-/Sensei-Dateienpaare beschreiben den damaligen Auditstand.

Stand: 15.10.2026. Die Erweiterung verwendet die vorhandenen NPC-, Character-,
Organisations-, Missions-, Encounter-, Portrait- und Atlas-Systeme. Es gibt keine
zweite Charakter- oder Ortsdatenbank und keine automatische Kampagnenbefüllung.

## Datenbank und Vertraulichkeit

Die Entwicklungsdatenbank wurde zunächst mit SQLite `VACUUM INTO` konsistent
gesichert und anschliessend nach `.private-data/dev.sqlite` kopiert. Tabellen-
Fingerprints vor und nach dem Kopieren waren identisch; der Foreign-Key-Check
war fehlerfrei. Erst danach wurde `prisma/dev.db` mit `git rm --cached` aus dem
Index genommen. Die lokale Originaldatei existiert weiterhin. Kein Reset und
kein Löschen der Originaldatei.

Lokale Konfiguration in der ignorierten `.env`:

```env
DATABASE_URL="file:../.private-data/dev.sqlite"
```

SQLite-Pfade sind bei Prisma relativ zum Schema in `prisma/`. `DATABASE_URL`
kann weiterhin einen anderen privaten Pfad bestimmen. `.private-data/`,
Datenbankdateien mit `.db`, `.sqlite`, `.sqlite3` und deren WAL-/SHM-/Journal-
Dateien werden ignoriert. Das enthält auch die lokal erhaltene Originaldatei.
Ein frischer Checkout verwendet `.env.example` und `npm run db:prepare` vor der
ersten Migration. Die additive Migration `20261015160000_character_combat_profile` ergänzt das optionale JSON-Feld `Character.combatProfile`; bestehende Datensätze bleiben unverändert. Vorher wurden eine konsistente Sicherung und eine isolierte Migrationsprüfung durchgeführt.

Nachweise bleiben privat:

- `.local-backups/private-database-results.json`
- `.local-backups/pre-private-database-1792066865956.sqlite`
- `.local-backups/database-privacy-audit.json`

### Bereits veröffentlichte Historie

Zwölf erreichbare historische Versionen der getrackten Datenbank enthalten
gefüllte interne Notizfelder. Der Audit protokolliert nur Mengen, keine Texte,
Zugangscodes oder Session-Token. Ob einzelne Inhalte Beispiele oder tatsächliche
Geheimnisse sind, ist privat redaktionell zu prüfen. Datenbankversionen können
auch damalige Zugangshashes und Session-Datensätze enthalten.

**Das Entfernen aus dem Index und `.gitignore` bereinigen keine Git-Historie.**
Vor einem öffentlichen Deployment sind erforderlich:

1. Betroffene Inhalte und frühere Datenbank-/Backup-Pfade privat inventarisieren.
2. Veröffentlichte Zugangscodes erneuern und alte Sessions widerrufen, wenn deren
   Daten bzw. ableitbare Zugangshashes veröffentlicht wurden. Eine Verlagerung der
   DB allein macht alte Zugangsdaten nicht ungültig.
3. Nach Abstimmung mit Mitwirkenden die betroffenen Binärdateien mittels eines
   History-Rewrite-Werkzeugs wie `git filter-repo` aus allen betroffenen Refs
   entfernen, Änderungen kontrollieren und koordiniert veröffentlichen.
4. Tags, Forks, alte Klone, Actions-Artefakte, Releases, Caches und gegebenenfalls
   GitHub-seitige Kopien berücksichtigen. Ein Rewrite garantiert keine Rückholung
   bereits heruntergeladener Daten; bei Bedarf GitHub-Support einbeziehen.

Diese Iteration enthält **keinen Force-Push, History-Rewrite oder unangekündigten
Zugangscodewechsel**. Der Audit ist mit `npx tsx scripts/audit-database-privacy.ts`
wiederholbar. Er wertet maximal 100 lokale Historienversionen aus und weist
weitere übersprungene Versionen im privaten Report aus.

## DM-Importoberfläche

**Kampagne → Verwaltung → Lore-Import**

1. Zuerst bei Bedarf unter **Atlas** ausdrücklich Shio no Kuni importieren.
   Diese Ortsstruktur wird wiederverwendet; fehlende oder mehrdeutige Orte sind
   Importkonflikte und führen nicht zu einer parallelen Ortsdatenbank.
2. Privates Paket auswählen. Der Server liefert dessen Inhalte ausschliesslich
   an einen DM mit Zugang zur aktuellen Kampagne.
3. NPCs, Shinobi, Familien, Clans, Organisationen, Teams und Beziehungen als
   Gruppen oder einzeln auswählen. Suche nach Namen, Dorf und Beruf ist vorhanden.
4. Neue Homebrew-Figuren benötigen die ausdrückliche Freigabe **als DM-Entwürfe**.
   Ein Import erklärt sie nicht zum Kanon. Standardmässig sind keine Vorschläge
   vorausgewählt.
5. Kampfprofile benötigen eine separate Annahmenbestätigung und Auswahl pro NPC.
   Jutsu-Zuordnungen sind zusätzlich optional. Es wird kein Clanarsenal pauschal
   vergeben.
6. Missionsentwürfe einzeln auswählen; ihre Auftraggeber müssen ausgewählt oder
   bereits aus demselben Paket importiert sein.
7. **Auswahl prüfen und vergleichen** zeigt neue und erhaltene Datensätze,
   Referenzfehler, Namenskonflikte und Beschreibungen aus Vorlage/Bestand.
8. Exakten Kampagnennamen eingeben und den Import bestätigen. Vor Anwendung wird
   die aktive DB gesichert. Neue Inhalte bleiben verborgen; Missionen sind DRAFT.
9. Ergebnisbericht prüfen; NPCs, Missionen und Atlas sind unmittelbar verlinkt.
   Anschliessend Sichtbarkeiten und Story-Konsequenzen wie bisher einzeln freigeben.

Das HTTP-API unter `/api/campaign/[campaignId]/lore` prüft DM-Rolle und
Kampagnenzugehörigkeit vor Datei- oder Datenbankzugriff. Mutationen verwenden
Origin-/Host-Prüfung und begrenzte Multipart-Bodies. Dateinamen sind auf erlaubte
Paketnamen beschränkt; Pfadtraversal und aus dem Speicher herausführende
Datei-Symlinks werden abgelehnt. Antworten sind `private, no-store`.
Es gibt keinen öffentlichen Paketdownload und keine beliebigen Uploadpfade.

Der Importkern liegt in `src/lib/lore-importer.ts` und wird vom bisherigen CLI
sowie der Oberfläche verwendet. Stabile IDs hängen von Kampagne, Paket-Key,
Entitätstyp und Eintrags-Key ab. Die neue Missionsübernahme verwendet denselben
transaktionalen Kern wie die bestehenden sechs Beispielmissionen; Auftraggeber
und Orte werden über geprüfte IDs gebunden statt erneut angelegt.

Ein Fingerprint bindet die Vorschau an Paket, Auswahl und aktuellen Datenbestand.
Veraltete Vorschauen werden vor dem Schreiben abgelehnt. Alle Änderungen eines
Imports sind transaktional. Wiederholung erzeugt keine Duplikate. Bestehende
Texte, Sichtbarkeiten, Rollen und Character Sheets werden nicht überschrieben.
Ein bereits vorhandenes vereinfachtes NPC-Profil kann nach separater Bestätigung
ein neues Kampf-Sheet erhalten. Namensgleichheit allein führt niemals zu einer
automatischen Identitätszusammenführung. Ein Konflikt kann durch Abwahl betroffener
Inhalte oder ausdrücklichen manuellen Abgleich gelöst werden.

## Private Inhalte und Herkunft

Das ObsidianVault ist weiterhin die primäre Lore-Quelle und wurde nicht verändert.
Der Git-Tree-Stand ist gegenüber dem vorigen Audit unverändert: 102 Markdown-
Dateien, 16 leere Dateien, 93 aufgelöste interne Links/Embeds. Der vorhandene
private Audit mit 621 Abgleichzeilen wurde wiederverwendet. Quellenpfade und
Git-Blob-SHAs stehen in den privaten Paketen und importierten DM-Informationen.

Private Pakete:

| Paket | Inhalt |
| --- | --- |
| `shio-v1.json` | 31 bestehende Lore-Identitäten, angereicherte Führungsprofile, neun separat freizugebende Kampfentwürfe, zehn Organisationen, 33 belegte Beziehungen |
| `living-population-v1.json` | 54 neue auswählbare Homebrew-NPCs, 16 Kampfentwürfe, neun vorgeschlagene Organisationen, 15 vorgeschlagene Beziehungen, 22 private Missionsentwürfe |

Die Pakete liegen unter `.lore-storage/` bzw. `LORE_STORAGE_ROOT`, nicht im
öffentlichen Sourcecode. Die neue Bevölkerung besitzt jeweils Beruf, Dorf,
Location, Beschreibung, Persönlichkeit, Motivation und einen konkreten
Interaktionsansatz. Beziehungen umfassen Ausbildung, Arbeitszusammenhänge,
Freundschaft, Rivalität und Zusammenarbeit; neue Abstammungsverhältnisse werden
nicht erfunden. Alle vorgeschlagenen Figuren und Beziehungen tragen eine
Entwurfskennzeichnung.

Die Führung von Shiogakure besitzt getrennte öffentliche Kurzprofile und private
Hintergründe. Raizens bestätigte heutige Funktion ist Gründer und amtierender
Anführer; der Shiokage-Titel erscheint auch im Quellenordner. Kaito, Ren, Ayame
und Renji erhalten quellenbezogene Rollen, Beziehungen und Standortzuordnungen.
Nicht eindeutig belegte Standortdetails sind als DM-Zuordnungen beschrieben,
keine neuen ausschliesslichen Wohnsitze. Private Portrait-Verweise aus den
Quellen werden erhalten; Bilder werden nicht ungeprüft über externe URLs geladen.

Die Uzumaki-Familie und die bestehenden benannten Seitenlinien bleiben erhalten.
Die beiden dokumentierten Ältesten werden nicht ohne Beleg zu einem exklusiven
Clanoberhaupt erklärt. Für Itohara/Shiranami existieren weiterhin **keine
bestätigenden Dateien im geprüften Vault-Stand**. Zwei Sprecher-/Führungsvorschläge
sind daher neue optionale Homebrew-Figuren ohne erfundene Stammbäume. Die 22
vorhandenen unregistrierten Hiden-Techniken werden weder global aktiviert noch
allein aufgrund einer vorgeschlagenen Clanmitgliedschaft vergeben.

## Kampfprofile und Encounter

25 vollständige Kampfentwürfe verwenden bestehende `Character`-Datensätze,
HP-Level-Historie, Skills, Saving Throws, Chakra-Naturen und Jutsu-Verknüpfungen.
Die wiederverwendbare Berechnung liegt unter `src/lib/rules/lore-profiles.ts`.

- Quellattribute werden übernommen; nicht kompatible Werte über 20 werden im
  ausdrücklich ausgewiesenen Entwurf auf 20 begrenzt. Originalwerte bleiben in
  den privaten Quellen erhalten.
- HP verwenden die vorhandene Rules Engine mit deterministischen Durchschnitts-
  würfen. Ausdrücklich aus einer Quelltabelle übernommene HP/AC werden als
  bestehende Override-Mechanik gespeichert, nicht durch globale Regeländerungen.
- Bei widersprüchlichen Chakra-Tabellen wird im Entwurf die aktuelle Formel mit
  dokumentiertem Reservoir verwendet. Widersprüche werden nicht kanonisiert.
- Fehlende Level-, Kontroll-, Regenerations- und Proficiency-Werte sind als
  Annahmen beschrieben und benötigen DM-Freigabe.
- D8-Profile verwenden bereits finale Attribute; die Zuordnung des enthaltenen
  WIS-Talentbonus ist ebenfalls Teil des Entwurfs.
- Jutsu werden nur über vorhandene globale Slugs verknüpft. Fehlende, mehrdeutige
  oder naturinkompatible Verweise blockieren den Import; fremde Kampagnen-Jutsu
  sind nicht verwendbar.
- Narrative Sonderfähigkeiten und ein abgeleiteter Kunai-Standardangriff werden
  im separaten Feld `Character.combatProfile` als strukturiertes Entwurfsprofil gespeichert und
  in Encounter-Snapshots übernommen. Sonderreaktionen und komplexe Effekte werden
  vom DM ausgeführt; es gibt dafür keine neue automatische Rules-Automation.
- Freie DM-Notizen bleiben unabhängig bearbeitbar. Angriffe und Sonderfähigkeiten
  bleiben dabei erhalten und werden im Character Sheet ausschliesslich dem DM angezeigt.

NPCs sind über den bestehenden Encounter-Teilnehmereditor auswählbar. Ein Run
übernimmt HP, Chakra, AC, Initiative, Skills, Saves, Jutsu und Sonderfähigkeiten
als Snapshot. Änderungen im Run schreiben nicht in den Character Sheet zurück.
Nicht belegte Fähigkeiten, Chakra-Ketten-Meisterschaft oder Kekkei-Genkai-
Freischaltungen werden nicht automatisch ergänzt.

## Bevölkerung, Organisationen und Atlas

| Umfang | Anzahl |
| --- | ---: |
| Bestehende Lore-Identitäten, teils unvollständig | 31 |
| Neue Homebrew-NPC-Vorschläge | 54 |
| Insgesamt auswählbare NPC-Profile | 85 |
| Vollständige Kampfentwürfe | 25 |
| Organisationen einschliesslich vier noch unbesetzter Teams | 19 |
| Bestätigte gerichtete Beziehungen | 33 |
| Neue vorgeschlagene Beziehungen | 15 |
| NPCs mit Atlas-Location-Verknüpfung | 83 |

Nach vorbereiteten Location-Zuordnungen: 59 Profile im Raum Reigan, zwölf in
Kanezaki, zwölf in Shioura; zwei weitere Lore-Identitäten ohne lokalen festen
Standort. Von den **neuen** Vorschlägen entfallen 30/12/12 auf die drei Dörfer.

Die neuen Rollen decken Akademie, Ausbildung, Medizin, Sicherheit, Handel,
Handwerk, Bergbau, Hafenarbeit, Fischerei, Verwaltung und religiöse bzw.
traditionelle Einrichtungen ab. Locations bleiben die zentrale Quelle;
der vorhandene Atlas zeigt zugeordnete NPCs, Organisationen und Missionen.
Spieler sehen weiterhin ausschliesslich einzeln freigegebene Inhalte.

## Startermissionen

Es bestehen sechs bisherige globale Vorlagen und 22 neue **private auswählbare**
Vorlagen, zusammen 28. Die zusätzlichen Missionen werden nicht automatisch in
`MissionTemplate` oder bestehende Kampagnen geschrieben. Sie sind im Lore-Import
verfügbar; das Mission Board verlinkt diesen Katalog.

| Rang | Bisher global | Zusätzlich privat | Insgesamt |
| --- | ---: | ---: | ---: |
| D | 2 | 8 | 10 |
| C | 2 | 6 | 8 |
| B | 1 | 4 | 5 |
| A | 1 | 2 | 3 |
| S | 0 | 2 | 2 |

Alle neuen Missionen haben einen konkreten Auftraggeber aus den neuen NPCs,
Ausgangslage, Location, persistente Pflicht-/optionale Ziele, Komplikation,
Begegnung, Belohnung und vorbereitete Konsequenzen. Fünf vorgeschlagene
Folgebeziehungen verbinden Aufträge, wenn beide importiert sind. Fehlende und
zyklische Vorlagenreferenzen werden validiert. Werden nur einzelne Aufträge
importiert, wird kein fehlender Folgeauftrag automatisch angelegt.

D-/C-Aufträge erlauben Gespräch, Beobachtung, Organisation und friedliche
Lösungen. A-/S-Aufträge sind ausdrücklich für erfahrene Teams bzw. als spätere
Vorbereitung gedacht. Keiner legt ungefragt einen kanonischen Krieg, Todesfall
oder politischen Ausgang fest. Konsequenzen bleiben DM-bestätigte Aktionen.

## Betrieb und Deployment

Produktion benötigt private persistente Volumes und absolute Pfade:

```env
DATABASE_URL="file:/var/lib/shio/database/app.sqlite"
LORE_STORAGE_ROOT="/var/lib/shio/lore"
LORE_BACKUP_ROOT="/var/lib/shio/backups"
PORTRAIT_STORAGE_ROOT="/var/lib/shio/portraits"
ATLAS_STORAGE_ROOT="/var/lib/shio/atlas"
```

Datenbankverzeichnisse vorab erstellen und restriktive Dateirechte/ACLs vergeben.
Private Pakete separat provisionieren; sie sind absichtlich nicht Bestandteil
eines öffentlichen Checkouts. Produktion verlangt explizite Lore-/Backup-Pfade.
Der Importschutz erlaubt keine getrackte bzw. nicht ignorierte DB im Sourcebaum;
bei Deployments ohne Git ist ein privater DB-Pfad ausserhalb des App-Verzeichnisses
zu verwenden. SQLite verlangt eine geeignete persistente Einzelinstanz-/Writer-
Strategie; keine unkoordinierte Mehrinstanz-Nutzung auf ephemerem Storage.

`next.config.ts` schliesst private Daten, Backups, Lore, Portraits und Atlasbilder
vom File Tracing aus. Der Code liest diese Laufzeit-Volumes ausdrücklich dynamisch.
`npx tsx scripts/check-private-artifacts.ts` prüft Trace-Manifeste und Clientassets
zusätzlich auf private Pfade bzw. Profiltext-Canaries, ohne sie zu protokollieren.
DB und Bildspeicher konsistent gemeinsam sichern; Restore separat testen.

Deployment führt keine Lore- oder Bevölkerungssaat aus. Prisma-Migrationen und
globale Seeds sind separate Betreiberaktionen. Der Hauptseed bleibt ohne
automatische Schleife über bestehende Kampagnen. Parallel hinzugekommene separate
Genin-Seed-Dateien wurden erhalten, aber ihre automatische Verdrahtung in den
Hauptseed entfernt; sie zählen nicht als zusätzliche Living-NPCs und benötigen
einen gesonderten Identitäts-/Freigabeabgleich vor Verwendung.

## Prüfungen und Grenzen

- **482 Tests in 37 Dateien**, Typecheck, ESLint und Production Build erfolgreich.
- Prisma Validation und Status erfolgreich; alle 16 Migrationen aktuell. Alle
  Migrationen zusätzlich isoliert auf frischer SQLite-Datei angewendet; Schema-Diff
  ohne Abweichung. Die neue nullable Spalte wurde zusätzlich auf einer Kopie der befüllten Entwicklungsdatenbank geprüft; alle bisherigen Werte und Fremdschlüssel blieben erhalten.
- Vollständige globale Seeds zweimal auf der gesicherten privaten Entwicklungs-DB:
  589 globale Jutsu inklusive aller 579 registrierten Seeds, 20 Enemy Templates,
  sechs globale Missionsvorlagen und eine Atlasvorlage. Kampagnendaten unverändert.
  Die 221 bereits bekannten nicht exakt auflösbaren Jutsu-Prerequisite-Texte
  bleiben als bestehende Datenlücke erhalten.
- Vollständige private Pakete isoliert importiert: 85 NPCs, 25 Character Sheets,
  19 Organisationen, 48 Beziehungen, 83 Ortsverknüpfungen und 22 neue Missionen.
  Zweiter Import ohne neue Datensätze/Tabellenänderungen; manuelle Notiz erhalten;
  Foreign-Key-Check ohne Fehler; Entwicklungs-DB nicht mit Test-Lore befüllt.
- Elf echte Edge-Browserprüfschritte gegen Production Build auf separater DB-Kopie:
  DM-Katalog, Auswahl, fehlende Orte, Atlasimport, Lore-/Kampfimport, Wiederholung,
  Vorschläge/Missionen, Location-Verknüpfungen, NPC im Encounter-Teilnehmereditor,
  persistenter Run, mobile Darstellung und Spieler-Schutz. Keine JavaScript-
  Laufzeitexception im erfolgreichen Durchlauf. Die elf Schritte fassen einzelne
  zusammengehörige Aktionen zusammen.
- Artefaktprüfung: 49 Trace-Manifeste und 56 Clientdateien ohne private
  Laufzeitdateien bzw. die acht geprüften privaten Profiltext-Canaries.

Private Nachweise: `.local-backups/living-proof-results.json`,
`living-browser-results.json`, `living-artifact-check.json`,
`living-location-desktop.png`, `living-import-mobile.png`, `seed-audit.json`, `final-seed-results.json` und
`living-profile-migration-results.json`.

Offene Lore-Entscheidungen bleiben die widersprüchlichen Alter/Reserven,
Stammbaum-Zusammenfassungen, einzelne Genin-Zuordnungen, Jutsu-Varianten und
exklusive Clanführungen. Itohara/Shiranami sind Vorschläge, keine bestätigte
Vault-Genealogie. Die vier ursprünglichen Team-/Sensei-Dateienpaare sind weiterhin
leer. Portrait-Verweise sind erhalten; nicht heruntergeladene private Bilddateien
müssen separat über die bestehende Portrait-Verwaltung eingebunden werden.
Unbenannte Personen oder fehlende Fähigkeiten wurden nicht erfunden.

Keine reale Kampagne wurde mit allen Vorschlägen automatisch befüllt. Manuelle
Prüfungen auf Safari/Firefox, echten Touch-Geräten und mit Screenreader sowie
History-Bereinigung/Zugangsrotation vor Deployment bleiben erforderlich.
