# Codex – Shiranami / Itohara Hiden integrieren

## Wichtig
Die Daten folgen dem bestehenden `JutsuSeedRecord` aus `seeding/jutsu-seed-types.generated.ts`.
**Vor dem Typecheck** die Union `JutsuSeedPool` um `"CLAN_HIDEN"` erweitern. Dies ist ein Seed-Pool,
kein automatisch existierender Prisma-Enum-Wert. `category: "Hiden"` ist ein String,
nicht automatisch ein Prisma-Enum. Keine Prisma-Enum-Erweiterung blind vornehmen.

## Dateien
- `jutsu-shiranami-hiden.generated.ts`
- `jutsu-itohara-hiden.generated.ts`

Beide nach `seeding/` kopieren.

## Integration
1. Prüfe den aktuellen Seed-Einstiegspunkt und die bestehende Mapping-Logik.
2. Importiere `ShiranamiHidenJutsu` und `ItoharaHidenJutsu` und hänge sie an den vorhandenen globalen Jutsu-Datensatz an.
3. Seed `source = SHIO_HOMEBREW` (global, **nicht** DM_CUSTOM); `pool = CLAN_HIDEN` nur in der Seed-Typisierung,
   falls der Persistenzlayer keine entsprechende Pool-Enum kennt, Mapping dort passend erweitern.
4. `natures` und `requiredNatures` bei Shiranami `WATER`, bei Itohara `[]`.
   Clan-Zugehörigkeit/Lehrerlaubnis als Zugriffsregel gesondert implementieren;
   `prerequisiteText` allein verhindert noch keine Vergabe!
5. `chakraCost = null` ist ABSICHTLICH: Zahlen erst nach Balancing definieren.
6. `role = VORSCHLAG_NICHT_FREIGEGEBEN` bedeutet: nicht automatisch für Spieler freischalten.
   Nur `BESTÄTIGTES_STARTJUTSU` ist loreseitig fest beschlossen.
   Shiranami-Starttechniken waren bislang Entwürfe und bleiben als Vorschläge markiert.
7. Bestehende globale Jutsu, DM_CUSTOM-Isolation und Upsert-Idempotenz erhalten.
8. Prüfe Namens-/Slug-Kollisionen, Zugriffsrechte, Rang- und Chakra-Validierung.
9. Tests, Prisma-Validierung, Lint, Typecheck und Build ausführen.

## Kein automatisches Seeding
Die Dateien sind TypeScript-Seed-Datensätze, **noch nicht** in den Repo-Seed-Einstiegspunkt eingehängt.
