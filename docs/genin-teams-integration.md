# Genin-Teams und Jonin-Sensei

Stand: 15.10.2026. Das private Paket **„Shiogakure – Genin-Teams & Jonin-Sensei“**
ist im bestehenden DM-Lore-Import auswählbar. Es wird ausschliesslich nach
kampagnenbezogener DM-Vorschau und Bestätigung angewendet. Der Hauptseed befüllt
keine Kampagnen. Dieser Auftrag hat keine reale Kampagne mit Lore befüllt.

## Umfang

| Paketinhalt | Anzahl |
| --- | ---: |
| Vollständig dokumentierte NPC-Teams | 3 |
| Reservierte Spielerteams | 1 |
| Genin in den NPC-Teams | 9 |
| Jonin-Sensei | 3 |
| Kampfprofile als separat zu bestätigende DM-Entwürfe | 12 |
| Neue private Jutsu-Mechanikentwürfe | 14 |
| Jutsu-Zuordnungen | 20 |
| Gerichtete Beziehungen | 18 |
| Organisationen insgesamt, einschliesslich Teams, Clans und Dorf | 9 |
| Wiederverwendbare Referenzprofile für belegte Beziehungen | 4 |
| Unterschiedliche private Quelldokumente im Paket | 39 |

Die 14 privaten Techniken umfassen zehn neue Sensei-Homebrew-Techniken, zwei
bislang fehlende kanonische Techniken und zwei bestätigte Genin-Hiden-Starttechniken.
Die 20 Zuordnungen umfassen 18 Sensei-Techniken und zwei Genin-Techniken. Fünf
bereits vorhandene Bibliothekseinträge werden wiederverwendet. Alle 589 globalen
Jutsu bleiben erhalten. Die Paketanzahlen sind keine Behauptung über den
bereits bestätigten Inhalt einer realen Kampagne.

## Reserviertes Spielerteam

Team 4 ist **PLAYER TEAM – Reserved / Awaiting Character Creation**. Die bewusst
leeren Vault-Dateien sind kein Fehler. Der Import legt keine Ersatz-NPCs, PCs,
Mitglieder, Sensei oder Techniken für dieses Team an. Ein bestehendes Team wird
über seine stabile Identität wiederverwendet. Später manuell hinzugefügte
Mitglieder bleiben auch bei erneutem Paketimport erhalten.

Das bestehende Organization-Modell hat keinen passenden Status-Enum. Der
Reservierungshinweis steht deshalb in Beschreibung beziehungsweise Notizen.
Es gibt kein neues Teammodell und keine zusätzliche Teamverwaltungsoberfläche.

Nach der Charaktererstellung öffnet der DM **Teams & Organisationen → Team 4**,
wählt einen vorhandenen Charakter derselben Kampagne und speichert dessen Rolle.
Der später dokumentierte Sensei wird ebenso hinzugefügt und als Leitung markiert.
Diese ausdrücklichen Speicheraktionen bestätigen die Zuordnungen. Kampagnenfremde
Personen und Spieleraktionen werden abgelehnt; wiederholtes Speichern derselben
Mitgliedschaft erzeugt keine Duplikate.

## Import und Identitäten

Das private Paket liegt unter `.lore-storage/genin-teams-v1.json`. Dieser Pfad
ist Git-ignoriert und muss auf einem Deployment separat privat bereitgestellt
werden. Quellenpfade, Blob-Hashes, Personen- und Technikdetails stehen nur im
Paket und im ignorierten Auditbereich. Das Vault wurde ausschliesslich gelesen.

Der aktuelle Quellenbaum umfasst 132 Markdown-Dateien. Gegenüber dem ursprünglichen
102-Dateien-Audit wurden 36 neue Pfade, ein geänderter Inhalt und sechs entfernte
Pfade festgestellt. Umbenennungen zählen dabei als neue und entfernte Pfade.
Alle 37 neuen oder geänderten Dokumente wurden aus einer unveränderlichen Revision
gelesen; die Inhalte wurden zusätzlich anhand des Git-Blob-Hashes verifiziert.

