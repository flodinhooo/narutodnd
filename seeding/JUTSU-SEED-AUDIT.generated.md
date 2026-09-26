# Jutsu Seed Audit

## Ergebnis

- Bereinigter Master-Pool: **579 Jutsu**
- Elementare Shio-Homebrew-Jutsu: **242**
- Canon-Jutsu: **261**
- Foundation/E-Rang: **13**
- Uzumaki-Pool: **29**
- Aus Charakter-Sheets ergänzte gerankte Jutsu: **34**
- Canon-Duplikate aus Elementbaum entfernt/als Canon priorisiert: **9**

## Spezialnaturen

- `NIKKOTON`: resultierende Spezialnatur; Voraussetzungen `FIRE + LIGHTNING`.
- `IRON_RELEASE`: Raizens Eisenversteck; Voraussetzungen `WATER + EARTH + FIRE`.
- `origin/source` ist unabhängig von `progressionType`. Ein Homebrew-Jutsu kann also `progressionType: FOUNDATION` haben, ohne globale Herkunft `FOUNDATION` zu besitzen.
- Uzumaki behält zusätzlich `traditionProvenance` (`Überliefert`, `Rekonstruiert`, `Shiogakure`).

## Aus Charakter-Sheets nicht als globale Jutsu übernommen

Ungrankte Combat-/Character-Actions bleiben zunächst charakterbezogene Fähigkeiten und werden nicht künstlich zu Jutsu gemacht: `Wolf Fang Combination`, `Wächter des Rudels`, `Shuriken – Windführung` (ungeklärt), `Chakra-Analyse` sowie normale Waffen-/ANBU-Angriffe. Diese können später bewusst als Ability/Technique-Modell umgesetzt werden.

## Canon-Kollisionen

- `Suiton: Suirō no Jutsu` → Canon-Eintrag `Suiton: Suirō no Jutsu` ist Provenance-Quelle.
- `Kirigakure no Jutsu` → Canon-Eintrag `Kirigakure no Jutsu` ist Provenance-Quelle.
- `Fūton: Shinkūgyoku` → Canon-Eintrag `Fūton: Shinkūgyoku` ist Provenance-Quelle.
- `Suiton: Suijinheki` → Canon-Eintrag `Suiton: Suijinheki` ist Provenance-Quelle.
- `Suiton: Suidanha ✂️💧` → Canon-Eintrag `Suiton: Suidanha` ist Provenance-Quelle.
- `Suiton: Suikōdan no Jutsu 🦈🌊` → Canon-Eintrag `Suiton: Suikōdan no Jutsu` ist Provenance-Quelle.
- `Fūton: Shinkūjin` → Canon-Eintrag `Fūton: Shinkūjin` ist Provenance-Quelle.
- `Katon: Gōka Mekkyaku` → Canon-Eintrag `Katon: Gōka Mekkyaku` ist Provenance-Quelle.
- `Suiton: Suiryūdan no Jutsu` → Canon-Eintrag `Suiton: Suiryūdan no Jutsu` ist Provenance-Quelle.

## Nächster Integrationsschritt

Vor dem Seed-Lauf muss das Prisma-Modell um Herkunft/Pool, Progression/Voraussetzungen und kampagnengebundene DM-Custom-Jutsu erweitert werden. Die generierten Dateien sind absichtlich Datenquellen und verändern das bestehende Schema nicht selbst.
