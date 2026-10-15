# Shio no Kuni – Naruto D&D

Eine Naruto-inspirierte Kampagnenverwaltung für Spielleitung und Spieler mit Charakterbögen, Chakra-Regeln, Jutsu, Weltorten und Spielsitzungen.

## Stack

Next.js 16.3.5, React 19.2.8, TypeScript, Prisma 6 mit SQLite, Zod und Vitest.

## Lokal starten

```bash
npm install
npm run db:prepare
npm run db:migrate
npm run db:seed
npm run dev
```

Vor dem ersten Start eine private `.env` anhand von `.env.example` konfigurieren.
Die lokale Datenbank liegt unter `.private-data/dev.sqlite`. Migrationen erhalten
bestehende Daten. Datenbankdateien und SQLite-Sidecars werden nicht eingecheckt.

## Umgebungsvariablen

```env
DATABASE_URL="file:../.private-data/dev.sqlite"
CAMPAIGN_ACCESS_LOOKUP_SECRET="a-long-random-secret"
PUBLIC_APP_URL="https://deine-domain.example"
# Produktion: absoluter Pfad auf einem persistenten, privaten Volume.
PORTRAIT_STORAGE_ROOT="/var/lib/shio/portraits"
ATLAS_STORAGE_ROOT="/var/lib/shio/atlas"
LORE_STORAGE_ROOT="/var/lib/shio/lore"
LORE_BACKUP_ROOT="/var/lib/shio/backups"
```

Branding verwendet das bereitgestellte Original unter
`public/branding/shiogakure-original.png`. Varianten und Icons lassen sich mit
`node scripts/build-branding.mjs` reproduzieren. Portraits liegen lokal standardmässig
unter `.portrait-storage/`, niemals unter `public`. In Produktion ist ein persistentes
Volume mit explizitem `PORTRAIT_STORAGE_ROOT` erforderlich; ephemere Serverless-Dateisysteme
reichen nicht aus. Datenbank und Bildverzeichnis gemeinsam sichern.

Architektur, Upload-Grenzen, Rechte, Tests und Betrieb:
[docs/branding-portraits.md](docs/branding-portraits.md).

`CAMPAIGN_ACCESS_LOOKUP_SECRET` schützt die HMAC-Fingerprints der Kampagnenzugangscodes und muss produktiv gesetzt werden.

## Prüfung

```bash
npm test
npm run lint
npm run typecheck
npm run build
npx prisma validate
```

Der Seed ist idempotent und kann mit `npm run db:seed` erneut ausgeführt werden.

Der kampagnengebundene **Atlas** verwaltet eigene Karten, Ortsmarker und
hierarchische Detailkarten. Unter **Atlas → Karte erstellen → Shio no Kuni
importieren** übernimmt der DM die vorbereitete Welt ausdrücklich in seine
Kampagne. Globale Seeds importieren keine Welt automatisch.
Kartenbilder benötigen ebenfalls privaten persistenten Speicher; lokal wird
`.atlas-storage/` verwendet. Bedienung, Berechtigungen, Originalkarten,
Importstrategie und Prüfergebnisse: [docs/world-atlas.md](docs/world-atlas.md).

Eigene Shio-Lore stammt primär aus dem separaten privaten ObsidianVault.
Private Vorlagen liegen unter `.lore-storage/` bzw. `LORE_STORAGE_ROOT` und werden
nicht veröffentlicht. Quellenabgleich, Konflikte und gezielter lokaler Import:
[docs/lore-seed-audit.md](docs/lore-seed-audit.md). Der Import startet als Dry-run
und schützt vor dem Schreiben privater Lore in Git-getrackte Datenbanken.

Der DM kann Pakete unter **Verwaltung → Lore-Import** einzeln prüfen und auswählen.
85 NPC-Profile, 25 Kampfentwürfe und insgesamt 28 Missionsvorlagen sind über die
lokal bereitgestellten privaten Pakete und sechs bestehenden globalen Vorlagen
vorbereitet. Keine automatische Befüllung bestehender Kampagnen beim Seeding oder
Deployment. Betrieb, Prüfungen und historische Datenbankrisiken:
[docs/living-shiogakure.md](docs/living-shiogakure.md).
