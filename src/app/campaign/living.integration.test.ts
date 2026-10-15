import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { db, getSession } = vi.hoisted(() => ({ db: { client: null as unknown as PrismaClient }, getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return db.client; } }));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { importSelectedLore } from "@/lib/lore-importer";
import { loreBundleSchema } from "@/lib/lore-bundle";
import { lorePackages, readLorePackage } from "@/lib/lore-files";
import { snapshotPlan } from "@/lib/encounter-snapshots";
import { atlasLocationDetail } from "@/lib/atlas-location";
import { calculateMaxChakra, calculateBaseArmorClass, calculateInitiativeBonus } from "@/lib/rules";
import { GET, POST } from "@/app/api/campaign/[campaignId]/lore/route";
import type { LoreSelection } from "@/lib/lore-selection";
const source = { path: "Fixtures/Private.md", sha: "a".repeat(40) };
const combat = { status: "DRAFT", assumptions: "Example draft with explicitly assumed average rolls and trained recovery.", level: 3, str: 12, dex: 16, con: 14, int: 12, wis: 14, cha: 10, hitDie: "d10", reservoir: "AVERAGE", regenRank: "TRAINED", controlRank: "ADVANCED", speed: 30, natureKeys: ["WATER"], jutsuSlugs: ["fixture-water"], skills: [{ skill: "Medicine", proficiency: "PROFICIENT" }], savingThrows: ["CON"], features: "Use support tactics; no automatic secret abilities." };
function bundle() { return { format: 1, key: "living-fixture:v1", revision: "b".repeat(40), npcs: [{ key: "teacher", name: "Fixture Teacher", category: "SHINOBI", status: "CONFIRMED", description: "Public teacher profile", notes: "PRIVATE_BACKGROUND", sources: [source], locationKey: "reigan", combat: structuredClone(combat) }, { key: "helper", name: "Fixture Helper", category: "CIVILIAN", status: "DRAFT", sources: [source], description: "Proposed helper" }], organizations: [{ key: "group", name: "Fixture organisation", type: "OTHER", sources: [source], members: [{ npcKey: "teacher" }, { npcKey: "helper" }] }], relationships: [{ key: "mentor", sourceKey: "teacher", targetKey: "helper", type: "MENTOR", description: "Proposed training relationship", status: "DRAFT", sources: [source] }], missions: [{ key: "delivery", status: "DRAFT", locationKey: "reigan", sources: [source], followUpKeys: [] as string[], blueprint: { title: "Fixture delivery", rank: "D", description: "Deliver supplies", publicInformation: "Help the teacher", dmNotes: "PRIVATE_MISSION", rewards: "A meal", location: { name: "Reigan / Shiogakure", slug: "reigan" }, clientNpcKey: "teacher", npcs: [{ key: "teacher", name: "Fixture Teacher", category: "SHINOBI", description: "Teacher" }], objectives: [{ id: "brief", title: "Talk", description: "Understand the job", dependencyIds: [], optional: false, enabled: true, playerVisible: true }], encounters: [{ key: "scene", name: "Delivery scene", description: "Help carry supplies", type: "SOCIAL", difficulty: "EASY", optional: false, npcKeys: ["teacher"], enemies: [] }] } }] }; }
const selection = (patch: Partial<LoreSelection> = {}): LoreSelection => ({ npcs: ["teacher", "helper"], organizations: ["group"], relationships: ["mentor"], combat: ["teacher"], missions: ["delivery"], approveDrafts: true, approveCombat: true, includeJutsu: true, ...patch });
let directory: string, campaignId: string, foreignId: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "living-shio-")); db.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  vi.stubEnv("LORE_STORAGE_ROOT", join(directory, "packages")); vi.stubEnv("LORE_BACKUP_ROOT", join(directory, "backups")); await mkdir(join(directory, "packages"));
  for (const name of (await readdir("prisma/migrations")).filter(n => /^\d/.test(n)).sort()) { const sql = (await readFile(join("prisma/migrations", name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, ""); for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.client.$executeRawUnsafe(statement); }
  campaignId = (await db.client.campaign.create({ data: { name: "Living test", dmCodeHash: "a", playerCodeHash: "b" } })).id; foreignId = (await db.client.campaign.create({ data: { name: "Foreign", dmCodeHash: "c", playerCodeHash: "d" } })).id;
  await db.client.location.create({ data: { campaignId, name: "Reigan / Shiogakure", slug: "reigan" } });
  const nature = await db.client.chakraNature.create({ data: { key: "WATER", displayName: "Water", description: "Fixture nature" } });
  await db.client.jutsu.create({ data: { slug: "fixture-water", name: "Fixture water", rank: "D", description: "Support", chakraCost: 5, actionType: "Action", range: "Touch", duration: "Instant", requiredNatureKeys: JSON.stringify([nature.key]) } });
  await writeFile(join(directory, "packages", "fixture.json"), JSON.stringify(bundle()));
}, 60000);
beforeEach(() => getSession.mockResolvedValue({ id: "dm", campaignId, role: "DM" }));
afterAll(async () => { await db.client.$disconnect(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
it("requires explicit draft and combat approval and valid packet references", async () => {
  await expect(importSelectedLore(db.client, campaignId, bundle(), selection({ approveDrafts: false }))).rejects.toThrow("Entwürfe");
  await expect(importSelectedLore(db.client, campaignId, bundle(), selection({ approveCombat: false }))).rejects.toThrow("Kampfprofile");
  await expect(importSelectedLore(db.client, campaignId, bundle(), selection({ npcs: ["unknown"] }))).rejects.toThrow("Unbekannte");
  expect(loreBundleSchema.safeParse({ ...bundle(), npcs: [{ ...bundle().npcs[0], combat: { ...combat, int: 22 } }] }).success).toBe(false);
});
it("rejects cyclic mission chains and missing follow-up references", () => {
  const b = bundle(); const second = structuredClone(b.missions[0]); second.key = "second"; second.followUpKeys = ["delivery"]; b.missions[0].followUpKeys = ["second"]; b.missions.push(second);
  expect(loreBundleSchema.safeParse(b).success).toBe(false); b.missions.pop(); expect(loreBundleSchema.safeParse(b).success).toBe(false);
});
it("checks jutsu nature prerequisites and cannot import a foreign campaign technique", async () => {
  const target = (await db.client.campaign.create({ data: { name: "Nature test", dmCodeHash: "nature-dm", playerCodeHash: "nature-pc" } })).id;
  await db.client.location.create({ data: { campaignId: target, name: "Reigan / Shiogakure", slug: "reigan" } });
  const b = bundle(); b.npcs[0].combat!.natureKeys = []; const naturePlan = await importSelectedLore(db.client, target, b, selection()); expect(naturePlan.conflicts.some(c => c.includes("Naturvoraussetzung"))).toBe(true);
  await db.client.jutsu.create({ data: { campaignId: foreignId, slug: "foreign-only", name: "Foreign-only fixture", rank: "D", description: "PRIVATE_FOREIGN", chakraCost: 1, actionType: "Action", range: "Self", duration: "Instant" } });
  b.npcs[0].combat!.jutsuSlugs = ["foreign-only"]; const foreignPlan = await importSelectedLore(db.client, target, b, selection()); expect(foreignPlan.conflicts.some(c => c.includes("Jutsu foreign-only"))).toBe(true); expect(await db.client.character.count({ where: { campaignId: target } })).toBe(0);
});
it("preflights dependencies and own locations without touching another campaign", async () => {
  const plan = await importSelectedLore(db.client, foreignId, bundle(), selection()); expect(plan.conflicts.some(c => c.includes("Ort"))).toBe(true);
  await expect(importSelectedLore(db.client, foreignId, bundle(), selection(), true)).rejects.toThrow("Importkonflikte"); expect(await db.client.npc.count()).toBe(0);
  const missing = await importSelectedLore(db.client, campaignId, bundle(), selection({ npcs: [] })); expect(missing.conflicts.length).toBeGreaterThan(0);
});
it("imports rule-compatible profiles, shared mission clients and private atlas associations", async () => {
  const preview = await importSelectedLore(db.client, campaignId, bundle(), selection()); expect(preview.conflicts).toEqual([]); expect(await db.client.npc.count()).toBe(0);
  const result = await importSelectedLore(db.client, campaignId, bundle(), selection(), true, preview.fingerprint); expect(result.createCharacters).toBe(1); expect(result.createMissions).toBe(1);
  const n = await db.client.npc.findFirstOrThrow({ where: { campaignId, name: "Fixture Teacher" }, include: { character: { include: { hpLevels: true, jutsuLinks: true } } } }); const c = n.character!;
  expect(c.maxHp).toBe(28); expect(c.hpLevels).toHaveLength(2); expect(c.currentChakra).toBe(calculateMaxChakra(3, 14, 14, "AVERAGE")); expect(c.jutsuLinks).toHaveLength(1); expect(n.playerVisible).toBe(false);
  const m = await db.client.mission.findFirstOrThrow({ where: { campaignId }, include: { objectives: true, encounters: true } }); expect(m.clientNpcId).toBe(n.id); expect(m.playerVisible).toBe(false); expect(m.status).toBe("DRAFT"); expect(m.encounters).toHaveLength(1);
  const location = await atlasLocationDetail(campaignId, n.locationId!); expect(location!.npcs.map(v => v.id)).toContain(n.id);
  getSession.mockResolvedValue({ id: "player", campaignId, role: "PLAYER" }); const playerLocation = await atlasLocationDetail(campaignId, n.locationId!); expect(playerLocation!.npcs).toHaveLength(0); expect(playerLocation!.missions).toHaveLength(0);
});
it("rejects stale previews and preserves manual edits on repeat", async () => {
  const preview = await importSelectedLore(db.client, campaignId, bundle(), selection()); const n = await db.client.npc.findFirstOrThrow({ where: { campaignId, name: "Fixture Teacher" } });
  await db.client.npc.update({ where: { id: n.id }, data: { description: "Manual description", dmSecrets: "Manual private note" } });
  await expect(importSelectedLore(db.client, campaignId, bundle(), selection(), true, preview.fingerprint)).rejects.toThrow("veraltet");
  const repeated = await importSelectedLore(db.client, campaignId, bundle(), selection(), true); expect(repeated.createNpcs + repeated.createCharacters + repeated.createMissions + repeated.createRelationships).toBe(0);
  expect(await db.client.npc.findUnique({ where: { id: n.id } })).toMatchObject({ description: "Manual description", dmSecrets: "Manual private note" });
});
it("snapshots character features and separates later sheet changes from the run snapshot", async () => {
  const n = await db.client.npc.findFirstOrThrow({ where: { campaignId, name: "Fixture Teacher" }, include: { character: true } });
  const e = await db.client.encounter.create({ data: { campaignId, name: "Fixture combat" } }); const p = await db.client.encounterParticipantPlan.create({ data: { encounterId: e.id, npcId: n.id } });
  const { snapshot } = await snapshotPlan(db.client, campaignId, p); expect(snapshot.ac).toBe(calculateBaseArmorClass(16)); expect(snapshot.initiative).toBe(calculateInitiativeBonus(16)); expect(snapshot.abilities[0].description).toContain("support tactics"); expect(snapshot.attacks[0]).toMatchObject({ bonus: 5, damageDice: "1d4+3" });
  await db.client.character.update({ where: { id: n.characterId! }, data: { maxHp: 99, currentHp: 45 } }); expect(snapshot.maxHp).toBe(28); expect(snapshot.maxChakra).toBe(n.character!.currentChakra);
});
it("limits file access and never lists invalid review JSON as an import package", async () => {
  await writeFile(join(directory, "packages", "review.json"), JSON.stringify({ secret: "PRIVATE_REVIEW" })); expect((await lorePackages()).map(p => p.id)).toEqual(["fixture.json"]);
  await expect(readLorePackage("../review.json")).rejects.toThrow();
  // Symlink fixture only where the OS permits it; path traversal itself is always covered.
  try { await writeFile(join(directory, "outside.json"), JSON.stringify(bundle())); await symlink(join(directory, "outside.json"), join(directory, "packages", "escape.json")); } catch { return; }
  await expect(readLorePackage("escape.json")).rejects.toThrow("verfügbar");
});
it("protects catalogue and package APIs from players and cross-campaign requests", async () => {
  const params = { params: Promise.resolve({ campaignId }) }; const url = `http://localhost/api/campaign/${campaignId}/lore?package=fixture.json`;
  expect((await GET(new Request(url), params)).status).toBe(200);
  getSession.mockResolvedValue({ id: "pc", role: "PLAYER", campaignId }); const player = await GET(new Request(url), params); expect(player.status).toBe(403); expect(await player.text()).not.toContain("PRIVATE_BACKGROUND");
  getSession.mockResolvedValue({ id: "other", role: "DM", campaignId: foreignId }); expect((await GET(new Request(url), params)).status).toBe(404);
});
it("rejects cross-origin writes and requires exact campaign confirmation", async () => {
  const fd = () => { const f = new FormData(); f.set("package", "fixture.json"); f.set("selection", JSON.stringify(selection())); f.set("op", "PREVIEW"); return f; }, url = `http://localhost/api/campaign/${campaignId}/lore`, params = { params: Promise.resolve({ campaignId }) };
  const bad = await POST(new Request(url, { method: "POST", headers: { origin: "http://foreign" }, body: fd() }), params); expect(bad.status).toBe(403);
  const preview = await POST(new Request(url, { method: "POST", headers: { origin: "http://localhost" }, body: fd() }), params); expect(preview.status).toBe(200);
  const f = fd(); f.set("op", "APPLY"); f.set("fingerprint", (await preview.json()).fingerprint); f.set("confirmation", "Wrong"); expect((await POST(new Request(url, { method: "POST", headers: { origin: "http://localhost" }, body: f }), params)).status).toBe(400);
});
