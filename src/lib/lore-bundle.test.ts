import { afterAll, beforeAll, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loreBundleSchema, loreEntityId } from "./lore-bundle";
import { importLoreBundle, privateLorePath, assertPrivateLoreDatabase } from "../../scripts/lore-import";
import { auditLinks, normalizeLoreName, verifyLoreSources } from "../../scripts/lore-audit";
const source = { path: "Campaign/Example.md", sha: "a".repeat(40) };
const bundle = () => ({ format: 1, key: "fixture:v1", revision: "b".repeat(40), npcs: [{ key: "teacher", name: "Example Teacher", category: "SHINOBI", sources: [source], notes: "PRIVATE_FACT" }, { key: "student", name: "Example Student", category: "OTHER", sources: [source] }], organizations: [{ key: "team", name: "Example Group", type: "TEAM", sources: [source], members: [{ npcKey: "teacher", role: "Mentor" }, { npcKey: "student" }] }], relationships: [{ key: "mentorship", sourceKey: "teacher", targetKey: "student", type: "MENTOR", description: "Explicit fixture relationship", sources: [source] }] });
let directory: string, db: PrismaClient, first: string, second: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "lore-test-")); db = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  for (const name of (await readdir("prisma/migrations")).filter(n => /^\d/.test(n)).sort()) { const sql = (await readFile(join("prisma/migrations", name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, ""); for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement); }
  first = (await db.campaign.create({ data: { name: "First", dmCodeHash: "a", playerCodeHash: "b" } })).id;
  second = (await db.campaign.create({ data: { name: "Second", dmCodeHash: "c", playerCodeHash: "d" } })).id;
}, 60000);
afterAll(async () => { await db.$disconnect(); await rm(directory, { recursive: true, force: true }); });
it("validates source provenance, references and duplicate keys without inventing missing values", () => {
  const parsed = loreBundleSchema.parse(bundle()); expect(parsed.npcs[0].age).toBeNull(); expect(parsed.npcs[0].ninjaRank).toBe("");
  const duplicate = bundle(); duplicate.npcs.push(duplicate.npcs[0]); expect(loreBundleSchema.safeParse(duplicate).success).toBe(false);
  const invalid = bundle(); invalid.relationships[0].targetKey = "missing"; expect(loreBundleSchema.safeParse(invalid).success).toBe(false);
  const path = bundle(); path.npcs[0].sources[0] = { ...source, path: "../secret.md" }; expect(loreBundleSchema.safeParse(path).success).toBe(false);
});
it("audits Obsidian links with ambiguity, relative paths and embeddings", () => {
  const docs = [{ path: "A/Start.md", sha: source.sha, content: "[[Other]] [[A/Other|label]] ![[image.png]] [[Missing]]" }, { path: "A/Other.md", sha: source.sha, content: "" }, { path: "B/Other.md", sha: source.sha, content: "" }];
  const links = auditLinks(docs, [...docs.map(d => d.path), "image.png"]); expect(links.map(l => l.status)).toEqual(["RESOLVED", "RESOLVED", "RESOLVED", "MISSING"]);
  expect(normalizeLoreName("Nikkōton")).toBe(normalizeLoreName("Nikkoton"));
});
it("rejects public and escaped private bundle paths", () => {
  expect(() => privateLorePath("public/bundle.json")).toThrow(); expect(() => privateLorePath(".lore-storage/../other.json")).toThrow(); expect(privateLorePath(".lore-storage/bundle.json")).toContain("bundle.json");
});
it("rejects changed source text instead of trusting an unchanged provenance label", () => {
  const doc = { path: "Empty.md", sha: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391", content: "" };
  expect(() => verifyLoreSources([doc])).not.toThrow(); expect(() => verifyLoreSources([{ ...doc, content: "altered" }])).toThrow("Git blob");
});
it("refuses writing private lore to a tracked database", async () => {
  const fake = { $queryRawUnsafe: async () => [{ name: "main", file: join(process.cwd(), "prisma", "dev.db") }] } as unknown as PrismaClient;
  await expect(assertPrivateLoreDatabase(fake)).rejects.toThrow("getrackte"); await expect(assertPrivateLoreDatabase(db)).resolves.toBeUndefined();
});
it("previews without writing and imports private incomplete NPC profiles with memberships", async () => {
  const preview = await importLoreBundle(db, first, bundle()); expect(preview.createNpcs).toBe(2); expect(await db.npc.count()).toBe(0);
  const result = await importLoreBundle(db, first, bundle(), true); expect(result.createRelationships).toBe(1); expect(result.createMemberships).toBe(2);
  const profiles = await db.npc.findMany({ where: { campaignId: first } }); expect(profiles.every(n => !n.playerVisible && n.age === null && n.characterId === null)).toBe(true);
  expect(profiles.find(n => n.name === "Example Teacher")!.dmSecrets).toContain(source.path); expect(await db.character.count()).toBe(0);
  expect((await db.organization.findMany()).every(o => !o.playerVisible && o.attitude === "UNKNOWN")).toBe(true); expect((await db.characterRelationship.findMany()).every(r => !r.playerVisible)).toBe(true);
});
it("repeats idempotently and preserves manual edits including published visibility", async () => {
  const id = loreEntityId(first, "fixture:v1", "npc", "teacher"); await db.npc.update({ where: { id }, data: { name: "Edited name", dmSecrets: "Edited secret", playerVisible: true } });
  const result = await importLoreBundle(db, first, bundle(), true); expect(result.createNpcs).toBe(0); expect(result.createMemberships).toBe(0); expect(result.createRelationships).toBe(0);
  expect(await db.npc.findUnique({ where: { id } })).toMatchObject({ name: "Edited name", dmSecrets: "Edited secret", playerVisible: true });
});
it("creates independent campaign copies and rejects nonexistent campaigns", async () => {
  await importLoreBundle(db, second, bundle(), true); expect(await db.npc.count({ where: { campaignId: second } })).toBe(2); expect(loreEntityId(first, "fixture:v1", "npc", "student")).not.toBe(loreEntityId(second, "fixture:v1", "npc", "student"));
  await expect(importLoreBundle(db, "missing", bundle(), true)).rejects.toThrow("Kampagne");
});
it("reports existing-name conflicts and rolls back the whole import", async () => {
  const conflicting = bundle(); conflicting.key = "another:v1";
  const before = await db.npc.count(); const preview = await importLoreBundle(db, second, conflicting); expect(preview.conflicts.length).toBeGreaterThan(0);
  await expect(importLoreBundle(db, second, conflicting, true)).rejects.toThrow("Importkonflikte"); expect(await db.npc.count()).toBe(before);
});
