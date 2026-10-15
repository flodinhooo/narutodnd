/** Counts only: never print private text or historical database contents. */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const db = new PrismaClient();
async function inspect(client: PrismaClient) {
  const existing = await client.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table'");
  const counts: Record<string, number> = {};
  for (const [table, fields] of [["CharacterDMData", ["notes", "secretInformation"]], ["Npc", ["dmSecrets"]], ["Mission", ["dmNotes"]], ["Organization", ["dmSecrets"]]] as const) {
    if (!existing.some(t => t.name === table)) continue;
    for (const field of fields) {
      const columns = await client.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${table}")`); if (!columns.some(c => c.name === field)) continue;
      const [row] = await client.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM "${table}" WHERE "${field}" IS NOT NULL AND length(trim("${field}")) > 0`);
      counts[`${table}.${field}`] = Number(row.count);
    }
  }
  return counts;
}
async function main() {
  await mkdir(".local-backups/history-db", { recursive: true });
  const active = await inspect(db), revisions = execFileSync("git", ["log", "--all", "--format=%H", "--", "prisma/dev.db"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const historical = [];
  for (const revision of [...new Set(revisions)].slice(0, 100)) {
    let bytes: Buffer; try { bytes = execFileSync("git", ["show", `${revision}:prisma/dev.db`], { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 100 * 1024 * 1024 }); } catch { continue; }
    const path = resolve(`.local-backups/history-db/${revision}.sqlite`).replaceAll("\\", "/"); await writeFile(path, bytes, { mode: 0o600 });
    const old = new PrismaClient({ datasourceUrl: `file:${path}` }); try { historical.push({ revision, internalFieldCounts: await inspect(old) }); } finally { await old.$disconnect(); }
  }
  const potentiallySensitiveVersions = historical.filter(h => Object.values(h.internalFieldCounts).some(n => n > 0)).length;
  await writeFile(".local-backups/database-privacy-audit.json", JSON.stringify({ active, historical, totalRevisions: revisions.length, skippedRevisions: Math.max(0, revisions.length - 100), potentiallySensitiveVersions }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ inspectedHistoricalVersions: historical.length, potentiallySensitiveVersions, rawPrivateTextLogged: false }));
}
main().catch(() => { console.error("Privacy audit failed; inspect local configuration without publishing private data."); process.exitCode = 1; }).finally(() => db.$disconnect());
