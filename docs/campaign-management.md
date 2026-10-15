# Campaign Management – technischer Zwischenstand

Stand: 14.10.2026. **Mission-/Session-Iteration und anschliessender Integrations-/UX-Durchlauf sind abgeschlossen.** Dieser Stand
implementiert NPC-Profile, die Wiederverwendung von Shinobi-Charakterbögen,
Organisationen, Teams und gerichtete Beziehungen sowie den vollständigen Enemy
Template Builder und das Bestiary mit 20 globalen Seed-Vorlagen sowie Encounter-
Vorlagen, unabhängige Runs und den persistenten Live Combat Manager. Missionen,
Missions-Seeds und GameSession-Verknüpfungen sind ebenfalls implementiert;
der aktuelle Umfang und die Prüfungen stehen im Abschnitt „Missionen und Sessions“.

## Repository-Audit und Architekturplan

Die Anwendung ist eine bestehende Next.js-16-App mit React 19, Server Components,
Server Actions, Prisma 6, SQLite, Zod und Vitest. Die lokalen Next.js-Anleitungen
für Server Functions und asynchrone Page-Parameter wurden berücksichtigt.

| Bestand | Befund und Wiederverwendung |
| --- | --- |
| Prisma / Migrationen | Kampagne als Mandant; additive Migrationen. HP-Historie und besondere Chakra-Naturen sind bereits migriert. Bestehende Tabellen und Datensätze werden nicht ersetzt. |
| Character Creator | Standard Array, Point Buy, manuelle Attribute, D8/D10 und HP-Würfe. Der bestehende Creator bleibt erhalten. NPCs können einen dort erstellten Charakter verknüpfen. |
| Character Sheet | HP-Historie, Fertigkeiten, Rettungswürfe, Jutsu und DM-Controls. Shinobi-NPCs verwenden dieselbe Route und dieselben Komponenten. |
| CharacterDMData | Bestehende interne Kampf-/Charakternotizen bleiben dort. NPC-spezifische Identitätsgeheimnisse liegen separat im NPC-Profil. |
| Rules Engine | `src/lib/rules/index.ts`: HP, AC, Initiative, Chakra, Rast und Charaktererstellung. Neue Shinobi-Bögen verwenden `calculateMaxHp` und `calculateMaxChakra`; keine zweite Kampfberechnung. |
| HP-Änderungen | `character-hp.ts`, HP-Historie und Level-Up bleiben massgeblich. Keine direkten Level-Sprünge durch den NPC-Editor. |
| Kampagnenzugriff | `requireCampaign` prüft die Cookie-Session, deren Ablauf und Kampagnen-ID; der zweite Parameter verlangt DM-Rechte. Neue Lese-/Schreibzugriffe verwenden diesen Mechanismus. |
| Jutsu | Globale und kampagneneigene Datensätze; Vergabe über bestehende DM-Controls. Der Sheet-Loader beschränkt die Auswahl nun auf globale und eigene Jutsu. |
| Sessions | `GameSession` hat Status, getrennte DM-/Spielernotizen und eine Version; Missionen/Runs sind über kampagnengeprüfte Zuordnungen integriert. |
| Welt | Hierarchische `Location`-Datensätze mit Spielerfreigabe. NPC und Organisation können einen kampagneneigenen Ort referenzieren. |
| UI | Bestehende CSS-Klassen, ToastProvider, Server Components. Neue Formulare verwenden denselben Stil, mit Pending-Zustand, sichtbaren Fehlermeldungen und Toasts. |
| Seed | `prisma/seed.ts` lädt Jutsu/Chakra-Naturen, danach `seedBestiary` und `seedMissions`: 20 globale Gegner und sechs globale Missionsvorlagen über eindeutige Seed-Keys. |
| Tests | Rules-, Creator-, DM-, Jutsu-, Session-/Access-Tests sowie SQLite-Integrationstests vorhanden. Neue Integrationstests wenden die ganze Migrationskette auf eine temporäre Datenbank an. |

Missionen/Ziele, globale Vorlagen, GameSession-Verknüpfungen und die zugehörigen
Sicherheits-/Workflowtests sind ebenfalls abgeschlossen; optionale Erweiterungen
stehen am Ende des Dokuments.

## Neue Datenmodelle

- `Npc`: kampagnengebundene Identität, Kategorie, davon unabhängige Haltung,
  optionale demografische Daten, öffentliche Beschreibung/Notizen, interne
  Hintergrundgeschichte/Persönlichkeit/Geheimnisse, Zugehörigkeit, Rang, Dorf,
  Clan, Portrait-URL, Ort, Freigabe und Archivstatus.
- `Npc.characterId`: optionale eindeutige Verbindung zu `Character`. Ein einfaches
  Zivilistenprofil erzeugt keinen Charakter, kein Chakra und keine Jutsu.
- `Organization`: Team, Clan, Familie, ANBU, Gilde, politische Organisation,
  Fraktion oder sonstige Gruppierung; Ort, Beschreibung, interne Notizen,
  Geheimnisse, Freigabe und Archivstatus.
- `OrganizationMember`: entweder NPC oder eigenständiger Spielercharakter,
  Freitextrolle und Leitungskennzeichen. Mehrere Organisationen pro Person und
  mehrere Leiter sind erlaubt; keine Grenze für Teamgrössen.
- `CharacterRelationship`: gerichtete Verbindung zwischen zwei NPCs oder
  Spielercharakteren, Typ, Beschreibung, Geheimnisse und separate Freigabe.

Mitgliedschaften und Beziehungen benutzen bei einem verknüpften Charakter immer
die NPC-Identität. Dadurch bleiben sie bei der späteren Aktivierung des
Shinobi-Bogens bestehen. Ein bereits in Organisationen/Beziehungen verwendeter
Spielercharakter kann nicht stillschweigend in eine zweite Identität umgewandelt
werden: Die Aktion lehnt die Verknüpfung mit einer konkreten Fehlermeldung ab.
Die beiden Editoren synchronisieren Namensänderungen zwischen NPC und Bogen.

## Migration und Betrieb

Migration: `prisma/migrations/20261014120000_campaign_people/migration.sql`.
Sie erstellt ausschliesslich vier neue Tabellen mit Fremdschlüsseln und Indizes.
SQL-CHECKs erzwingen genau eine Personenidentität pro Mitgliedschaft und pro
Beziehungsende sowie unterschiedliche Ausgangs-/Zielpersonen. Diese CHECKs
sind bewusst im SQL dokumentiert, da Prisma sie nicht im Schema ausdrücken kann.
Kampagnenzugehörigkeit verknüpfter Datensätze wird in Server Actions innerhalb
der jeweiligen Transaktion geprüft.

Vor dem Einsatz die bestehende SQLite-Datei sichern und aus dem Projektverzeichnis
die normale Migration ausführen:

```sh
npx prisma migrate deploy
npx prisma generate
```

Alle drei additiven Campaign-Management-Migrationen wurden auf der lokalen `dev.db`
angewendet; der Prisma Client wurde generiert. Vor dem Bestiary-Upgrade wurde
eine SQLite-Sicherung unter `.local-backups/pre-bestiary-*.sqlite` erstellt. Ein
Vorher-/Nachher-Fingerprint bestätigt unveränderte bestehende Kampagnen,
Charaktere samt Ressourcen und Verknüpfungen, NPCs, Organisationen, Beziehungen,
Sessions und Orte. Es gab keinen Datenbank-Reset. Tests und Migrationsprüfungen
verwenden zusätzlich getrennte temporäre SQLite-Dateien. Die Seeds erzeugen
keine kampagnenspezifischen Beispieldaten.

## Berechtigungen und Freigabe

Alle neuen Mutationen verlangen `requireCampaign(campaignId, true)`. Orte,
Charaktere, NPCs und Organisationen werden zusätzlich mit der Kampagnen-ID gesucht.
Schreibvorgänge mit mehreren betroffenen Datensätzen laufen in Transaktionen.

Spielerabfragen lesen ausschliesslich freigegebene, nicht archivierte Profile.
Explizite Prisma-Selects schliessen DM-Geheimnisse, Hintergrundgeschichte,
Persönlichkeit und interne Teamnotizen bereits beim Datenbankzugriff aus.
Öffentliche Orte werden nicht indirekt durch einen unveröffentlichten
Hauptsitz/Standort offengelegt; Ortsverknüpfungen werden derzeit nur dem DM gezeigt.
Eine Organisationsfreigabe veröffentlicht keine verborgenen Mitglieder.
Eine Beziehungsfreigabe wirkt nur, wenn auch beide Personen sichtbar sind.