Stabile Referenzen auf frühere Lore-Pakete und den früheren Genin-Seed verhindern
Parallelidentitäten auch nach Namensänderungen. Mehrdeutige Identitäten und reine
Namenskollisionen führen zu einer Konfliktvorschau. Bestehende leere Teamvorlagen
werden wiederverwendet. Abweichende manuelle NPC-Teamkonstellationen werden nicht
überschrieben. Bestehende Profiltexte, Kampfwerte, Mitgliedschaftsrollen,
Sichtbarkeiten und Jutsu-Mechaniken bleiben erhalten. Leere Team-Beschreibungen
können nach Bestätigung ergänzt werden; vorhandene Beschreibungen bleiben erhalten.
Beziehungen werden auch anhand der stabilen Endpunkte und des Typs abgeglichen.

NPCs, Organisationen, Beziehungen, Kampfprofile und private Techniken sind gezielt
auswählbar. Die Vorschau zeigt Teamroster, Reservierung, Herkunfts-/Ortsbezüge,
Quellen, numerische Entwürfe und Jutsu-Mechaniken. Fehlende Auswahlabhängigkeiten
werden vorab gemeldet. Die gesamte Anwendung erfolgt in einer Transaktion;
ein Fingerprint über Paket, Auswahl und relevante Datenbankwerte weist veraltete
Vorschauen zurück. Der bestehende HTTP-Endpunkt prüft DM-Rechte, Kampagne und
Namensbestätigung und erstellt vor jeder Anwendung eine konsistente Sicherung.

## Regeln, Techniken und Sichtbarkeit

HP, AC, Initiative, Chakra und Regeneration verwenden die vorhandene Rules Engine.
Dokumentierte HP-Balancingwerte werden als Overrides gespeichert. Durchschnittliche
Levelbeiträge sind ausdrücklich Entwürfe und keine behauptete Würfelhistorie.
Bereits eingerechnete d8-Attributboni werden nicht erneut addiert. Wo das konkrete
Bonusattribut dokumentiert ist, wird es am Character gespeichert. Skills,
Rettungswurf-Übungen, Tempo, Kontroll- und Regenerationsrang mit fehlender Lore
bleiben ausdrücklich gekennzeichnete DM-Annahmen.

Optionale Sonderfähigkeiten stehen in `Character.combatProfile`, nicht in frei
bearbeitbaren DM-Notizen. Die drei Sensei lassen sich mit ihren Charakterbögen,
Techniken und Sonderfähigkeiten im vorhandenen Encounter-System verwenden.
Bestehende Charakterbögen erhalten bei ausdrücklich ausgewähltem Jutsu-Import
nur fehlende, geprüfte Zuordnungen; numerische Werte werden nicht zurückgesetzt.

Jutsu werden anhand eindeutiger normalisierter Namen, überprüfter Aliase und
stabiler IDs abgeglichen. Individuelle Bindung, Clan, Elementvoraussetzungen und
gelernte Voraussetzungen werden geprüft. Mehrdeutige Aliase, widersprüchliche
Ränge, zyklische Voraussetzungen und fehlende Freigaben erzeugen Konflikte.
Hiden bleibt eine Kategorie/Tradition; Signature nutzt den vorhandenen Pool
`CHARACTER_SIGNATURE`. Die private D&D-Umsetzung verwendet `DM_CUSTOM`; bei
kanonischen Techniken ist zusätzlich der vorhandene Pool `CANON` gesetzt.
Neue private Techniken gelangen ausschliesslich in die gewählte Kampagne.

Migration `20261015180000_private_lore_jutsu` ergänzt `Jutsu.dmOnly` mit Default
`false`. Importierte private Techniken erhalten `true`. Spieler sehen sie weder
in einer geöffneten Bibliothek, auf Direktlinks oder Charakterbögen noch im
Character Creator. Auch die autoritative Charaktererstellung lehnt sie ab.
Bestehende öffentliche Jutsu werden durch diese Migration nicht verborgen.

