# Persistente HP-Level-Ups

## Regeln und Daten

- Level 1: d8 = 8, d10 = 10, jeweils zuzüglich aktuellem finalem CON-Modifikator. Kein Roll für Level 1.
- Ab Level 2: d8 würfelt 1–8, Mindestwert 4; d10 würfelt 1–10, Mindestwert 5. `rawRoll` bleibt unverändert; `effectiveRoll = max(rawRoll, Minimum)`.
- `calculateMaxHp`: Hit-Die-Maximum + Summe der aktiven persistierten effectiveRolls + aktueller CON-Modifikator × Level. Fehlende Rolls sind Fehler; die frühere pauschale +6-Regel ist entfernt.
- Negative CON-Modifikatoren werden unverändert addiert. Das gesamte HP-Maximum wird auf mindestens 1 begrenzt; einzelne Level-Beiträge können bei sehr niedriger CON negativ sein.
- `CharacterHpLevel`: id, Character-Relation, level, hitDie, rawRoll, effectiveRoll, createdAt. Unique Constraint auf `(characterId, level)` und zusätzliche SQLite-Checks auf Level, Hit Die und Raw-/Effective-Range. Bestätigte Einträge sind unveränderlich; keine Action löscht oder ersetzt sie.
- `maxHp` bleibt das persistierte effektive Maximum für Rest-, Combat- und sonstige bestehende Systeme. Es wird bei HP-relevanten Mutationen zentral neu berechnet, nicht beim Rendern überschrieben.

## Workflow und Autorität

Der DM Workshop bietet ein Ziel-Level an. Jeder fehlende Level wird einzeln bestätigt. Automatisch würfeln erzeugt genau einen Raw-Wurf auf dem Server bei einem bewussten Klick. Die UI hält die Vorschau im State und verwendet sie beim erneuten Rendern oder Moduswechsel weiter. Der Server signiert den Raw-Wurf mit der HttpOnly-Sitzungs-ID und bindet ihn an Campaign, Character, Hit Die und Ziel-Level. Es gibt vor Bestätigung keinen bestätigten History-Eintrag. Ein manipuliertes oder aus einer anderen Sitzung/Character/Level stammendes Token wird abgewiesen.

Manuelles Würfeln nimmt ausschließlich einen Integer innerhalb des jeweiligen Würfels an; niedrige Würfe sind gültig. Der Client zeigt Raw, Minimum, Effective, aktuellen CON-Modifikator und Beitrag. Bei Bestätigung berechnet der Server Effective und HP erneut aus dem aktuellen Character. Clientseitige effectiveRoll-/hpIncrease-Werte werden ignoriert.

Bestätigung, Historieneintrag und Character-/Chakra-Update laufen in einer Transaktion. Ein zusätzlicher bedingter Character-Update schützt gegen veraltete Bestätigungen. Fehler rollen auch einen gerade angelegten Wurf zurück. Campaign-Zugehörigkeit und DM-Autorisierung werden serverseitig geprüft. Doppelte Bestätigungen beziehungsweise konkurrierende Anfragen können weder zwei Rolls noch doppelten HP-Zuwachs erzeugen.

Bei Erstellung über Level 1 wählt der Creator für jedes Level einen manuellen Wurf oder automatische Erzeugung bei Bestätigung der Erstellung. Automatische Creation-Rolls werden einmalig beim Submit auf dem Server erzeugt und gemeinsam mit dem Character gespeichert; die Vorschau kennzeichnet noch ausstehende automatische Rolls ausdrücklich.

## Current HP, CON und Overrides

Alle HP-Änderungen verwenden `preserveHpDamage`: neues Current HP = neues Maximum − bisheriger Schaden, begrenzt auf 0 bis neues Maximum. Beispiel: 32/40 +8 wird 40/48. CON-Änderungen wirken rückwirkend auf alle aktiven Character-Level und ändern Current HP um denselben Unterschied, soweit die Grenzen dies erlauben.

