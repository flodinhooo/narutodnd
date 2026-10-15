/** Preserve the original; create and verify consistent SQLite backup/copy first. */
import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const db = new PrismaClient();
async function fingerprint(client: PrismaClient) {
  const tables = await client.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const values = [];
  for (const { name } of tables) values.push([name, await client.$queryRawUnsafe(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`)]);
  return createHash("sha256").update(JSON.stringify(values, (_, v) => typeof v === "bigint" ? v.toString() : v)).digest("hex");
}
async function main() {
  await mkdir(".local-backups", { recursive: true }); await mkdir(".private-data", { recursive: true, mode: 0o700 });
  const backup = resolve(`.local-backups/pre-private-database-${Date.now()}.sqlite`).replaceAll("\\", "/"), target = resolve(".private-data/dev.sqlite").replaceAll("\\", "/");
  const hash = await fingerprint(db); await db.$executeRawUnsafe("VACUUM INTO ?", backup); await db.$executeRawUnsafe("VACUUM INTO ?", target);
  const copy = new PrismaClient({ datasourceUrl: `file:${target}` });
  try {
    if (hash !== await fingerprint(copy) || hash !== await fingerprint(db)) throw new Error("Database changed or copy differs; configuration NOT changed.");
    const fk = await copy.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check"); if (fk.length) throw new Error("Foreign key violations");
    const env = await readFile(".env", "utf8"); if (!/^DATABASE_URL=.*$/m.test(env)) throw new Error("DATABASE_URL missing");
    await writeFile(".env", env.replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL="file:../.private-data/dev.sqlite"'), { mode: 0o600 });
    await writeFile(".local-backups/private-database-results.json", JSON.stringify({ backup, target, identical: true, foreignKeyViolations: 0, originalPreserved: true }, null, 2), { mode: 0o600 });
    console.log("Consistent backup and private copy verified. Configuration switched; original preserved.");
  } finally { await copy.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