Die bestehenden Kampagnen- und Charakterübersichten sowie direkte Bogenaufrufe
verwenden `characterVisibility`. So kann ein Spieler einen verborgenen oder
archivierten NPC nicht über dessen Character-ID lesen. Bestehende
Spielercharaktere ohne NPC-Profil bleiben sichtbar.

## Seiten und Bedienung

Alle Pfade beginnen mit `/campaign/[campaignId]`:

| Pfad | Funktion |
| --- | --- |
| `/npcs` | Suche, Kategorie, Zugehörigkeit, Rang, Freigabe und Archivfilter |
| `/npcs/new` | NPC-Creator, nur DM |
| `/npcs/[npcId]` | Freigegebenes Profil oder vollständige DM-Ansicht, Organisationen, Bogenaktivierung und Archiv |
| `/npcs/[npcId]/edit` | NPC-Editor, nur DM |
| `/organizations` | Suche, Typfilter, Archiv und Organisationserstellung |
| `/organizations/[organizationId]` | Team-Builder, Mitglieder, Rollen, Sensei/Leitung, Editor und Archiv |
| `/organizations/relationships` | Gerichtete Beziehungen zwischen NPCs und Spielercharakteren, Freigaben und Aktualisierung |
| `/bestiary` | DM-Bibliothek, Suche, Kategorie, Schwierigkeit, Rang, Herkunft und Archivfilter |
| `/bestiary/new` | Vollständiger Enemy Builder |
| `/bestiary/[templateId]` | Statblock, kampagneneigene Kopie, Archivierung/Wiederherstellung |
| `/bestiary/[templateId]/edit` | Bearbeitung eigener Vorlagen mit Versionsprüfung |
| `/encounters` | DM-Übersicht, Suche, Typ-/Statusfilter |
| `/encounters/new` | Encounter-Vorlage erstellen |
| `/encounters/[encounterId]` | Vorlageneditor, Teilnehmer, Ereignisse und Run-Historie |
| `/encounters/runs/[runId]` | Persistenter Live Combat Manager / abgeschlossene Run-Historie |

Neue gemeinsame Komponenten: `PeopleForm` (Pending, Fehler, Toast,
Bestätigung, Navigation nach Erfolg) und `PeopleFields` (Formularfelder).

### Aktuell ausführbarer DM-Ablauf

1. Unter **NPCs → NPC erstellen** beispielsweise einen Zivilisten oder Shinobi
   anlegen. Kategorie und Haltung unabhängig wählen; standardmässig verborgen.
2. Optional unter **Shinobi-Charakterbogen hinzufügen** einen vorhandenen
   kampagneneigenen Charakter verknüpfen oder einen neuen Bogen auf Stufe 1
   erzeugen. HP und Chakra werden durch die bestehende Rules Engine berechnet.
3. Den Bogen öffnen und Attribute, HP, Chakra, Naturen, Jutsu, Fertigkeiten und
   Rettungswürfe über die bestehenden DM-Controls einstellen. Für höhere Stufen
   den vorhandenen Creator oder den bestehenden Level-Up-Prozess verwenden.
4. Unter **Teams & Organisationen** ein Team erstellen, NPCs und Spielercharaktere
   hinzufügen, Rollen vergeben und den Sensei als Leitung markieren.
5. Dieselbe Person bei Bedarf zusätzlich einem Clan oder einer Gilde zuordnen.
6. Unter **Charakterbeziehungen verwalten** Ausgangsperson, Zielperson und Typ
   wählen. Dieselbe Kombination aktualisiert den Eintrag; die Gegenrichtung ist
   ein eigener Eintrag. Freigegebene Beziehungen bleiben ohne Geheimnisse.
7. Profile und Organisationen erst nach Prüfung für Spieler freigeben.
8. Nicht mehr benötigte Profile archivieren. Unverknüpfte NPCs können anschliessend
   mit Namensbestätigung endgültig gelöscht werden. Verknüpfte Bögen bleiben
   durch Archivierung erhalten und werden nicht durch NPC-Löschung freigelegt.

### Noch nicht ausführbarer Teil des gewünschten Gesamtworkflows

Mission erstellen → vorhandenen Encounter verknüpfen → Mission/Run einer
GameSession zuweisen → Missionsziele verfolgen → Mission abschliessen. Encounter-
Vorbereitung, Initiative und Kampfdurchführung sind bereits implementiert. Für
Missionen und Session-Zuordnungen gibt es keine Platzhalter-Buttons.

## Offene Implementierung und erforderliche Prüfungen

| Phase | Offene Arbeit |
| --- | --- |
| 6 | Mission, Objective, NPC-/Orts-/Encounter-Verknüpfungen, Board, DM-/Player-Projektionen, persistente Checkliste, serverseitige Statusmaschine |
| 7 | Sechs globale Beispielmissionsvorlagen mit explizitem Kampagnenimport; keine automatische Änderung bestehender Kampagnen |
| 8 | Mission-/NPC-/Encounter-Zuordnung zu GameSession; Kampfruns, Ressourcenpersistenz und Idempotenz sind bereits implementiert |
| 9–11 | Neue Systeme durchgehend auf Cross-Campaign-Zugriffe und Geheimnislecks testen; vollständige Browser- und Reload-Tests für Missionen/Kampf ergänzen |
| 12 | Diese Dokumentation um tatsächlich implementierte Modelle, Seeds und den vollständigen Session-Workflow erweitern |

Bei Enemy-Instances dürfen keine Template-Felder durch Kampfaktionen verändert
werden. Jede Durchführung benötigt eigene Teilnehmer-IDs, Ressourcen und eine
Versionsnummer. Relative Aktionen sollten eine einmalige Request-ID und eine
atomare Versionsprüfung erhalten. Mission-Rang, Gegner-Rang, Kategorie und
Schwierigkeit bleiben getrennte Konzepte.

Chakrafreie Statblocks und interaktive Run-Teilnehmer mit persistenten Ressourcen
sind implementiert. Einfache NPCs benötigen weiterhin keine Kampfwerte.
Bogenaktivierung erstellt einen Shinobi mit
Standardattributen, keinen vollständigen mehrstufigen NPC-Kampfwerte-Creator.
Portraits sind sichere HTTP(S)-Links, kein Bild-Upload. Organisationen werden
archiviert; endgültige Organisationslöschung wird nicht angeboten. Freigegebene
Beziehungen werden auf der gemeinsamen Beziehungsseite angezeigt; die Liste im
NPC-Detail ist DM-intern. Formulare bieten HTML-Validierung und serverseitige
Fehlermeldungen, keine vollständige feldweise Zod-Lokalisierung. Automatisierte
Browserprüfung und manuelle Prüfung der responsiven Ansichten stehen aus.

## Qualitätssicherung

`people.integration.test.ts` prüft echte SQLite-Persistenz nach Anwendung aller
Migrationen: NPC-Erstellung und Bearbeitung, Validierung, spätere Bogenaktivierung,
Namenssynchronisation, Mitgliedschaften ohne Teamgrössenlimit, gerichtete
Beziehungen, Archivierung/Löschung, Cross-Campaign-Verweise, Schreibrechte,
öffentliche Server-Component-Ausgaben, verborgene direkte Bogen-URLs und
Datenbank-CHECKs. Die vorhandenen Tests prüfen weiter Creator, Regeln, HP,
DM-Controls, Jutsu und Kampagnenzugang. GameSession hat bisher keine zusätzliche
dedizierte Regressionstest-Suite.

Prüfbefehle:

```sh
npm run typecheck
npm run lint
npm run test -- --maxWorkers=2
npm run build
npx prisma validate
```

Der erste unbeschränkte parallele Testlauf hatte einen Worker-Start-Timeout;
der vollständige Lauf mit zwei Workern war erfolgreich. Die reduzierte
Workerzahl ist ein Aufrufparameter, keine Änderung der Projektkonfiguration.

Historischer Prüfstand der ersten NPC-/Organisationsiteration:

- Typecheck und ESLint erfolgreich.
- 15 Testdateien, 269 erfolgreiche Tests; davon 16 neue SQLite-Integrationstests.
- Production Build erfolgreich, einschliesslich aller sieben neuen Routen.
- Prisma Validation erfolgreich.
- `prisma migrate deploy` mit allen zehn Migrationen auf einer separaten
  temporären SQLite-Datei erfolgreich; `migrate status` aktuell und
  `migrate diff --exit-code` ohne Schemaabweichung.
- `git diff --check` erfolgreich.

Dieser historische Prüfstand betraf die NPC-/Organisationsiteration. Die
Ergebnisse der aktuellen Bestiary-Iteration stehen im folgenden Abschnitt.

## Abgeschlossene Iteration: Enemy Builder und Bestiary

### Architektur und Datenmodell

