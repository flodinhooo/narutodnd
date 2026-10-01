# Hit-Die-Creator: Implementierung und Regelaudit

Vorher: Grundlagen -> Attribute -> Fertigkeiten -> Chakra -> Jutsu -> Kampf -> Uebersicht.
Jetzt: Shinobi-Typ -> Grundlagen -> Attribute -> Fertigkeiten -> Chakra -> Jutsu -> Kampf -> Uebersicht.

## Daten und Regeln

- `Character.hitDie` bleibt String mit Legacy-Default d10. Server akzeptiert ausschliesslich d8/d10. Ein Prisma-Enum wuerde hier ohne zusaetzlichen Nutzen die Migration komplizieren.
- Additive Migration `20261001120000_hit_die_ability_bonus`: nullable `hitDieAbilityBonus` ohne Default. Vorhandene Scores und Ressourcen bleiben unveraendert.
- D8 verlangt genau einen der Werte STR/DEX/CON/INT/WIS/CHA; D10 verlangt null. Mehrere FormData-Eintraege werden abgewiesen.
- Creator besitzt nur mutable Base Scores. Final Scores entstehen durch `getFinalAbilityScores`. Server validiert Base-Modus/-Werte und Bonus mit `getCreationAbilityScores` und persistiert die finalen Scores. Bonus-Metadaten werden auf dem Sheet angezeigt, nicht erneut addiert. DM bearbeitet weiterhin finale Scores.
- Standard Array bleibt 15/14/13/12/10/8; Point Buy bleibt hoechstens 27 Punkte auf Base Scores 8-15; Manual 1-20. Final Scores duerfen 20 nicht ueberschreiten.
- Level-1-HP: 8 bzw. 10 + finaler CON-Modifikator. Oberhalb Level 1 gelten inzwischen persistente Hit-Die-Rolls mit d8-Minimum 4 und d10-Minimum 5. Details siehe [HP-Level-Ups](hp-level-up.md).
- Alle Creator-Modifikatoren, Skills, Saves, Initiative, AC, HP und Chakra nutzen Final Scores. Wechsel auf d10 loescht die Bonuswahl. Keine Player-Inputs oder Hidden Inputs fuer HP/AC-Overrides.
- DM-HP-Override wird jetzt tatsaechlich beruecksichtigt; fehlende Werte aus Teilformularen bleiben erhalten. HP-Damage bleibt erhalten, Chakra wird bei CON/WIS-/Level-Aenderungen mit bestehender Preserve-Regel aktualisiert. Level-/CON-Aenderungen behalten einen bewussten HP-Override-Aufschlag bei.

## Konzeptueller Abgleich mit D&D 5e (2014)

Referenzen: [Character Creation](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters), [Combat](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat).
D&D Beyond ist Referenz, nicht Projektspezifikation.

| Bereich | Einordnung | Ergebnis |
|---|---|---|
| Ability Scores | entspricht weitgehend D&D 5e | Sechs Attribute, finale Obergrenze 20; Manual 1-20 ist eine freie Kampagnen-Eingabe. |
| Ability Modifiers | entspricht weitgehend D&D 5e | floor((Score-10)/2), aus finalen Scores. |
| Standard Array | entspricht weitgehend D&D 5e | 15/14/13/12/10/8 exakt einmal. |
| Point Buy | entspricht weitgehend D&D 5e | 27 Budget, 8-15 vor Bonus, uebliche Kosten; unausgegebenes Budget erlaubt. |
| Skill Proficiencies | bewusst Naruto-modifiziert | Bis zu drei frei gewaehlte Skills statt Klasse/Hintergrund. Modifier-/Expertise-Formeln entsprechen 5e. |
| Saving Throw Proficiencies | bewusst Naruto-modifiziert | Frei waehlbar, keine Anzahlbegrenzung, statt klassenbasierter Auswahl. |
| Proficiency Bonus | entspricht weitgehend D&D 5e | +2 bis +6 nach Level. |
| Hit Dice | bewusst Naruto-modifiziert | Klassenlos: freie d8/d10-Wahl; d8 gewaehrt einen Attributbonus. |
| HP | moegliche Inkonsistenz / offene Designentscheidung | Level 1 folgt maximalem Hit Die + CON; Persistente Rolls mit Naruto-Mindestwert d8=4/d10=5 ersetzen die fruehere +6-Regel. |
| Constitution Modifier | entspricht weitgehend D&D 5e | Wirkt auf HP je Stufe; wirkt zusaetzlich auf Naruto-Chakra. |
| Initiative | entspricht weitgehend D&D 5e | DEX-Modifikator. |
| AC | bewusst Naruto-modifiziert | Bestehende Basis 12 + DEX statt ungeruestet 10 + DEX; DM-Override bleibt. |
| Speed | moegliche Inkonsistenz / offene Designentscheidung | 30 ft Default, frei editierbar statt Herkunft-/Ruestungsregel. |
| Death Saves | bewusst Naruto-modifiziert | Drei Erfolgs-/Fehlschlagzaehler; Chakra bestimmt Vorteil/Normal/Nachteil. Keine automatische vollstaendige 5e-Wuerfelaufloesung. |

## Bewusst erhalten und offene Punkte

Chakra, Reservoir, Kontrolle, Regeneration, Nature, Jutsu, Breakthrough Points, Limit Break, Exhaustion und Rest-Regeln bleiben Naruto-Systeme. Das bestehende Short Rest stellt volle HP wieder her (bis zweimal), statt Hit Dice auszugeben.

Vorhandene, ausserhalb der Hit-Die-Aenderung liegende Inkonsistenzen: Creator-Auswahl von Regeneration/Kontrolle wird bisher nicht uebermittelt; Server verwendet TRAINED-Defaults. Initiative-Override ist im DM-Formular vorhanden, wird aber bisher weder gespeichert noch auf dem Sheet verwendet. Nicht automatisch geaendert.

DM-Bonuskennzeichnung dokumentiert die urspruengliche D8-Wahl; nach administrativer Aenderung finaler Scores stellt sie keine rekonstruierbare historische Base-Verteilung dar.

## Verifikation

Rule-Tests fuer alle sechs Boni, ungueltige Kombinationen, Base/Final-Grenzen, alle Verteilungsmodi, Derived Stats und HP; echte Server-Action-Tests mit gemockter Persistenz fuer manipulierte FormData/Autorisierung; DM-Teilformular-/HP-Override-Regressionspruefungen. Bestehende Tests bleiben erhalten.

Migrationen wurden inzwischen auch auf der lokalen Entwicklungsdatenbank mit Backup angewendet; alle 3 Campaigns und 3 Characters sind erhalten. Siehe [Migrationsbericht](hp-level-up.md).