Ein bewusster DM-Override wird als nullable `hpOverrideOffset` relativ zu den regelbasierten HP gespeichert. Eingabe 50 bei Derived 40 speichert +10. Spätere Level-/CON-Änderungen behalten diesen Aufschlag und damit die Schadenserhaltung. Erneutes Absenden des unveränderten Maximums behält den Aufschlag, statt einen gleichzeitig gestiegenen CON-Anteil zu unterdrücken. Ein geänderter numerischer Wert setzt einen neuen Aufschlag; leeres Maximum-HP-Feld entfernt ihn. Die Historie zeigt Derived HP, Override-Aufschlag und effektives Maximum getrennt.

Teilformulare erhalten fehlende Character-Werte. Level-Sprünge über unbekannte Würfe werden auch bei manipuliertem Override abgewiesen. Sprünge mit vollständig bestehender Historie sind möglich; die normale Level-Up-UI führt die Bestätigungen einzeln aus.

## Level-Senkung und Legacy

Beim Senken bleiben alle bestätigten Rolls bestehen. Die Berechnung berücksichtigt nur aktive Level. Beim Wiederaufstieg werden gespeicherte Rolls wiederverwendet; automatisches Neuwürfeln eines solchen Levels wird abgewiesen.

Die Migration setzt für jeden bereits bestehenden Character:

- `hpLegacyLevel = bisheriges Level`
- `hpLegacyBase = bisheriges maxHp − bisheriger CON-Modifikator × bisheriges Level`
- `hpOverrideOffset = null`

Ursprüngliche HP und Current HP bleiben exakt erhalten; es werden keine zufälligen oder erfundenen historischen Würfe angelegt. Oberhalb dieser Baseline beginnen neue Rolls. Änderungen der aktuellen CON wirken auch für Legacy-Charaktere pro aktivem Level.

Die unbekannte historische Zusammensetzung einer Legacy-Baseline lässt sich nicht rekonstruieren. Bei Senkung unter das Legacy-Level bleibt deshalb der feste CON-freie Baseline-Anteil bestehen, während nur der aktive CON-Anteil und bekannte Rolls berücksichtigt werden. Wiederaufstieg innerhalb dieser Baseline erfordert keinen erfundenen historischen Roll. Die Sheet-Historie weist darauf hin. Ein DM kann bei Bedarf bewusst einen HP-Override setzen.

## Lokale Migration und Verifikation

Am 01.10.2026 wurde `prisma/dev.db` mit SQLite-Backup-API nach `.local-backups/before-hp-history-20261001-121027.sqlite` gesichert. Backups/Snapshots sind git-ignoriert. Integrität vor Migration: OK.

Mit `npx prisma migrate deploy` wurden tatsächlich angewendet:

1. bereits offene `20260927180000_add_initiative_override`
2. `20261001120000_hit_die_ability_bonus`
3. neue additive `20261001130000_hp_level_history`

Alle 3 Campaigns und 3 Characters sind mit sämtlichen ursprünglichen Feldwerten erhalten. Legacy-Baselines wurden gegen die originalen HP geprüft; keine historischen Rolls angelegt. `PRAGMA integrity_check` und `foreign_key_check` sind erfolgreich. Prisma meldet alle Migrationen angewendet. Kein Reset, keine Seeds, keine Löschung bestehender Daten.

Die Migrationsfolge wurde außerdem auf einer isolierten SQLite-Datenbank gegen das Prisma-Schema verglichen (keine Differenz). Integrationstests verwenden ausschließlich eigene temporäre SQLite-Datenbanken, wenden die reale Migrationsfolge an und testen Legacy-Erhalt, Constraints, tatsächliche Server Actions, Autorisierung, Konkurrenz, Rollback, Level-Historie, CON und Overrides. Die bisherigen HP-Tests behalten ihre Zahlenassertionen, stellen dafür nun echte explizite Rolls statt einer entfallenen Pauschalregel bereit.

Abschluss: Prisma Validate erfolgreich; 200 Tests in 12 Dateien bestanden; Lint, Typecheck und Production Build erfolgreich. Bestehende 130 Tests wurden beibehalten und für die bewusst ersetzte HP-Progression mit expliziter Historie angepasst.