Die Migration `20261014140000_enemy_templates` ergänzt ausschliesslich
`EnemyTemplate`, `EnemyTemplateNature` und `EnemyTemplateJutsu`. Bestehende
Tabellen werden nicht ersetzt. Kategorie, Schwierigkeit und optionaler
Ninja-Rang sind unabhängige Prisma-Enums. Die Kampfstufe steuert Übungsbonus und
Chakra-Berechnung. Der empfohlene Levelbereich dient nur zur Planung und wird
auf eine sinnvolle Reihenfolge zwischen 1 und 20 validiert.

Ein Template besitzt Name, Beschreibung, sechs Attribute (1–30), maximale HP,
Bewegung, optionale Overrides für AC und Initiative, optionale Chakra-Nutzung,
Reservoir und gegebenenfalls Multiplikator, Chakra-Override, Kontrolle und
Regeneration. Weitere Daten sind Angriffe, Fähigkeiten, Resistenzen, Taktik,
Fertigkeiten, geübte Rettungswürfe, Belohnung und optionale Erfahrungspunkte.

Angriffe, Fähigkeiten, Fertigkeiten und Rettungswürfe sind strukturierte,
serverseitig mit Zod validierte JSON-Wertobjekte. Die UI verwendet normale
Formularfelder, Listen und Checkboxen. Angriffe enthalten Name, Trefferbonus,
Schadenswürfel, Schadensart, Reichweite und Beschreibung. Mindestens ein Angriff
ist erforderlich. Schadensausdrücke sind begrenzte Würfelnotationen wie
`1d6+2`; sie werden nicht als Code ausgewertet. Fähigkeiten enthalten Namen und
ausformulierte Effekte, Kosten und Begrenzungen. Resistenzen und besondere
Fähigkeiten sind Beschreibungen, keine automatisierte Kampfausführung.

Jutsu und Naturen sind echte Fremdschlüsselverknüpfungen zu den bestehenden
Bibliotheken. Der Server prüft Existenz, Kampagnenzugehörigkeit, Chakra-Kosten,
Naturen und alle gespeicherten Jutsu-Voraussetzungslinks. Ungültige Änderungen
werden vollständig zurückgerollt. Referenzierte Jutsu/Naturen können nicht mit
verwaisten Bestiary-Links gelöscht werden (`Restrict`). Globale Vorlagen
verwenden ausschliesslich globale Jutsu; eigene Vorlagen zusätzlich Jutsu der
eigenen Kampagne.

Gegner ohne Chakra erhalten `hasChakra=false`, keine Naturen/Jutsu und keine
Chakra-Overrides. `enemyMaxChakra` liefert für sie `null`; es gibt keinen
Chakra-Erschöpfungszustand. Chakra-Gegner verwenden `calculateMaxChakra`.
AC, Initiative, Fertigkeiten, Rettungswürfe und Übungsbonus verwenden dieselben
Rules-Engine-Funktionen wie bestehende Charaktere. HP sind frei gesetzte
Gegnerwerte und benötigen bewusst keine Spielercharakter-Levelhistorie.

Die Migration ergänzt CHECKs für positive HP, gültige Levelbereiche, globale
Seed-Zuordnung und konsistente Chakra-Overrides. Weitere Validierungen erfolgen
in den Server Actions. Prisma kann diese CHECKs nicht im Schema ausdrücken.

### Bibliothek, Berechtigungen und Änderungen

Alle Bestiary-Leser, Builder-Optionen und Mutationen verlangen serverseitig
`requireCampaign(campaignId, true)`. Spieler erhalten auch bei direkten URLs
und bekannten globalen IDs keinen Zugriff. Die Navigation zeigt den Bereich
nur DMs; diese Anzeige ersetzt keine Serverprüfung.

- `campaignId=null` und eindeutiger `seedKey`: globale Seed-Vorlage, nur lesbar.
- `campaignId=<eigene Kampagne>` und `seedKey=null`: eigene Vorlage, editierbar.
- **Duplizieren** kopiert Werte und Referenzen in eine neue aktive Vorlage
  der eigenen Kampagne; `sourceTemplateId` merkt sich die Herkunft.
- Globale Vorlagen können durch UI-/Server-Actions weder überschrieben noch
  archiviert werden. Fremde Kampagnenvorlagen sind auch für Kopien unzugänglich.
- Eigene Vorlagen können archiviert und wiederhergestellt werden. Die normale
  Liste blendet Archive aus. Keine endgültige Löschung von Templates, damit
  spätere Referenzen erhalten bleiben.
- `version` wird bei tatsächlichen Änderungen erhöht. Editor und Archivierung
  verlangen die geladene Version. Veraltete Requests werden mit Aufforderung
  zum Neuladen abgelehnt, statt neuere Werte zu überschreiben.

`src/lib/enemy-library.ts` kapselt geschützte Leser,
`src/app/campaign/enemy-actions.ts` die Mutationen,
`src/lib/enemy-templates.ts` die gemeinsame Validierung und
`src/lib/rules/enemies.ts` die Regelanwendung.

### Seed-Strategie und Inhalt

`seeding/enemy-templates.ts` enthält exakt 20 individuelle Vorlagen:

| Kategorie | Vorlagen |
| --- | --- |
| Tiere | Katze, Hund, Wolf, Wildschwein, Grosser Wolf |
| Gewöhnliche Gegner | Strassenräuber, Bandit, Banditenanführer, Söldner, Bewaffneter Schmuggler |
| Shinobi | Akademieschüler, Genin, Erfahrener Genin, Chunin, Chunin-Spezialist, Jonin |
| Missing-Nin | Nukenin-Späher, Nukenin-Assassine, Nukenin-Suiton-Spezialist, Elite-Missing-Nin |

Vorlagen haben abgestufte HP, Attribute, Angriffe, sechs Schwierigkeitsgrade,
individuelle Beschreibungen und Taktiken. Tiere und gewöhnliche Gegner sind
ohne Chakra spielbar. Shinobi besitzen vorhandene Wasser-, Feuer-, Wind- oder
Blitz-Jutsu. Rudeltaktik, Ansturm, Präzisionsangriff und Mehrfachangriff
unterscheiden die Kampfrollen.

`prisma/seed.ts` ruft nach dem bisherigen Jutsu-/Natur-Seed `seedBestiary` aus
`prisma/seed-bestiary.ts` auf. Alle 20 Vorlagen werden in einer Transaktion
validiert und anhand eindeutiger `bestiary:v1:*`-Keys angelegt oder aktualisiert.
Fehlende oder mehrdeutige globale Jutsu-Referenzen brechen den Bestiary-Schritt
ab. Unveränderte Templates behalten IDs, Zeitstempel, Version und Links exakt
bei. Tatsächliche Seed-Änderungen aktualisieren ausschliesslich globale
Vorlagen; Kampagnenkopien bleiben unverändert. Das gesamte Seed-Kommando
liefert bei Fehlern jetzt einen fehlerhaften Exit-Code.

