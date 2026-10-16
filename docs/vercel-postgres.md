# Vercel und PostgreSQL

Die SQLite-Entwicklung nutzt weiterhin `prisma/schema.prisma` und die bisherigen
Migrationen. PostgreSQL nutzt `prisma/postgresql/schema.prisma` mit eigener
Migrationshistorie. Bei Schemaänderungen müssen beide Schemata gepflegt werden.
Die vorhandene SQLite-Datei bleibt erhalten.

Vercel: Projektverzeichnis `narutodnd`, Build Command `npm run vercel-build`.
`DATABASE_URL` muss auf die PostgreSQL-Datenbank zeigen. Zusätzlich
`CAMPAIGN_ACCESS_LOOKUP_SECRET` und `PUBLIC_APP_URL` konfigurieren. Bei Übernahme
bestehender Kampagnen den bisherigen Lookup-Schlüssel beibehalten.

Ohne `CAMPAIGN_ACCESS_LOOKUP_SECRET` liefert das Erstellen einer Kampagne in
Production HTTP 500. Einen privaten Zufallswert einmalig mit
`node -p "require('crypto').randomBytes(32).toString('hex')"` erzeugen und in
Vercel unter Settings → Environment Variables als
`CAMPAIGN_ACCESS_LOOKUP_SECRET` für Production eintragen. Den Wert dauerhaft
beibehalten. Anschließend neu deployen; bestehende Deployments übernehmen neue
Umgebungsvariablen nicht. Der Vercel-Build prüft nun Datenbank-URL und Schlüssel,
bevor er den Prisma-Client generiert.

Nach Freigabe der Umstellung einmalig Migrationen ausführen:

```powershell
node --env-file=.env.vercel.local node_modules/prisma/build/index.js migrate deploy --schema prisma/postgresql/schema.prisma
npm run db:seed:postgres
```

`.env.vercel.local` enthält ausschließlich lokale Zugangsdaten und wird durch
`.gitignore` ausgeschlossen. In Vercel werden Umgebungsvariablen aus den
Projekteinstellungen verwendet. Zugangsdaten niemals committen.

Der Seed erstellt globale Jutsu, Chakra-Naturen, Gegner, Missionsvorlagen und die
Weltatlas-Vorlage. Kampagnen, Charaktere und private Lore werden damit nicht aus
SQLite übernommen. Eine solche Übernahme benötigt einen separaten Datenimport.

`db:seed:postgres` generiert den PostgreSQL-Client. Vor Rückkehr zur lokalen
SQLite-Entwicklung `npx prisma generate` ausführen.

Portraits, Atlas-Uploads und private Lore verwenden bisher Dateispeicher. Diese
Funktionen benötigen für Vercel einen geeigneten persistenten Speicher. Der
Lore-Import verwendet zusätzlich SQLite-spezifische Backup-Befehle und muss vor
Verwendung mit PostgreSQL angepasst werden. Ein Datenbankwechsel allein macht
diese Funktionen noch nicht Vercel-tauglich.

Am 16.10.2026 nach Deployment-Bestätigung ausgeführt: PostgreSQL-Migration
`20261016000000_init` und globaler Seed. Datenbankabfrage bestätigt 579 Jutsu,
7 Chakra-Naturen, 20 Gegner, 6 Missionsvorlagen und 1 Weltatlas-Vorlage.
TypeScript-Prüfung mit dem PostgreSQL-Client erfolgreich. Der Seed meldet
221 nicht automatisch verknüpfte Jutsu-Voraussetzungen; die Voraussetzungstexte
bleiben gespeichert. Kampagnen und Charaktere wurden nicht übertragen.

`vercel.json` legt den PostgreSQL-Build explizit fest. Diese Repository-Änderungen
müssen in einem neuen Vercel-Deployment enthalten sein; ein bereits vorhandenes
Deployment erhält dadurch nicht nachträglich einen anderen Prisma-Client.
