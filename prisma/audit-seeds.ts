/** Local, non-destructive seed verification. Run before, after-first, after-second. */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CanonJutsu } from "../seeding/jutsu-canon.generated";
import { HomebrewElementalJutsu } from "../seeding/jutsu-homebrew-elemental.generated";
import { FoundationJutsu } from "../seeding/jutsu-foundation.generated";
import { UzumakiJutsu } from "../seeding/jutsu-uzumaki.generated";
import { CharacterSignaturesJutsu } from "../seeding/jutsu-character-signatures.generated";

const prisma = new PrismaClient();
const reportPath = resolve(".local-backups/seed-audit.json");
const serialize = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v);
const hash = (value: unknown) => createHash("sha256").update(serialize(value)).digest("hex");
type Snapshot = { counts: Record<string, number>; hashes: Record<string, string>; campaignHash: string };
type Report = { backup: string; before: Snapshot; "after-first"?: Snapshot; "after-second"?: Snapshot };
async function snapshot(): Promise<Snapshot> {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const contents: Record<string, Record<string, unknown>[]> = {};
  for (const { name } of tables) contents[name] = await prisma.$queryRawUnsafe(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`);
  const globalJutsu = new Set(contents.Jutsu.filter(j => j.campaignId === null).map(j => j.id));
  const slugs = new Set(contents.Jutsu.filter(j => j.campaignId === null).map(j => j.slug));
  const expectedSlugs = new Set([...CanonJutsu, ...HomebrewElementalJutsu, ...FoundationJutsu, ...UzumakiJutsu, ...CharacterSignaturesJutsu].map(j => (j.slug || j.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100)));
  if ([...expectedSlugs].some(slug => !slugs.has(slug))) throw new Error("Registered Jutsu missing from global library");
  const globalEnemies = new Set(contents.EnemyTemplate.filter(e => e.campaignId === null).map(e => e.id));
  const campaignContents = Object.fromEntries(Object.entries(contents).filter(([name]) => !["ChakraNature", "MissionTemplate", "_prisma_migrations"].includes(name)).map(([name, rows]) => [name, rows.filter(row => {
    if (name === "Jutsu") return row.campaignId !== null;
    if (name === "EnemyTemplate") return row.campaignId !== null;
    if (["JutsuChakraNature", "JutsuPrerequisite"].includes(name)) return !globalJutsu.has(row.jutsuId);
    if (["EnemyTemplateNature", "EnemyTemplateJutsu"].includes(name)) return !globalEnemies.has(row.templateId);
    return true;
  })]));
  for (const [name, rows, key] of [["Jutsu", contents.Jutsu.filter(j => j.campaignId === null), "slug"], ["EnemyTemplate", contents.EnemyTemplate.filter(e => e.campaignId === null && e.seedKey), "seedKey"], ["MissionTemplate", contents.MissionTemplate, "seedKey"]] as const) {
    if (new Set(rows.map(r => r[key])).size !== rows.length) throw new Error(`Duplicate global keys in ${name}`);
  }
  const violations = await prisma.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
  if (violations.length) throw new Error("Foreign key violations");
  return { counts: {
    globalJutsu: globalJutsu.size, globalEnemies: globalEnemies.size, missionTemplates: contents.MissionTemplate.length,
    chakraNatures: contents.ChakraNature.length, campaigns: contents.Campaign.length, characters: contents.Character.length,
    npcs: contents.Npc.length, organizations: contents.Organization.length, missions: contents.Mission.length,
    encounterRuns: contents.EncounterRun.length, gameSessions: contents.GameSession.length,
  }, hashes: Object.fromEntries(Object.entries(contents).map(([name, rows]) => [name, hash(rows)])), campaignHash: hash(campaignContents) };
}
async function main() {
  const stage = process.argv[2];
  if (!["before", "after-first", "after-second"].includes(stage)) throw new Error("Usage: tsx prisma/audit-seeds.ts before|after-first|after-second");
  let report: Report;
  if (stage === "before") {
    await mkdir(resolve(".local-backups"), { recursive: true });
    const backup = resolve(`.local-backups/pre-ux-seeds-${Date.now()}.sqlite`).replaceAll("\\", "/");
    await prisma.$executeRawUnsafe("VACUUM INTO ?", backup);
    report = { backup, before: await snapshot() };
  } else {
    report = JSON.parse(await readFile(reportPath, "utf8"));
    const current = await snapshot();
    if (current.campaignHash !== report.before.campaignHash) throw new Error("Campaign data changed during seeding");
    if (stage === "after-second" && (!report["after-first"] || serialize(current) !== serialize(report["after-first"]))) throw new Error("Second seed changed database content or record identities");
    report[stage as "after-first" | "after-second"] = current;
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ stage, backup: report.backup, counts: (stage === "before" ? report.before : report[stage as "after-first" | "after-second"])!.counts, foreignKeys: "OK", campaignData: "unchanged" }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
