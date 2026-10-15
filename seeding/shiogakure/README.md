# Shiogakure-Genin

Die zehn gelieferten Obsidian-Profile unter `characters/` und die Daten in
`../shiogakure-genin.seed.ts` wurden unverändert übernommen.

`npm run db:seed` legt die Genin in allen bereits vorhandenen Kampagnen an,
nachdem Naturen und Jutsu-Bibliothek angelegt wurden. Ohne Kampagnen entstehen
keine NPCs. Für später angelegte Kampagnen den Seed erneut ausführen.

Der Prisma-Adapter `prisma/seed-shiogakure-genin.ts` verwendet eine stabile
NPC-ID aus Kampagnen-ID und seedKey. Existierende Datensätze werden vollständig
übersprungen, einschließlich ihrer Character-Verknüpfungen und Jutsu.
NPC und Character werden gemeinsam in einer Transaktion erstellt.

Attribute, HP, AC und Chakrareserve sind Spielwertvorschläge und werden in
DM-Notizen entsprechend bezeichnet. Bereits eingerechnete Attributboni werden
nicht erneut addiert. Nagis Faktor 1.15 wird als vorläufiger Spielwert verwendet.
Akito erhält ausschließlich FIRE, Nikkōton bleibt latent; Itohara erhalten keine
Natur. NPCs bleiben zunächst für Spieler verborgen.

Jutsu-Kandidaten werden standardmäßig nicht gelernt. Für eine ausdrückliche
DM-Freigabe beim erstmaligen Anlegen akzeptiert `seedShiogakureGenin` als drittes
Argument eine Zuordnung `seedKey -> Kandidatenname -> vorhandene Jutsu-ID`.
Nur globale oder kampagneneigene Bibliothekseinträge sind zulässig. Es werden
keine Jutsu erstellt oder anhand ähnlich klingender Namen geraten.
Nachträgliche Freigaben bestehender NPCs erfolgen über die normale Verwaltung.

Prüfung: `npx vitest run src/lib/shiogakure-genin.integration.test.ts`.