```sh
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

Die komplette Seed-Kette wurde auf einer frischen temporären Datenbank zweimal
erfolgreich ausgeführt: 579 Jutsu-Seed-Einträge und 20 globale Enemy Templates.
Der bestehende Jutsu-Importer meldet weiterhin 221 nicht aufgelöste textuelle
Voraussetzungen aus den bisherigen Quelldaten. Diese Importgrenze wurde nicht
umgebaut: Bestiary-Jutsu prüfen alle tatsächlich gespeicherten Voraussetzungslinks
und zeigen vorhandene Voraussetzungstexte im Statblock. Es entstehen keine
nicht existierenden Jutsu-Referenzen. Die 20 Gegner sind auch in der lokalen
`dev.db` eingespielt; bestehende Kampagnendaten blieben nachweislich unverändert.

### DM-Workflow

1. In einer DM-Kampagne **Bestiary** öffnen und nach Name/Beschreibung, Kategorie,
   Schwierigkeit, Ninja-Rang oder globaler/eigener Herkunft filtern.
2. Eine globale Vorlage öffnen und **Für diese Kampagne duplizieren** wählen.
   Alternativ **Gegnervorlage erstellen** für einen neuen Gegner verwenden.
3. Profil, unabhängige Schwierigkeit, Levelbereich, HP und Attribute festlegen.
   AC und Initiative werden live aus DEX angezeigt; Overrides sind optional.
4. Für Shinobi **Dieser Gegner nutzt Chakra** aktivieren, Reservoir, Kontrolle,
   Regeneration, Naturen und Jutsu auswählen. Die Chakra-Vorschau verwendet die
   bestehende Berechnung. Für Tiere/gewöhnliche Gegner Chakra deaktiviert lassen.
5. Angriffe und Fähigkeiten interaktiv hinzufügen/entfernen; Rettungswürfe,
   Fertigkeiten, Taktik und Belohnung setzen. Speichern öffnet den vollständigen
   Statblock. Bei Fehlern bleiben die Eingaben erhalten.
6. Eigene Vorlagen bearbeiten, duplizieren oder nach Bestätigung archivieren.
   Archivierte Vorlagen über den Archivfilter wiederherstellen.

Neue Komponenten: `EnemyBuilder` und `EnemyStatblock`; bestehendes `PeopleForm`
wird für Pending, Toasts, Fehlermeldungen und Bestätigungen wiederverwendet.
Builder-Werte werden kontrolliert verwaltet, damit fehlgeschlagene Requests
keine Eingaben zurücksetzen. Der Bereich besitzt einen Ladezustand und eine
eigene Fehleransicht mit erneutem Versuch.

### Vorbereitung für Encounter-Instances

Templates enthalten keine aktuellen HP, verbrauchtes Chakra, Initiativewürfe,
Zustände oder Runden. `enemyBlueprint(template)` erzeugt ein losgelöstes
Wertobjekt mit Schema-Version, Template-ID/-Version, berechneter
AC/Initiative/Chakra und kopierten Angriffen, Fähigkeiten und Jutsu. Die
Unabhängigkeit verschachtelter Kopien ist getestet. Spätere Teilnehmer können
diesen Stand beim Erstellen übernehmen, ohne Templates oder andere Teilnehmer
zu verändern.

Dieser Bestiary-Abschnitt beschreibt den damaligen Übergabestand. Die folgende
Encounter-Iteration implementiert nun persistente Run-Teilnehmer, eigene IDs,
Ressourcen/Zustände, Initiative und Combat-Sheets einschliesslich separater
Transaktions-/Idempotenzregeln.

### Prüfungsergebnisse dieser Iteration

- **18 Testdateien, 318 erfolgreiche Tests**, darunter 40 neue echte
  SQLite-Integrationstests, vier Rules-Tests und fünf interaktive Builder-Tests.
- Geprüft: Erstellung, Bearbeitung, Archiv/Wiederherstellung, globale/eigene
  Kopien, Update-Konflikte, Jutsu-/Natur-Validierung, Seed-Integrität und strikte
  Idempotenz, fehlende Referenzen, DM-/Player-Rechte, direkte URLs,
  Kampagnenisolation, Formulareingabenerhalt und losgelöste Blueprint-Kopien.
- Upgrade-Test mit gefüllten Character-, NPC-, Team-, Mitgliedschafts- und
  Beziehungstabellen: Daten bleiben exakt erhalten.
- Bestehende NPC-/Organisations-, Creator-, Sheet-/HP-, DM-, Jutsu-, Rules- und
  Session-/Access-Tests erfolgreich.
- Typecheck, ESLint und Production Build mit allen vier neuen Seiten erfolgreich.
- Prisma Validation und isoliertes Deployment aller elf Migrationen erfolgreich;
  Schema-Abgleich ohne Drift und Fremdschlüsselprüfung ohne Verstösse.

Manuelle visuelle Browserprüfung und durchgehende Browser-E2E-Tests sind nicht
Bestandteil dieser Prüfung. Builder-Interaktionen sind automatisiert in jsdom
getestet. Encounter-Balance bleibt eine DM-Entscheidung; Schwierigkeitsgrade
werden nicht automatisch aus Rang oder HP abgeleitet.

Die Iteration Enemy Template Builder / Bestiary inklusive Seeds ist abgeschlossen.
Die nachfolgende Encounter-Iteration ergänzt die Durchführung dieser Gegner.

## Abgeschlossene Iteration: Encounter Builder und Live Combat Manager

### Datenmodell und Migration

Migration `20261014160000_encounters` erstellt ausschliesslich fünf neue Tabellen:

| Modell | Verantwortung |
| --- | --- |
| `Encounter` | Kampagnenvorlage mit Name, Beschreibung, Typ, Schwierigkeit, optionalem Location-FK, DM-Notizen, Status, vorbereiteten Ereignissen und Version |
| `EncounterParticipantPlan` | Genau eine Quelle: EnemyTemplate, Character oder Npc; Anzahl, Seite, Notizen und optionale Werteabweichungen |
| `EncounterRun` | Unabhängige Durchführung mit kopierten Metadaten/Ereignissen, Template-Version, Runde, aktivem Teilnehmer, Abschluss und Versionszähler |
| `EncounterRunParticipant` | Eindeutige Teilnehmer-ID, Quellenherkunft, eigenständiger JSON-Statblock, eigene HP/Chakra/Initiative/Zustände/Markierungen/Notizen |
| `EncounterRunAction` | Request-ID, Payload-Hash und angewendete Version zur atomaren Deduplizierung von Aktionen |

Fremdschlüssel verbinden Vorlagen mit Kampagnen, Orten, Charakteren, NPCs und
Gegnervorlagen. CHECKs erzwingen genau eine Quelle, erlaubte Gruppengrössen,
konsistente optionale Ressourcen und gültige HP-/Chakra-Grenzen. Weitere CHECKs
sichern Vorbereitungs-/Endzustände und nicht negative Runden. Run-Teilnehmer
haben eine stabile Reihenfolge pro Run. Aktive Teilnehmer werden ausschliesslich
aus den Teilnehmern desselben Runs ausgewählt und serverseitig geprüft.

Einfache NPCs bleiben Erzählteilnehmer mit `maxHp/currentHp=null` und ohne Chakra.
Ein optionaler HP-Override macht sie innerhalb dieses Encounters kampffähig,
ohne einen Character-Datensatz oder Chakra zu erzeugen. Tiere können über das
Bestiary oder vorhandene NPC-Identitäten hinzugefügt werden. Shinobi-NPCs
verwenden ihren vorhandenen Charakterbogen. Spielercharaktere mit NPC-Identität
werden nur über das NPC-Profil angeboten, sodass keine doppelten Identitäten
entstehen. Dieselbe Person kann nur einmal pro Vorlage vorkommen. Von einem
Enemy Template sind mehrere Gruppen und jeweils 1–20 Kopien erlaubt; insgesamt
höchstens 100 Teilnehmer pro Run.

### Snapshots und Wiederverwendung

Eine **neue Durchführung vorbereiten** erzeugt aus einer bereiten Vorlage einen
Run im Zustand `PREPARING`. Bereits zu diesem Zeitpunkt werden Metadaten, Ort,
Ereignisse und alle benötigten Statblocks kopiert. Spätere Änderungen an
Vorlage, Ort, NPC, Charakter, Enemy Template oder Jutsu verändern diesen Run
nicht. Jede Kopie einer Gegnergruppe erhält eine eigene persistierte ID und
eigene Ressourcen. Eine neue Durchführung derselben Vorlage erzeugt neue
Teilnehmer und übernimmt den dann aktuellen Quellenstand.

`enemyBlueprint` liefert die bestehenden Gegnerwerte. Charaktere verwenden
die gespeicherten, bereits durch die Character-/HP-Systeme bestimmten maximalen
HP sowie die gemeinsamen AC-, Initiative-, Chakra-, Skill- und Saving-Throw-
Funktionen. Bei Charakteren werden die aktuellen HP und Chakra übernommen,
nicht automatisch aufgefüllt. Gegner starten mit vollen Ressourcen. HP-Overrides
erhalten bereits erlittenen Charakterschaden über `preserveHpDamage`.
Chakra-Overrides verwenden `preserveChakra` und die vorhandenen Grenzen.
Chakrafreie Teilnehmer erhalten nie eine Chakra-Erschöpfungsstrafe.

Archivierte Quellen sind für neue Teilnehmer und neue Snapshots nicht verfügbar;
bereits laufende Runs bleiben benutzbar. Entfernte Plan-Einträge lösen lediglich
deren Herkunfts-FK im Run; der Snapshot und die historische Quellen-ID bleiben
erhalten. Vorlagen mit Run-Historie können archiviert, aber nicht endgültig
gelöscht werden. Endgültiges Löschen ist nur ohne Runs nach Archivierung und
Namensbestätigung möglich.

### Zustandsmaschine und Kampfregeln

- Vorlage: **Entwurf → Bereit → Archiviert**, mit Bearbeitung/Wiederherstellung
  über den Editor. Kampf-/gemischte Vorlagen benötigen vor der Freigabe Teilnehmer.
- Run: **Vorbereitung → Aktiv → Abgeschlossen**. Vorbereitung und aktive Runs
  können alternativ **Abgebrochen** werden. Beide Endzustände sind schreibgeschützt.
- Initiative wird in der Vorbereitung als Gesamtwert eingegeben oder serverseitig
  mit W20 plus dem Snapshot-Bonus gewürfelt. Für alle Kampfteilnehmer muss sie
  vor dem Start vorliegen. Nach Beginn ist die Reihenfolge fest.
- Sortierung: höhere Initiative, höherer Initiativebonus, stabile gespeicherte
  Teilnehmerposition. Runde 1 beginnt beim ersten handlungsfähigen Teilnehmer.
  Beim Überschreiten des Listenendes erhöht „Nächster Zug“ die Runde genau einmal.
- Besiegte, bewusstlose Teilnehmer und 0 HP werden bei kommenden Zügen
  übersprungen. Die aktive Markierung bleibt bis zum ausdrücklichen nächsten
  Zug bestehen. Alle anderen Zustände verwaltet der DM ohne automatisches
  Überspringen; dadurch bleiben z. B. Zustandsdauern am Zugende kontrollierbar.
- HP werden zwischen 0 und Maximum begrenzt. 0 HP setzen bewusstlos; Heilung
  von 0 HP hebt das auf und setzt entsprechend der vorhandenen Heilregel
  „schwer verwundet“. Eine explizite Besiegt-Markierung bleibt unabhängig und
  muss bei Bedarf bewusst aufgehoben werden. Manuelle Bewusstlosigkeit bei
  positiven HP wird durch normalen Schaden nicht aufgehoben.
- Chakra-Verbrauch über den aktuellen Vorrat hinaus wird abgelehnt. Wiederherstellung
  wird auf das Maximum begrenzt. Chakrafreie Teilnehmer haben keine Chakra-Aktionen.
- HP, Chakra, Zustände, Markierungen, Ereignisse und Notizen sind bereits während
  der Vorbereitung korrigierbar und während eines aktiven Runs persistent.
- Soziale, Erkundungs- und Verfolgungs-Encounters können auch ohne Kampfteilnehmer
  mit Ereignissen/Notizen durchgeführt werden. Sie benötigen keinen künstlichen
  Initiative-Eintrag; nächster Zug ist dann nicht verfügbar.

Angriffe und Jutsu stehen mit ihren übernommenen Werten in den Teilnehmerdetails.
Automatische Trefferwürfe, Jutsu-Ausführung, Konzentration, Tod/Rettungswürfe,
Zustandsdauern und Spezialeffekte sind keine neu eingeführte Rules Engine: Diese
entscheidet der DM und erfasst Ressourcen und Zustände über die vorhandenen
Run-Aktionen. Es gibt keine Platzhalter für solche Automatik.

### Transaktionen, Idempotenz und Berechtigungen

Alle neuen Leser, Optionen, Seiten und Aktionen verlangen serverseitig
`requireCampaign(campaignId, true)`. Es gibt derzeit keine Player-Projektion für
Encounter-Daten. Spieler können auch mit bekannten Vorlagen-, Run- und
Teilnehmer-IDs weder DM-Notizen noch geheime Teilnehmerinformationen lesen.
Quellen werden auf eigene Kampagne oder globale Bestiary-Vorlage eingeschränkt.
Fremde Locations, Characters, NPCs, Run-Teilnehmer und Ereignis-IDs werden abgewiesen.

Vorlagen und Runs verwenden optimistische Versionierung. Ein alter Editor oder
zweiter DM-Tab kann neuere Änderungen nicht überschreiben. Kampfaktionen ändern
Run-Version und Teilnehmerzustand zusammen mit einem Request-Beleg in einer
Transaktion. Ungültige Aktionen hinterlassen weder eine neue Version noch einen
Teilzustand. Gleichzeitige Requests derselben Ausgangsversion führen höchstens
eine Änderung durch. Der Start ist über eine kampagnengebundene Request-ID und
einen Hash von Vorlage/Version ebenfalls dedupliziert.

Wiederholung derselben Run-Request-ID mit identischem Inhalt wendet die Aktion
nicht erneut an, auch wenn inzwischen weitere Züge stattgefunden haben. Eine
Request-ID mit abweichendem Inhalt wird abgelehnt. Der Combat Manager sperrt
weitere Klicks während eines Requests. Wenn die Antwort verloren geht, bietet
er **Letzte Anfrage erneut senden** mit exakt derselben Request-ID und Payload
an. **Stand aktualisieren** lädt alternativ den bestätigten Serverstand.

Es gibt keinen WebSocket-/Polling-Dienst. Nach eigenen Aktionen wird der
bestätigte Run direkt angezeigt; Änderungen anderer DM-Tabs werden über
**Stand aktualisieren** geladen. Das ist ein bewusster aktueller Bedienablauf.

### Run-Zustand gegenüber Character Sheets

Alle aktuellen HP, Chakra, Initiativewürfe, Zustände, Besiegt-/Bewusstlos-
Markierungen, schwere Verwundung, Kampfnotizen, Runden und Ereignisfortschritte
gelten ausschliesslich für den Run. **Keine Kampfaktion schreibt in Character,
CharacterDMData, Npc, EnemyTemplate oder eine Jutsu-Quelle zurück.**

Eine spätere ausdrücklich gewählte Synchronisierung könnte aktuelle HP,
Chakra und persistente Verletzungen eines Spieler-/NPC-Charakters übernehmen.
Dafür wären eine Auswahl/Bestätigung pro Person, Prüfung des zwischenzeitlichen
Character-Stands, Begrenzung auf dessen aktuelle Maximalwerte und passende
Transaktions-/Versionsregeln erforderlich. Temporäre Gegnerzustände,
Vorlagen-Overrides, Initiativewürfe, Ereignisse und Besiegt-Markierungen sollten
keine Charakter-Grundwerte verändern. Eine solche Synchronisierung ist hier
bewusst nicht implementiert und hat keinen inaktiven UI-Button.

Missionen und GameSessions können später über kampagnengebundene Join-Modelle
auf die stabilen `Encounter.id` und `EncounterRun.id` verweisen. Es wurden keine
unvalidierten Freitext-IDs oder vorgezogenen Missions-/Session-Systeme ergänzt.

### Vollständig ausführbarer DM-Ablauf

1. **Encounters → Encounter erstellen**: Typ, Name, Schwierigkeit, optionalen Ort,
   Beschreibung, DM-Notizen und Ereignisse festlegen; als Entwurf speichern.
2. Unter **Teilnehmer hinzufügen** Bestiary-Gegner/Tiere, eigene Gegner,
   Spielercharaktere und NPCs wählen. Gegnerzahl, Seite und optionale Gruppen-
   Overrides setzen. Unterschiedliche Einzelwerte über getrennte Einträge planen.
3. Vorlage auf **Bereit** setzen und **Neue Durchführung vorbereiten** wählen.
   Jetzt werden die unabhängigen Snapshots und Teilnehmer gespeichert.
4. Im Combat Manager Initiativen einzeln eingeben/würfeln oder alle würfeln.
   Falls nötig bereits HP/Chakra korrigieren. **Begegnung starten** beginnt Runde 1.
5. **Nächster Zug**, Schaden/Heilung, Chakra-Aktionen, Zustände und Markierungen
   verwenden. Individuelle Statblocks und Jutsu stehen in den Teilnehmerdetails.
6. Ereignisse abhaken und Teilnehmer-/Run-Notizen speichern. Nach Reload ist
   derselbe bestätigte Kampfstand inklusive Runde und aktivem Teilnehmer vorhanden.
7. Mit Abschlussnotizen **Begegnung abschliessen** oder **Durchführung abbrechen**.
   Der Run bleibt als schreibgeschützte Historie über die Vorlage erreichbar.
8. Dieselbe Vorlage jederzeit erneut vorbereiten; neue Runs beeinflussen weder
   frühere Durchführungen noch ihre Quellen.

Die Oberfläche nutzt bestehendes Styling, PeopleForm, Toasts und gemeinsame
Komponenten. Desktop zeigt zwei Teilnehmerkarten nebeneinander, Tablet eine
breitere Karte pro Zeile. Initiative-Übersicht verlinkt direkt zu Teilnehmern.
Lade-/Fehleransichten und bestätigte Abschluss-/Löschaktionen sind vorhanden.

### Verifikation dieser Iteration

- **377 erfolgreiche Tests in 22 Dateien**, davon 59 neue Encounter-Tests:
  42 SQLite-Integrationstests, sieben Regeltests, sieben Combat-UI-Tests und
  drei Builder-UI-Tests.
- CRUD, Teilnehmergruppen, Quellenvalidierung, alle fünf Typen, wiederholte Runs,
  individuelle IDs/Ressourcen, Snapshots einschliesslich Jutsu, Rundenwechsel,
  HP-/Chakra-Grenzen, Zustände/Notizen/Ereignisse und Reload-Persistenz geprüft.
- Idempotente Starts, wiederholte Schaden-/Zugaktionen, abweichende Payloads,
  parallele Schreibzugriffe, veraltete Versionen und Endzustände geprüft.
- DM-only-Leser/Mutationen/Seiten, Cross-Campaign- und Cross-Run-Zugriffe,
  vorhandene Daten nach Migration und unveränderte Character-/Enemy-Quellen geprüft.
- Typecheck, ESLint, gesamte Regression-Suite, Production Build und Prisma
  Validation erfolgreich. Isoliertes Deployment aller zwölf Migrationen ohne
  Schemaabweichung; bestehender Jutsu-/Bestiary-Seed weiterhin erfolgreich.

Die UI-Tests laufen in jsdom; eine manuelle visuelle Tabletprüfung und vollständige
Browser-E2E-Prüfung sind nicht durchgeführt. Missionssystem, Missions-Seeds,
GameSession-Zuordnungen und eine ausdrücklich autorisierte Rücksynchronisierung
bleiben spätere Erweiterungen. Diese Encounter-/Combat-Iteration ist abgeschlossen.

## Missionen und Sessions – abgeschlossener Umfang

Dieser Abschnitt ersetzt die älteren Ausblicke auf noch fehlende Missionen und
Session-Verknüpfungen. Die vorhandenen NPC-, Organisations-, Bestiary- und
Combat-Systeme werden weiterverwendet.

### Architektur und Migration

`20261014180000_missions` ist additiv: `Mission` mit Rang, Lifecycle, Archivierung,
Spielerfreigabe und optimistischer Version; `MissionObjective` mit Status,
Reihenfolge, Sichtbarkeit, Optionalität und Freischaltung;
`MissionObjectiveDependency` bildet gerichtete Voraussetzungen ab.
`MissionNpc` und `MissionEncounter` verknüpfen vorhandene Entitäten; Encounter-
Verknüpfungen haben Reihenfolge und Optionalität. `MissionEncounterRun` hält
die tatsächlichen Durchführungen fest. `SessionMission` und `SessionEncounterRun`
erlauben mehrere Missionen/Runs pro GameSession und mehrere Sessions pro Mission.
`MissionConsequence`, `MissionConsequenceApplication` und `MissionAction` speichern
Vorbereitung, unveränderliche Anwendungshistorie und Request-Belege.
`MissionTemplate` speichert globale Blueprints mit eindeutigem Seed-Key.
Bestehende GameSessions erhalten `version = 1`, Organisationen `attitude = NEUTRAL`.

Die Graph-/Lifecycle-Regeln liegen in `src/lib/rules/missions.ts`. Zod validiert
sämtliche Formulare und Befehle. Server Actions führen Referenzprüfung, Versions-
vergleich und Mutationen atomar aus. Encounter-Starts verwenden denselben internen
Snapshot-Service wie bisher; Quellen und frühere Runs bleiben unverändert.

### Builder, Board und Ziele

`/campaign/[campaignId]/missions` bietet Suche, Rang-/Status-/Archivfilter und
expliziten Vorlagenimport. `/new` und `/[missionId]` enthalten vollständigen
Builder bzw. Detailansicht mit Bearbeitung, NPC-/Orts-/Encounter-Verknüpfungen,
Statusaktionen, Zielen, Run-Historie und Konsequenzen. Löschen verlangt einen
archivierten, unbenutzten Entwurf und Namensbestätigung; ansonsten archivieren.

Lifecycle: DRAFT → AVAILABLE → ACCEPTED → ACTIVE → COMPLETED oder FAILED;
vor Abschluss ist CANCELLED möglich. AVAILABLE kann zurück zum Entwurf,
ACCEPTED zurück zu AVAILABLE. Terminale Missionen werden nicht wieder geöffnet.
Abschluss verlangt alle Pflichtziele. Ziele sind PENDING, ACTIVE, COMPLETED,
FAILED oder SKIPPED; nur optionale Ziele dürfen übersprungen werden.

Voraussetzungen sind UND-Verknüpfungen. Verzweigungen können parallele und
optionale Pfade bilden; es gibt keine automatische ODER-Auswahl. Zyklen,
Selbstbezüge und fremde Ziele werden abgewiesen. Ein Ziel kann erst aktiviert
oder abgeschlossen werden, wenn es freigeschaltet ist und alle Voraussetzungen
abgeschlossen sind. Bereits benutzte Voraussetzungen können nicht zurückgesetzt
werden. Gesperrte Pflichtziele verhindern ebenfalls den Missionsabschluss.

### Bestätigte Story-Konsequenzen

Der DM bereitet Aktionen vor und bestätigt jede Anwendung anhand einer Vorschau:
NPC-/Organisationshaltung ändern, einen anderen Entwurf als sichtbare verfügbare
Mission freigeben, ausdrücklich eingegebenen Text an öffentliche Missionsinfos
anhängen oder ein alternatives Ziel freischalten. Bestehende Geheimnisse werden
niemals automatisch kopiert. Freischalten eines Ziels umgeht keine Abhängigkeit.

Jede Anwendung protokolliert Zeitpunkt, ausführende Campaign-Session-ID,
Aktionstitel, Typ sowie Vorher/Nachher. Die eindeutige Anwendung pro Konsequenz
und Request-Belege verhindern Doppelanwendung. Zielversion bzw. Zeitstempel
und bisherige Haltung schützen auch referenzierte Entitäten vor veralteten
Änderungen. Angewendete Konsequenzen sind nicht mehr editier-/löschbar.
Es gibt keinen automatischen Rollback; Korrekturen müssen bewusst erfolgen.

### Berechtigungen und Parallelität

Alle Zugriffe prüfen `requireCampaign`; Mutationen verlangen DM, ausser dem
Annehmen einer veröffentlichten AVAILABLE-Mission durch Spieler. Spieler bekommen
separate serverseitige Projektionen: keine privaten Beschreibungen, DM-Notizen,
Entwürfe, versteckten Ziele, Konsequenzen, Runs oder geheimen Referenzdaten.
Auch Auftraggeber, NPCs und Orte werden auf eigene Kampagne und Freigabe geprüft.
Spieler können weder Ziele bearbeiten noch Encounter starten.

Der bestehende Zugriff kennt gemeinsame PLAYER-Sessions, keine individuellen
Charakter-Auftragsbesitzer: Annahme gilt für die Kampagnengruppe. Kritische
Missionsbefehle besitzen UUID, Payload-Hash und Versionsvergleich; Wiederholung
derselben Anfrage liefert den gespeicherten Erfolg, abweichende Wiederverwendung
wird abgewiesen. Session-Zuordnungen sind absolute, idempotente Setzoperationen.
Session-Notizen und Zuordnungen teilen eine Versionsnummer.

### Sechs globale Beispielmissionen

`seeding/missions.ts` und `prisma/seed-missions.ts` ergänzen den bestehenden Seed:

- D: Die verschwundene Katze – Ladenbesitzerin, Suche, Social-/Exploration-Encounter.
- D: Hilfe beim Hafenfest – parallele Vorbereitungen und optionale Schlichtung.
- C: Überfall auf die Handelsstrasse – Karawane, Banditen und Anführer.
- C: Schmuggler am Hafen – Ermittlungen, optionale Konfrontation/Alternative.
- B: Schatten aus Kirigakure – Bote, Späher und Suiton-Spezialist.
- A: Die verschwundene ANBU-Einheit – Spurensuche, Rettung und Elite-Missing-Nin.

Seeding verändert keine Kampagne. Erst der bestätigte DM-Import erzeugt einen
verborgenen Missionsentwurf samt eigenen Encounter-Vorlagen und nötigen NPCs/Orten.
Eindeutig passende NPC-/Ortsnamen werden wiederverwendet, aber nicht überschrieben;
mehrdeutige Namen erzeugen eigene Beispieldaten. Gegner referenzieren validierte
globale Bestiary-Keys. Erneuter Import öffnet dieselbe Mission und bewahrt Fortschritt.
Unveränderte globale Seeds bleiben inklusive Zeitstempel unverändert.

### Vollständiger DM-Workflow

1. NPC erstellen und über Organisationen einem Team zuordnen.
2. Bestiary-Gegner auswählen und Encounter mit Teilnehmern als bereit speichern.
3. Mission erstellen oder globale Vorlage ausdrücklich importieren.
4. NPCs, Ort, Ziele/Voraussetzungen und geordnete Encounter verknüpfen; speichern.
5. Öffentliche Informationen/Freigaben prüfen und Mission verfügbar schalten.
6. Mission annehmen und starten. GameSession öffnen und Mission zuordnen.
7. Ziele in Session oder Mission abhaken; Encounter aus der Session vorbereiten.
8. Im vorhandenen Combat Manager Initiative, HP, Chakra und Zustände führen;
   Run abschliessen. Reload bewahrt Run und Missionsfortschritt.
9. Ergebnisse in der Mission ansehen, Konsequenzen einzeln prüfen/bestätigen;
   alle Pflichtziele erfüllen und Mission abschliessen.

Run-Kampfzustände gelten weiterhin nur für den Run. Missionsziele und Story-
Konsequenzen sind eigenständige persistente Änderungen. Encounter-Abschluss
erledigt keine Ziele automatisch; keine automatische Character-Sheet-Synchronisierung.

### Prüfungen und Grenzen

419 erfolgreiche Tests in 25 Dateien: 27 neue SQLite-Missionsintegrationstests,
neun Graph-/Lifecycle-Regeltests und sechs UI-Tests zusätzlich zur bisherigen Suite.
Abgedeckt sind CRUD, Abhängigkeiten/Zyklen, Status, Konsequenzprotokollierung,
Doppelrequests, Versionskonflikte, Player-Projektionen, Kampagnenisolation,
Encounter-Snapshots, Session-Zuordnungen/Notizen und Seed-/Import-Idempotenz.
Typecheck, ESLint, Production Build und Prisma Validation sind erfolgreich.
Die isolierte Datenbank migriert alle 13 Migrationen ohne Schemaabweichung.
Zwei vollständige Seed-Durchläufe lieferten jeweils sechs Missionen, 20 Gegner,
579 globale Jutsu und sieben Chakra-Naturen. Die bestehenden 221 nicht auflösbaren
Jutsu-Voraussetzungstexte werden vom bisherigen Seed weiterhin gemeldet; es wurden
keine neuen Jutsu-Referenzen erfunden. Prisma Client wurde erfolgreich generiert,
auch die lokale Datenbank zeigt im Schema-Diff keine Abweichung.

Vor dem lokalen Deployment wurde eine SQLite-Sicherung unter `.local-backups/`
angelegt. Fingerprints aller bestehenden Nutzdatentabellen werden vor/nach
Migration und Missions-Seeding verglichen; neue additive Defaultspalten werden
dabei ausgenommen. Alle 27 bestehenden Nutzdatentabellen blieben unverändert;
`PRAGMA foreign_key_check` meldete keine Verletzungen. Die lokale Datenbank ist
auf allen 13 Migrationen und enthält sechs globale Missionsvorlagen. Es wurde
kein Reset verwendet.

Die UI-Tests laufen in jsdom; manuelle Tablet-/Browser-E2E-Prüfung steht aus.
Aktualisierung anderer Browser erfolgt per Reload, nicht per Live-Push.
Weitere Erweiterungen: individuelle Auftragsannahme, Echtzeit-Synchronisierung,
ausdrücklicher Character-Sheet-Abgleich und komplexere ODER-Zielbedingungen.
Die zusätzlich eingebrachten Clan-Jutsu-Dateien sind weiterhin nicht im Seed
registriert; lediglich ihr dokumentierter `CLAN_HIDEN`-Typ wurde ergänzt.

## Integration und DM-Workflow-Polish

### Konkrete Verbesserungen

- Die Kampagnenübersicht enthält für DMs einen **Session-Leitstand** mit aktiven/
  geplanten Sessions, angenommenen/aktiven Missionen samt Pflichtzielfortschritt
  und vorbereiteten/laufenden Encounter Runs. Pro Bereich werden bis zu sechs
  Einträge geladen; Links führen zu allen Einträgen und zur Vorbereitung.
  NPCs, Teams/Organisationen, Bestiary, Missionen/Vorlagen und Encounters sind
  direkt erreichbar. Spieler laden die DM-Abfragen überhaupt nicht.
- Run-Seiten bieten kampagnengeprüfte Rücklinks zu den zugehörigen Missionen und
  Sessions. Nach dem Kampf sind Ziele und Konsequenzen direkt wieder erreichbar.
- Neue Sessions öffnen nach dem Speichern sofort ihre Detailansicht. Die Formulare
  besitzen sichtbare Labels, Textgrenzen, Lade-/Erfolgs-/Fehlerfeedback und deutsche
  Statusanzeigen. Die nächste Sessionnummer basiert auf der höchsten vorhandenen
  Nummer statt auf der Datensatzanzahl; Nummernlücken erzeugen keine Kollisionen.
- `PeopleForm` dispatcht Aktionen ohne automatischen Formularreset. Unkontrollierte
  NPC-/Organisationsfelder, Notizen und Checkboxen bleiben bei Validierungsfehlern
  erhalten; der Tastaturfokus springt zur Meldung. Pending deaktiviert die Felder
  und wird über `aria-busy` angezeigt. Sichtbare Fokusmarkierungen und umbrechende
  Aktionsleisten unterstützen Tastatur und Tablet.
- Erwartete NPC-/Organisations-/Beziehungsfehler werden serverseitig als strukturierte
  Ergebnisse zurückgegeben. Ihre Texte verschwinden damit im Production Build
  nicht hinter Next.js' allgemeiner Exception-Maskierung. Validierungsfehler nennen
  die betroffenen Felder auf Deutsch; unerwartete Fehler werden nicht offengelegt.
- Der Jutsu-Seed überspringt unveränderte Datensätze. Wiederholtes Seeding verändert
  dadurch auch keine `updatedAt`-Werte. Globale Vorlagen werden weiterhin niemals
  automatisch in bestehende Kampagnen importiert.
- Lokale Backups und Browserprofile sind aus ESLint/Typecheck ausgeschlossen;
  Anwendungscode, Seed-Audit und Tests bleiben Teil der regulären Prüfungen.

Es waren keine neuen Prisma-Modelle oder Migrationen erforderlich. Bestehende
Snapshot-, Ressourcen-, Berechtigungs- und Versionsregeln werden weiterverwendet.

### Lokale Seed- und Datenbankprüfung

Vor dem Seeding wurde mittels `VACUUM INTO` eine konsistente SQLite-Sicherung
erstellt: `.local-backups/pre-ux-seeds-1792011144878.sqlite`.
Danach wurde der registrierte vollständige Seed **zweimal auf der lokalen
Entwicklungsdatenbank** ausgeführt. Alle drei Seed-Bereiche liefen durch:
Jutsu/Chakra-Naturen, Bestiary und globale Missionsvorlagen.

| Datensätze | Vorher | Nach Lauf 1 | Nach Lauf 2 |
| --- | ---: | ---: | ---: |
| Globale Jutsu insgesamt | 589 | 589 | 589 |
| Davon registrierte Jutsu-Seeds | 579 | 579 | 579 |
| Globale Enemy Templates | 20 | 20 | 20 |
| Globale Missionsvorlagen | 6 | 6 | 6 |
| Chakra-Naturen | 7 | 7 | 7 |
| Kampagnen | 3 | 3 | 3 |
| Charaktere | 4 | 4 | 4 |
| GameSessions | 1 | 1 | 1 |
| NPCs / Organisationen / Kampagnenmissionen / Runs | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |

Die zehn zusätzlichen, bereits vorhandenen globalen Jutsu wurden erhalten.
Alle 579 erwarteten Seed-Slugs sind vorhanden. Es gibt keine doppelten globalen
Jutsu-Slugs oder Seed-Keys. Vollständige Tabellen-Hashes blieben bereits zwischen
Vorher und Lauf 1 sowie zwischen Lauf 1 und Lauf 2 identisch: IDs, Referenzen,
Inhalte, Zeitstempel und Kampagnendaten sind unverändert. Die Fremdschlüsselprüfung
meldet keine Verletzungen; Bestiary-/Missions-Seeds validieren ihre Referenzen.
Die bekannten 221 nicht auflösbaren Freitext-Jutsu-Voraussetzungen sind weiterhin
ein inhaltlicher Altbestand, keine kaputten Fremdschlüssel. Entwurfsdateien für
Clan-Hiden bleiben wie dokumentiert ausserhalb des registrierten Seeds.

Die reproduzierbare Prüfung liegt unter `prisma/audit-seeds.ts`:

```powershell
npx tsx prisma/audit-seeds.ts before
npm run db:seed
npx tsx prisma/audit-seeds.ts after-first
npm run db:seed
npx tsx prisma/audit-seeds.ts after-second
```

Jeder Schritt muss erfolgreich sein, bevor der nächste ausgeführt wird. Der
Audit schreibt Sicherung und Bericht nach `.local-backups/seed-audit.json`, prüft
Kampagnendaten gegen den Ausgangsstand und verlangt für Lauf 2 identische Inhalte
aller Tabellen. Der Audit enthält keine Restore-, Reset- oder Importoperation.
Bei gleichzeitigen echten Nutzeränderungen ist der Vergleich zu wiederholen.

### Automatisierte und echte Browserprüfungen

- **423 Tests in 26 Dateien erfolgreich**, einschliesslich neuer Regressionstests
  für Formularerhalt/Fehlerfokus, Bestätigungsabbruch, DM-Dashboard-Isolation und
  Session-Erstellung/Nummerierung/Validierung. Die vollständige bisherige Suite
  deckt weiterhin Character-/NPC-Verknüpfungen, Mitgliedschaften, Vorlagenisolation,
  Snapshots, Combat-Persistenz, Ziele, Konsequenzen und Session-Zuordnungen ab.
- Typecheck, ESLint, Production Build und Prisma Validation erfolgreich.
  Alle 13 Migrationen sind angewendet; lokaler Schema-Diff ohne Abweichung.
- **16 echte Browserprüfschritte** mit Edge 155 im Headless-Modus über CDP gegen
  `next start` erfolgreich. Eine separate SQLite-Kopie mit eigener Testkampagne
  verhinderte Testdaten in der Entwicklungsdatenbank.
- Geprüft: Dashboard; deutsche Production-Validierung samt erhaltenem NPC-Entwurf
  und Fehlerfokus; NPC-Erstellung; Teamerstellung/Mitgliedschaft; Missionsimport
  mit Bestiary-Encounter; AVAILABLE/ACCEPTED/ACTIVE; Session-Erstellung mit
  Weiterleitung; Missionszuordnung; Run-Start aus Session; Kontextnavigation;
  Initiative, Zugwechsel, Schaden und HP-Persistenz nach Reload; Tablet-Layout;
  Kampfabschluss; abhängige Ziele/Konsequenz/Missionsabschluss; Sessionabschluss;
  Spieleransicht ohne DM-Leitstand und verborgene Mission.
- Bei 820 × 1180 Pixeln kein horizontaler Überlauf. Tablet-Screenshot visuell
  geprüft; keine JavaScript-Laufzeitexception im erfolgreichen Durchlauf.
  Lokale Artefakte: `.local-backups/ux-browser-results.json` und
  `.local-backups/ux-combat-tablet.png`.

### Verbleibende Prüfungen und Grenzen

Der Browserdurchlauf prüft einen vollständigen importierten C-Rang-Kampfauftrag,
nicht sämtliche möglichen Builder-Kombinationen. Zusätzlich manuell prüfen:
Safari/Firefox, echte Tablet-Touchbedienung/Hoch-/Querformat, Screenreader und
lange Texte/grosse Kampagnen. Reine Tastaturbedienung sollte auf diesen Geräten
ebenfalls geprüft werden; Labels und Fokusverhalten sind automatisiert abgedeckt.
Mehrere DMs gleichen weiterhin per Reload ab; es gibt keinen Live-Push und keinen
automatischen Character-Sheet-Abgleich. Individuelle Missionsbesitzer und komplexe
ODER-Zielbedingungen bleiben zukünftige Erweiterungen.

## Branding und Portraits – 15.10.2026

Das bereitgestellte Shiogakure-Original wurde unverändert übernommen und für
Header, helle/dunkle Varianten, Favicon, Apple/App-Icons und Social-Metadaten
zugeschnitten/skaliert. Projektidentität: **Shio no Kuni – Naruto D&D**.

Eine gemeinsame geschützte Portrait-Verwaltung ergänzt Character Creator/Sheets,
NPCs/Sensei, eigene Enemy Templates, Listen, Teams, Missions-NPCs und Combat-
Teilnehmer. Enthalten sind Vorschau, optionaler Ausschnitt, Varianten, Standard,
Ersetzen/Entfernen, Fallback und serverseitige Inhalts-/Grössenprüfung.
Bestehende URL-Felder bleiben erhalten. NPC und verknüpfter Character teilen
dieselbe Bildsammlung; beim Verknüpfen werden vorhandene Varianten zusammengeführt.

Migration `20261014220000_portraits` ergänzt `Portrait` und einen nullable
gehashten Besitzerbezug für Character. Sie ist lokal nach Sicherung angewendet;
alle 39 bisherigen Tabellen unverändert. Alle 14 Migrationen sind isoliert geprüft,
lokal aktuell und ohne Schemaabweichung. Zwei Seed-Läufe erhalten 589 globale
Jutsu (alle 579 registrierten Seeds), 20 Gegner und sechs Missionsvorlagen ohne
Änderung der Kampagneninhalte. Keine Kartenmodelle/Location-Seeds ergänzt.

**441 Tests in 29 Dateien**, Typecheck, ESLint, Production Build und Prisma
Validation erfolgreich; zusätzlich neun echte Edge-Browserprüfschritte auf einer
separaten DB-Kopie. Produktion benötigt einen privaten persistenten Portrait-
Speicher. Besitzerrechte beruhen auf dem bestehenden browsergebundenen Zugang;
nach Neuanmeldung kann der DM die Zuordnung erneuern. Kein neues Benutzerkonto-
oder Karten-System wurde eingeführt.

Vollständige Konfiguration, Speicherbetrieb, Bedienung, Grenzen und Ergebnisse:
[branding-portraits.md](branding-portraits.md).

Portrait-UX-Nachtrag: Vier generische Bildvorlagen sind lokal hinterlegt und
auswählbar. Ein kompakter Einstieg öffnet das Portrait-Studio mit Galerie und
eigenem Upload; das Bild steht grösser neben den Profildaten. Es gibt keine
automatischen Bildzuweisungen. Aktueller Prüflauf: 443 Tests in 30 Dateien sowie
Typecheck, ESLint, Build und sechs zusätzliche echte Browserprüfschritte erfolgreich.

## Universeller Weltatlas – 15.10.2026

Der bislang zurückgestellte Kartenumfang ist jetzt implementiert. Eigene Karten
mit privaten Uploads, Leaflet-Zoom/Drag/Touch, Vollbild, normalisierten Markern,
hierarchischer Navigation und visuellem DM-Editor sind in der Kampagnennavigation
unter **Atlas** erreichbar. Der bestehende Bereich **Orte** verwendet weiterhin
das zentrale Location-Modell und zeigt die zugeordneten Karten und Beziehungen.
Versionen und Request-Belege sichern parallele bzw. wiederholte Mutationen.
Spieler erhalten ausschliesslich freigegebene Inhalte und geschützte Bildzugriffe.

Alle sechs bereitgestellten Originalkarten sind unter `assets/world-atlas/shio/`
abgelegt. Eine globale idempotente Vorlage enthält sechs Karten, 67 Locations und
67 anhand der Originalbilder gesetzte Marker. **Shio no Kuni als Welt importieren**
erstellt ausdrücklich kampagneneigene Kopien und respektiert vorhandene Orte.
Importwiederholungen überschreiben keine manuellen Änderungen. Karten sind zunächst
verborgen: Rasterbeschriftungen wie ANBU bleiben unabhängig von Markerfreigaben
im Bild sichtbar und müssen vor Veröffentlichung geprüft werden.

Additive Migration `20261015010000_world_atlas` ergänzt sechs neue Tabellen.
Vor lokaler Anwendung wurde die DB gesichert; 40 vorhandene Tabellen unverändert,
Foreign Keys gültig. Alle 15 Migrationen isoliert geprüft und lokal aktuell.
Der globale Atlas-Seed wurde zweimal ausgeführt, ohne die übrigen 46 Tabellen zu
verändern. Erhalten: 589 globale Jutsu (alle 579 registrierten Seeds), 20 globale
Gegner und sechs Missionsvorlagen. Keine Welt wurde in Entwicklungskampagnen importiert.

**461 Tests in 33 Dateien**, Typecheck, ESLint, Production Build und Prisma
Validation erfolgreich. 14 zusätzliche echte Edge-Browserprüfschritte auf einer
separaten DB-Kopie bestätigen Import, Upload, Platzierung, Ziehen, Navigation,
Persistenz, Spielerschutz, mobile Darstellung, Mausrad-/Touch-Zoom und Vollbild.

Grenzen: kein Fog of War, keine Tile-Pyramiden, kein Live-Push; echte Touch-Hardware,
Safari/Firefox und Screenreader bleiben manuell zu prüfen. Produktion benötigt
`ATLAS_STORAGE_ROOT` auf privatem persistentem Speicher und die Original-Assets im
Deployment. Vollständige Architektur, Bedienung, Seed-Strategie, Sicherungen und
Prüfergebnisse: [world-atlas.md](world-atlas.md).
