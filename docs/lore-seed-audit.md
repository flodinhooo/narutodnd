# Lore-/Seed-Audit

Aktueller Nachtrag: Die private DB-Konfiguration und die DM-Importoberfläche
sind inzwischen implementiert. Der folgende Bericht dokumentiert den vorherigen
Auditstand; aktueller Umfang und Bedienung: [living-shiogakure.md](living-shiogakure.md).

Stand: 15.10.2026. Primäre Quelle für eigene Shio-Lore ist das private
`flodinhooo/ObsidianVault`, Bereich `Naruto dnd Campaign`.
Die Web-App enthält diese Lore nicht vollständig.

## Zugriff und Vertraulichkeit

Das Vault war nicht an den geprüften lokalen Standardpfaden vorhanden. Die
bereits autorisierte GitHub-Verbindung konnte es read-only lesen; die lokale
GitHub CLI ist nicht angemeldet. Keine Vault-Datei wurde geändert und kein
zusätzlicher Zugang eingerichtet.

Das Web-App-Repository ist öffentlich. Deshalb stehen neue private Lore-Texte,
Stammbäume, Identitätszuordnungen und Story-Geheimnisse ausschliesslich in
Git-ignorierten privaten Dateien. Dieser technische Bericht enthält keine
neuen geheimen Beziehungen oder Story-Ereignisse. Es wurde nichts committed
oder veröffentlicht. Zugriff auf das Vault ist keine Veröffentlichungsfreigabe.

Vollständige lokale Zuordnungstabelle mit 621 Zeilen, Widersprüchen und allen
relativen Quellenpfaden:
[Privater Audit](../.local-backups/lore-seed-audit.private.md).
Der Link ist nur im lokalen Workspace verwendbar; die Datei wird nicht eingecheckt.

## Ausgewerteter Stand

| Bereich | Ergebnis | Aktion |
| --- | --- | --- |
| Quellen | 102 Markdown-Dateien, davon 16 leer | Vollständig erfasst, Git-Blob-Hashes aller Inhalte geprüft |
| Interne Links/Embeds | 93 | Gegen den vollständigen Vault-Dateibaum aufgelöst |
| NPCs | 31 vorbereitete Identitäten | Private vereinfachte Profile, keine erfundenen Kampfwerte |
| Familien/Clans | Vier benannte Vorlagen | Nur belegte Mitgliedschaften und Elternbezüge |
| Teams | Vier Vorlagen | Ohne erfundene Mitglieder oder Sensei; acht Quelldateien sind leer |
| Beziehungen | 27 gerichtete Beziehungen | Quellenpfade und Blob-SHAs, verborgen beim Import |
| Mitgliedschaften | 31 | Vorhandene OrganisationMember-Struktur |
| Spieler-Dokumente | Zwei separat erkannt | Keine zusätzlichen NPC-Dubletten erzeugt |
| Registrierte Jutsu | Alle 579 in der DB vorhanden | Klassifikation und IDs unverändert |
| Globale Jutsu | 589 insgesamt | Bestehende zusätzliche Einträge erhalten |
| Jutsu-Abschnitte | 495 mit explizitem Rang extrahiert | Namensabgleich; 13 benötigen Alias-/Variantenprüfung |
| Weitere Seed-Dateien | 22 Hiden-Einträge in zwei nicht registrierten Dateien | Keine belegte Vault-Zuordnung, nicht automatisch aktiviert |
| Enemy-/Missionsvorlagen | 20 / sechs | Unverändert |

Die Dateien wurden vollständig maschinell gelesen und auf Quellintegrität
geprüft. Kerntexte zu Figuren, Familien, Geschichte und Geografie wurden
inhaltlich geprüft. Die Jutsu-Tabelle unterscheidet Namensfund, Mechanikabgleich
und Freigabe: ein Namensfund allein bestätigt weder Rang noch Voraussetzungen.
Drei kurze registrierte Jutsu-Namen werden vom vorsichtigen automatischen
Namensvergleich bewusst nicht zugeordnet; diese Einträge bleiben erhalten.

Es gibt mindestens ein eindeutig fehlendes benanntes Signature-Jutsu als private
Vorlage. Weitere mögliche Varianten und unvollständige Fähigkeiten sind im
privaten Jutsu-Review dokumentiert. Es wurden keine neuen globalen Jutsu angelegt.

## Private Vorlagen und gezielter Import

Dateien, die ausschliesslich lokal bzw. auf einem privaten persistenten Volume
bereitgestellt werden:

- `.lore-storage/shio-v1.json`: NPCs, Familien/Clan, Teams, Mitgliedschaften,
  Beziehungen; kampagnenunabhängig und mit relativen Quellenpfaden/Blob-SHAs.
- `.lore-storage/jutsu-template-001.json`: belegte fehlende Technik als
  private Vorlage; noch nicht in der Jutsu-Bibliothek veröffentlicht.
- `.lore-storage/jutsu-review.json`: Alias-, Varianten- und Mechanikprüfung.
- `.local-backups/lore-vault-snapshot.json`: vollständige read-only Quellkopie.
- `.local-backups/lore-audit.json`: maschineller Datenbank-/Quellenabgleich.

`LORE_STORAGE_ROOT` kann für private Vorlagen auf ein eigenes Verzeichnis zeigen;
Standard ist `.lore-storage/`. Dateien dort und die Audits werden nicht nach
`public` kopiert und nicht über neue API-Endpunkte ausgeliefert.

Die vorhandenen `Npc`, `Organization`, `OrganizationMember` und
`CharacterRelationship`-Modelle werden wiederverwendet. Vereinfachte Shinobi-
Profile sind möglich, ohne einen unvollständigen Character-Sheet mit erfundenen
HP-, Chakra-, Kontroll- oder Regenerationswerten anzulegen. Belegte Startattribute
sind gegebenenfalls als DM-Quellnotizen erhalten. Quellen enthalten auch Entwürfe;
diese werden nicht als verbindliche Story-Ereignisse angewendet.

