# Naruto D&D Campaign Manager

Eine Naruto-inspirierte Kampagnenverwaltung für Spielleitung und Spieler mit Charakterbögen, Chakra-Regeln, Jutsu, Weltorten und Spielsitzungen.

## Stack

Next.js 16.3.5, React 19.2.8, TypeScript, Prisma 6 mit SQLite, Zod und Vitest.

## Lokal starten

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Die lokale Datenbank liegt unter `prisma/dev.db`. Migrationen erhalten bestehende Daten.

## Umgebungsvariablen

```env
DATABASE_URL="file:./dev.db"
CAMPAIGN_ACCESS_LOOKUP_SECRET="a-long-random-secret"
```

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