Alle neu importierten NPCs, Organisationen und Beziehungen sind zunächst verborgen.
Dokumentierte Ortsbezüge verwenden bestehende Atlas-Orte. Ein fehlender oder
mehrdeutiger Ort muss vor dem Import abgeglichen werden. Die vorhandene
Atlas-Detailansicht beachtet weiterhin NPC-/Organisationsfreigaben und Rollen.
Es werden keine neuen Orte erfunden. Portrait-Verweise bleiben im privaten
Quellprofil erhalten; die Bilddateien benötigen weiterhin einen separaten Upload
über die vorhandene Portrait-Verwaltung.

## Offene redaktionelle Punkte

- Eine Technik hat einen Rangkonflikt zwischen Vault und bestehender Bibliothek.
  Die vorhandene ID und Bibliotheksmechanik bleiben erhalten; der Widerspruch
  steht ausdrücklich in den privaten Kampfprofil-Annahmen. Keine zweite Technik
  und keine globale Rangkorrektur werden erzeugt.
- Neue Jutsu-Mechaniken und zusätzliche Kampfzahlen sind Vorschläge, keine
  bestätigten Kanonwerte. Sie benötigen weiterhin separate DM-Bestätigung.
- Eine Genin-Chakrareserve bleibt vorläufig, ein verborgenes Potenzial latent;
  unbekannte Naturen und nicht bestätigte Genin-Techniken werden nicht freigeschaltet.
- Teamprüfungen, Missionsideen und mögliche spätere Teamkombinationen werden
  nicht als ausgespielte Ereignisse oder automatisch verfügbare Techniken importiert.
- Team 4 wartet bewusst auf Charaktererstellung und spätere Sensei-Festlegung.

## Validierung

Die private Entwicklungsdatenbank wurde vor Änderungen konsistent gesichert.
Die Migration wurde auf einer gefüllten Kopie geprüft: alle bisherigen Zeilen in
46 Anwendungstabellen unverändert, Integrität erfolgreich, keine Fremdschlüsselfehler.
Nach Anwendung auf der privaten Entwicklungsdatenbank wurden deren ursprüngliche
Zeilen erneut mit der Sicherung verglichen: unverändert, 589 globale Jutsu erhalten.

Der vollständige private Paketimport wurde auf einer isolierten DB-Kopie nach
dem bisherigen Basispaket ausgeführt: neun zusätzliche NPCs, zwei zusätzliche
Clanorganisationen, 27 zusätzliche Mitgliedschaften, 17 zusätzliche Beziehungen,
zwölf Charakterbögen, 14 private Techniken und 20 Zuordnungen. Vorhandene Teams und
Referenzprofile wurden wiederverwendet. Der zweite Import erzeugte keine
Tabellenänderung; eine manuelle Notiz blieb erhalten. Alle drei Sensei wurden
zusätzlich als Encounter-Snapshots geprüft. Keine Fremdschlüsselfehler.

Automatisierte Tests prüfen unter anderem drei vollständige NPC-Teams plus ein
leeres Spielerteam, individuelle und Clan-Freigaben, Naturen und Voraussetzungen,
Alias-Konflikte, Identitätsabgleich, separate Bestätigungen, Vorschau,
Kampagnenisolation, Spieler-Sichtbarkeit, spätere PC-/Sensei-Mitgliedschaften,
Idempotenz, manuelle Änderungen, Atlas- und Encounter-Integration.

Prüfbefehle: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
`npx prisma validate`, `npx prisma migrate status`, isolierter Schema-Diff über
alle Migrationen und `npx tsx scripts/check-private-artifacts.ts`.
Private Ergebnisberichte: `.local-backups/genin-proof-results.json`,
`genin-migration-results.json`, `genin-teams-vault-recheck.json` und
`genin-teams-vault-update.json`. Die abschliessenden Qualitätsresultate stehen
im privaten Bericht `genin-quality-results.json`.

Abschliessendes Ergebnis: **496 Tests in 38 Dateien erfolgreich**; Typecheck,
ESLint, Production Build und Prisma Validation erfolgreich. Alle 17 Migrationen
sind aktuell; der isolierte Vergleich zwischen Migrationshistorie und Schema
meldet keine Abweichung. Doppelimport und Prüfung manueller Änderungen sind
erfolgreich. Die Artefaktprüfung umfasst zusätzlich die Texte der neuen privaten
Technikentwürfe.