Standardmässig nur Vorschau:

```powershell
npx tsx scripts/lore-import.ts .lore-storage/shio-v1.json --campaign CAMPAIGN_ID
```

Ausdrückliche Anwendung durch den vertrauenswürdigen lokalen Betreiber:

```powershell
npx tsx scripts/lore-import.ts .lore-storage/shio-v1.json --campaign CAMPAIGN_ID --apply --confirm-campaign "Exakter Kampagnenname"
```

Vor Anwendung wird mit `VACUUM INTO` eine SQLite-Sicherung erstellt. Alle neuen
Profile, Organisationen und Beziehungen sind verborgen; Haltung ist unbekannt.
Provenienz und private Hinweise stehen in DM-Geheimnissen. Bestehende Namen
führen zu einem Konflikt statt automatischer Zusammenführung. Bei Konflikten
wird die gesamte Anwendung zurückgerollt. Stabile IDs pro Kampagne, Bundle und
Eintrag verhindern Importduplikate. Vorhandene manuelle Texte, Ränge, Sichtbarkeit
und Mitgliedschaftsrollen bleiben bei Wiederholung unverändert. Nach manueller
Löschung kann ein erneuter ausdrücklicher Import den Eintrag wieder anlegen.

**Die derzeitige `prisma/dev.db` ist Git-getrackt.** Der Importbefehl verweigert
dort das Schreiben privater Lore. Vor einem realen Import eine konsistente Kopie
in ein ignoriertes privates Verzeichnis oder ausserhalb des Source-Repositorys
legen und `DATABASE_URL` darauf konfigurieren. Keine getrackte DB mit privaten
Lore-Daten committen. Die bestehende DB und deren Git-Status wurden nicht entfernt.

Der Befehl ist ein lokales Betreiberwerkzeug, kein öffentlich erreichbarer
DM-/Player-Endpunkt. Es gibt in dieser Iteration keine neue Lore-Import-UI.
Normale Zugriffe auf importierte NPCs/Organisationen verwenden die bestehenden
serverseitigen Campaign-/DM-Berechtigungen und Sichtbarkeitsprojektionen.

## Konflikte und bewusst nicht importierte Inhalte

Im privaten Audit sind unter anderem widersprüchliche Altersangaben,
Chakrareservefaktoren, Stammbaum-Zusammenfassungen, Genin-Zuordnungen,
Schreibvarianten von Orts-/Personennamen und Jutsu-Ränge gegenüber bestehenden
Seeds dokumentiert. Keine davon wurde stillschweigend entschieden oder in
bestehenden Datensätzen korrigiert. Fehlende Familienmitglieder, Sensei-Namen,
ungeklärte Adoptionen und nicht benannte Familien werden nicht erfunden.

Noch offen:

- Redaktionelle Entscheidung zu den einzeln belegten Konflikten.
- Vollständige kampffähige Character Sheets nach Auflösung der fehlenden bzw.
  widersprüchlichen Mechanikdaten; keine automatische Blutlinienfreischaltung.
- Individuelle Teambelegung und Sensei, sobald die Quelle diese benennt.
- Freigabe zusätzlicher Jutsu und Übernahme in die Bibliothek. Das bestehende
  Jutsu-Modell hat keine individuelle Spieler-Sichtbarkeit; geheime Techniken
  werden nicht ungeprüft kampagnenweit oder global sichtbar gemacht.
- Auswahl einer realen Zielkampagne und privater Datenbank durch den Betreiber.
  Bisher wurde ausschliesslich in eine isolierte Testkampagne importiert.

## Prüfung

Der echte private Vorlagensatz wurde auf einer separaten SQLite-Kopie importiert:
31 NPCs, acht Organisationen, 31 Mitgliedschaften und 27 Beziehungen. Beim zweiten
Durchlauf null neue Datensätze und identische Tabelleninhalte. Eine anschliessend
manuell veränderte Notiz blieb nach Wiederholung erhalten. Foreign-Key-Check
ohne Fehler. Alle 47 Tabellen der Entwicklungsdatenbank unverändert.
Ergebnis: `.local-backups/lore-import-results.json`.

Automatisierte Tests prüfen Schema-/Quellenvalidierung, manipulierte Quelltexte,
Links/Embeds, private Pfade, Schutz getrackter Datenbanken, Dry-run, Import,
Idempotenz, manuelle Änderungen, Kampagnenisolation und Konflikt-Rollback.
Es sind keine Prisma-Schemaänderungen oder neuen Migrationen erforderlich.

Abschliessend erfolgreich: **470 Tests in 34 Dateien**, Typecheck, ESLint,
Production Build und Prisma Validation. Alle 15 vorhandenen Migrationen sind
angewendet. Nach der abschliessenden Haltungskorrektur wurden die neun neuen
Lore-Tests und der echte isolierte Paketimport erneut erfolgreich ausgeführt.
Private Pakete/Audits sind nachweislich Git-ignoriert. Neue Browserprüfungen
waren für diese rein lokale Audit-/Import-Iteration nicht erforderlich.

Audit erneut ausführen, ohne Daten zu ändern:

```powershell
npx tsx scripts/lore-audit.ts .local-backups/lore-vault-snapshot.json
```

Snapshot-Format: `revision` enthält den unveränderlichen Git-Tree-SHA, `docs`
enthält je Datei `path`, Git-Blob-`sha` und vollständigen `content`;
`availablePaths` enthält auch Assets zur Auflösung von Obsidian-Embeds.
Private Ausgaben dürfen nur unter `.local-backups/` geschrieben werden.
