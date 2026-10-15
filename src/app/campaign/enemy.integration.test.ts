import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { enemyTemplateSeeds } from "../../../seeding/enemy-templates";
import { HomebrewElementalJutsu } from "../../../seeding/jutsu-homebrew-elemental.generated";
import { seedBestiary } from "../../../prisma/seed-bestiary";
import { enemyTemplateSchema, parseEnemyForm, type EnemyTemplateInput } from "@/lib/enemy-templates";
import { enemyBlueprint, enemyMaxChakra } from "@/lib/rules/enemies";
import { calculateMaxChakra, calculateBaseArmorClass, calculateInitiativeBonus } from "@/lib/rules";

const { database, requireCampaign } = vi.hoisted(() => ({ database: { client: null as unknown as PrismaClient }, requireCampaign: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return database.client; } }));
vi.mock("@/lib/session", () => ({ requireCampaign }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: vi.fn() }));
import { saveEnemyTemplate, duplicateEnemyTemplate, archiveEnemyTemplate } from "./enemy-actions";
import { getEnemyTemplate, listEnemyTemplates, enemyBuilderOptions } from "@/lib/enemy-library";
import Bestiary from "./[campaignId]/bestiary/page";
import Detail from "./[campaignId]/bestiary/[templateId]/page";
import Edit from "./[campaignId]/bestiary/[templateId]/edit/page";
import NewEnemy from "./[campaignId]/bestiary/new/page";

let directory: string, campaignId: string, foreignId: string, water: string, fire: string, waterJutsu: string, foreignJutsu: string;
let legacySnapshot: unknown;
const legacyCharacters = async () => { const rows = await database.client.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM Character WHERE campaignId = ? ORDER BY id', "upgrade-campaign"); for (const row of rows) { delete row.portraitOwnerKey; delete row.combatProfile; } return rows; };
const legacyData = async () => ({ campaign: await database.client.campaign.findUnique({ where: { id: "upgrade-campaign" }, include: { npcs: true, characterRelationships: true } }), characters: await legacyCharacters(), organizations: await database.client.$queryRawUnsafe('SELECT id,campaignId,name,type,description,notes,dmSecrets,playerVisible,archived,createdAt,updatedAt,locationId FROM Organization ORDER BY id'), members: await database.client.organizationMember.findMany({ orderBy: { id: "asc" } }) });
const input = (extra: Partial<EnemyTemplateInput> = {}): EnemyTemplateInput => ({ ...enemyTemplateSeeds[6].data, natureIds: [], jutsuIds: [], ...extra });
function form(data: EnemyTemplateInput, version = 1) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (["natureIds", "jutsuIds", "savingThrows"].includes(key)) { for (const id of value as string[]) fd.append(key, id); }
    else if (key === "hasChakra") { if (value) fd.set(key, "on"); }
    else fd.set(key, value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  fd.set("version", String(version));
  return fd;
}
const output = (value: unknown) => JSON.stringify(value, (key, item) => key === "type" || key === "_owner" ? undefined : item);
const read = async (id: string) => { const e = await getEnemyTemplate(campaignId, id); if (!e) throw new Error("missing"); return e; };

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "narutodnd-enemy-tests-"));
  database.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  const migrations = join(process.cwd(), "prisma/migrations");
  for (const name of (await readdir(migrations)).filter(n => /^\d/.test(n)).sort()) {
    if (name === "20261014140000_enemy_templates") {
      await database.client.campaign.create({ data: { id: "upgrade-campaign", name: "Existing campaign", dmCodeHash: "upgrade-dm", playerCodeHash: "upgrade-player" } });
      await database.client.character.create({ data: { id: "upgrade-character", campaignId: "upgrade-campaign", name: "Existing PC", maxHp: 35, currentHp: 19, currentChakra: 123 }, select: { id: true } });
      await database.client.npc.create({ data: { id: "upgrade-npc", campaignId: "upgrade-campaign", name: "Existing NPC", dmSecrets: "Preserve secrets" } });
      // Populate the historical schema before later migrations add Organization fields.
      await database.client.$executeRawUnsafe('INSERT INTO Organization (id,campaignId,name,type,updatedAt) VALUES (?,?,?,?,?)', "upgrade-team", "upgrade-campaign", "Existing team", "TEAM", Date.now());
      await database.client.organizationMember.create({ data: { organizationId: "upgrade-team", npcId: "upgrade-npc", role: "Sensei", isLeader: true } });
      await database.client.characterRelationship.create({ data: { campaignId: "upgrade-campaign", sourceNpcId: "upgrade-npc", targetCharacterId: "upgrade-character", type: "MENTOR", dmSecrets: "Existing relationship" } });
      legacySnapshot = await legacyData();
    }
    const sql = (await readFile(join(migrations, name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, "");
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await database.client.$executeRawUnsafe(statement);
  }
  campaignId = (await database.client.campaign.create({ data: { name: "Bestiary", dmCodeHash: "dm", playerCodeHash: "player" } })).id;
  foreignId = (await database.client.campaign.create({ data: { name: "Foreign", dmCodeHash: "fdm", playerCodeHash: "fplayer" } })).id;
  const keys = [...new Set(enemyTemplateSeeds.flatMap(s => s.natureKeys))];
  for (const key of keys) await database.client.chakraNature.create({ data: { key, displayName: key, description: key } });
  water = (await database.client.chakraNature.findUniqueOrThrow({ where: { key: "WATER" } })).id;
  fire = (await database.client.chakraNature.findUniqueOrThrow({ where: { key: "FIRE" } })).id;
  for (const slug of new Set(enemyTemplateSeeds.flatMap(s => s.jutsuSlugs))) {
    const record = HomebrewElementalJutsu.find(j => j.slug === slug);
    if (!record) throw new Error(`Unknown seed Jutsu: ${slug}`);
    const natures = await database.client.chakraNature.findMany({ where: { key: { in: record.natures } } });
    await database.client.jutsu.create({ data: {
      slug, name: record.name, germanName: record.germanName, description: record.rawMarkdown,
      rank: record.rank ?? "E", chakraCost: record.chakraCost ?? 0, range: record.range || "Self", duration: record.duration || "Instantaneous", actionType: record.actionType || "Action",
      requiredNatureKeys: JSON.stringify(record.requiredNatures ?? []), natures: { create: natures.map(n => ({ chakraNatureId: n.id })) },
    } });
  }
  waterJutsu = (await database.client.jutsu.findFirstOrThrow({ where: { slug: "suiton-mizudama-no-jutsu", campaignId: null } })).id;
  foreignJutsu = (await database.client.jutsu.create({ data: { campaignId: foreignId, name: "Foreign secret Jutsu", slug: "foreign", rank: "D", chakraCost: 1, description: "SECRET", range: "Self", duration: "Instant", actionType: "Action" } })).id;
}, 30000);
beforeEach(() => {
  vi.clearAllMocks();
  requireCampaign.mockImplementation(async (id: string) => { if (id !== campaignId) throw new Error("Unauthorized"); return { campaignId, role: "DM" }; });
});
afterAll(async () => {
  await database.client?.$disconnect();
  if (directory) {
    const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("narutodnd-enemy-tests-")) throw new Error("Unexpected cleanup path");
    await rm(target, { recursive: true, force: true });
  }
});

it("seeds twenty distinct, playable templates with complete real Jutsu references", async () => {
  expect(await seedBestiary(database.client)).toBe(20);
  const seeded = await database.client.enemyTemplate.findMany({ where: { seedKey: { not: null } }, include: { natureLinks: true, jutsuLinks: { include: { jutsu: true } } } });
  expect(seeded).toHaveLength(20);
  expect(new Set(seeded.map(e => e.name)).size).toBe(20);
  expect(seeded.filter(e => e.category === "ANIMAL")).toHaveLength(5);
  expect(seeded.filter(e => e.category === "HUMANOID")).toHaveLength(5);
  expect(seeded.filter(e => e.category === "SHINOBI")).toHaveLength(6);
  expect(seeded.filter(e => e.category === "MISSING_NIN")).toHaveLength(4);
  expect(new Set(seeded.map(e => e.difficulty)).size).toBe(6);
  for (const e of seeded) {
    const parsed = enemyTemplateSchema.parse({ ...e, natureIds: e.natureLinks.map(l => l.chakraNatureId), jutsuIds: e.jutsuLinks.map(l => l.jutsuId) });
    expect(parsed.attacks.length).toBeGreaterThan(0); expect(e.campaignId).toBeNull();
    if (!e.hasChakra) { expect(enemyMaxChakra(e)).toBeNull(); expect(e.jutsuLinks).toHaveLength(0); expect(e.natureLinks).toHaveLength(0); }
    for (const { jutsu: j } of e.jutsuLinks) { expect(j.campaignId).toBeNull(); expect(j.chakraCost).toBeLessThanOrEqual(enemyMaxChakra(e)!); }
  }
  expect(await database.client.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
});
it("preserves populated characters, NPCs, teams, memberships and relationships during migration", async () => {
  expect(await legacyData()).toEqual(legacySnapshot);
});
it("seeding is strictly idempotent, retaining IDs, timestamps, versions and links", async () => {
  await seedBestiary(database.client);
  const before = await database.client.enemyTemplate.findMany({ where: { seedKey: { not: null } }, include: { natureLinks: true, jutsuLinks: true }, orderBy: { seedKey: "asc" } });
  await seedBestiary(database.client);
  expect(await database.client.enemyTemplate.findMany({ where: { seedKey: { not: null } }, include: { natureLinks: true, jutsuLinks: true }, orderBy: { seedKey: "asc" } })).toEqual(before);
});
it("missing Jutsu aborts the seed transaction without partial changes", async () => {
  const j = await database.client.jutsu.findFirstOrThrow({ where: { slug: "raiton-rensa-raiko", campaignId: null } });
  const before = await database.client.enemyTemplate.findMany({ orderBy: { id: "asc" } });
  await database.client.jutsu.update({ where: { id: j.id }, data: { slug: "temporarily-missing" } });
  try { await expect(seedBestiary(database.client)).rejects.toThrow("zuerst"); }
  finally { await database.client.jutsu.update({ where: { id: j.id }, data: { slug: j.slug } }); }
  expect(await database.client.enemyTemplate.findMany({ orderBy: { id: "asc" } })).toEqual(before);
});
it("creates and edits a chakrafree enemy with persisted attacks and abilities", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input({ name: "Custom wolf", category: "ANIMAL", ninjaRank: "JONIN", difficulty: "TRIVIAL" })));
  expect(await read(id)).toMatchObject({ campaignId, hasChakra: false, category: "ANIMAL", ninjaRank: "JONIN", difficulty: "TRIVIAL", version: 1 });
  await saveEnemyTemplate(campaignId, id, form(input({ name: "Wolf alpha", abilities: [{ name: "Rudelruf", description: "Ruft Verbündete." }], maxHp: 44 }), 1));
  const edited = await read(id);
  expect(edited).toMatchObject({ name: "Wolf alpha", maxHp: 44, version: 2, abilities: [{ name: "Rudelruf", description: "Ruft Verbündete." }] });
  expect(edited.attacks).toEqual(input().attacks);
});
it("creates a Shinobi using existing chakra, AC and initiative rules", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input({ hasChakra: true, natureIds: [water], jutsuIds: [waterJutsu], level: 5, dex: 16, con: 14, wis: 14, acOverride: null })));
  const e = await read(id), blueprint = enemyBlueprint(e);
  expect(blueprint.maxChakra).toBe(calculateMaxChakra(5, 14, 14, "AVERAGE"));
  expect(blueprint.ac).toBe(calculateBaseArmorClass(16)); expect(blueprint.initiative).toBe(calculateInitiativeBonus(16));
  expect(e.jutsuLinks.map(l => l.jutsuId)).toEqual([waterJutsu]); expect(e.natureLinks.map(l => l.chakraNatureId)).toEqual([water]);
});
it("validates missing, foreign and incompatible Jutsu or nature references", async () => {
  const base = { hasChakra: true, natureIds: [water] };
  for (const patch of [
    { ...base, jutsuIds: [foreignJutsu] }, { ...base, jutsuIds: ["unknown"] }, { ...base, natureIds: ["unknown"] },
    { ...base, natureIds: [fire], jutsuIds: [waterJutsu] }, { ...base, maxChakraOverride: 1, jutsuIds: [waterJutsu] },
  ]) await expect(saveEnemyTemplate(campaignId, null, form(input(patch)))).rejects.toThrow();
});
it("validates Jutsu prerequisite links and preserves all existing links after a rejected edit", async () => {
  const prerequisite = await database.client.jutsu.create({ data: { name: "Prerequisite", slug: "prerequisite", rank: "E", chakraCost: 1, description: "Test", range: "Self", duration: "Instant", actionType: "Action" } });
  const advanced = await database.client.jutsu.create({ data: { name: "Advanced", slug: "advanced", rank: "D", chakraCost: 5, description: "Test", range: "Self", duration: "Instant", actionType: "Action", prerequisites: { create: { prerequisiteJutsuId: prerequisite.id } } } });
  await expect(saveEnemyTemplate(campaignId, null, form(input({ hasChakra: true, jutsuIds: [advanced.id] })))).rejects.toThrow("Voraussetzung");
  const id = await saveEnemyTemplate(campaignId, null, form(input({ hasChakra: true, jutsuIds: [prerequisite.id, advanced.id] })));
  const before = await read(id);
  await expect(saveEnemyTemplate(campaignId, id, form(input({ hasChakra: true, jutsuIds: [advanced.id] }), 1))).rejects.toThrow();
  expect(await read(id)).toEqual(before);
});
it("updates and clears chakra links atomically when converting to an ordinary enemy", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input({ hasChakra: true, natureIds: [water], jutsuIds: [waterJutsu] })));
  await saveEnemyTemplate(campaignId, id, form(input(), 1));
  const e = await read(id);
  expect(e.hasChakra).toBe(false); expect(e.jutsuLinks).toHaveLength(0); expect(e.natureLinks).toHaveLength(0); expect(enemyMaxChakra(e)).toBeNull();
});
it("detects stale updates and archive requests without losing edits", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input()));
  await saveEnemyTemplate(campaignId, id, form(input({ name: "Saved new value" }), 1));
  await expect(saveEnemyTemplate(campaignId, id, form(input({ name: "Stale value" }), 1))).rejects.toThrow("inzwischen");
  await expect(archiveEnemyTemplate(campaignId, id, true, 1)).rejects.toThrow();
  expect((await read(id)).name).toBe("Saved new value");
});
it("archives and restores own templates without deleting their statblocks", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input()));
  await archiveEnemyTemplate(campaignId, id, true, 1);
  expect((await listEnemyTemplates(campaignId)).some(e => e.id === id)).toBe(false);
  expect((await listEnemyTemplates(campaignId, { archived: "true" })).some(e => e.id === id)).toBe(true);
  expect((await read(id)).maxHp).toBe(input().maxHp);
  await archiveEnemyTemplate(campaignId, id, false, 2);
  expect((await read(id)).archived).toBe(false);
});
it("copies global templates into isolated campaign data and reseeding never overwrites copies", async () => {
  await seedBestiary(database.client);
  const global = await database.client.enemyTemplate.findUniqueOrThrow({ where: { seedKey: "bestiary:v1:genin" } });
  const globalBefore = await read(global.id);
  const copyId = await duplicateEnemyTemplate(campaignId, global.id);
  const copy = await read(copyId);
  expect(copy).toMatchObject({ campaignId, seedKey: null, sourceTemplateId: global.id, version: 1 });
  expect(copy.jutsuLinks.map(l => l.jutsuId).sort()).toEqual(globalBefore.jutsuLinks.map(l => l.jutsuId).sort());
  const custom = input({ ...enemyTemplateSeeds[11].data, name: "Campaign-only Genin", maxHp: 99, natureIds: [water], jutsuIds: [waterJutsu] });
  await saveEnemyTemplate(campaignId, copyId, form(custom, 1));
  await seedBestiary(database.client);
  expect((await read(copyId)).maxHp).toBe(99); expect(await read(global.id)).toEqual(globalBefore);
});
it("supports duplicating one's own archived template into a fresh active template", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input()));
  await archiveEnemyTemplate(campaignId, id, true, 1);
  const copy = await read(await duplicateEnemyTemplate(campaignId, id));
  expect(copy.id).not.toBe(id); expect(copy.archived).toBe(false); expect(copy.version).toBe(1); expect(copy.seedKey).toBeNull();
});
it("denies modifying or archiving global templates", async () => {
  const global = await database.client.enemyTemplate.findUniqueOrThrow({ where: { seedKey: "bestiary:v1:cat" } });
  await expect(saveEnemyTemplate(campaignId, global.id, form(input(), global.version))).rejects.toThrow("eigene");
  await expect(archiveEnemyTemplate(campaignId, global.id, true, global.version)).rejects.toThrow();
  await expect(Edit({ params: Promise.resolve({ campaignId, templateId: global.id }) })).rejects.toThrow("NOT_FOUND");
});
it("prevents foreign campaign reads, modifications, archive and duplication", async () => {
  const foreign = await database.client.enemyTemplate.create({ data: { campaignId: foreignId, ...enemyTemplateSeeds[6].data, name: "FOREIGN_SECRET" } });
  expect(await getEnemyTemplate(campaignId, foreign.id)).toBeNull();
  expect((await listEnemyTemplates(campaignId)).some(e => e.id === foreign.id)).toBe(false);
  await expect(saveEnemyTemplate(campaignId, foreign.id, form(input()))).rejects.toThrow();
  await expect(duplicateEnemyTemplate(campaignId, foreign.id)).rejects.toThrow();
  await expect(archiveEnemyTemplate(campaignId, foreign.id, true, 1)).rejects.toThrow();
  await expect(Detail({ params: Promise.resolve({ campaignId, templateId: foreign.id }) })).rejects.toThrow("NOT_FOUND");
  expect(output(await Bestiary({ params: Promise.resolve({ campaignId }), searchParams: Promise.resolve({}) }))).not.toContain("FOREIGN_SECRET");
});
it("rejects players before any library read or mutation, including direct builder routes", async () => {
  requireCampaign.mockRejectedValue(new Error("Unauthorized"));
  const operations = [
    () => listEnemyTemplates(campaignId), () => getEnemyTemplate(campaignId, "id"), () => enemyBuilderOptions(campaignId),
    () => saveEnemyTemplate(campaignId, null, form(input())), () => duplicateEnemyTemplate(campaignId, "id"), () => archiveEnemyTemplate(campaignId, "id", true, 1),
    () => Detail({ params: Promise.resolve({ campaignId, templateId: "id" }) }), () => Edit({ params: Promise.resolve({ campaignId, templateId: "id" }) }),
    () => NewEnemy({ params: Promise.resolve({ campaignId }) }), () => Bestiary({ params: Promise.resolve({ campaignId }), searchParams: Promise.resolve({}) }),
  ];
  for (const operation of operations) await expect(operation()).rejects.toThrow("Unauthorized");
  expect(requireCampaign.mock.calls.every(call => call[1] === true)).toBe(true);
});
it("enforces campaign access even for globally readable seed IDs", async () => {
  await expect(listEnemyTemplates(foreignId)).rejects.toThrow("Unauthorized");
  await expect(getEnemyTemplate(foreignId, "id")).rejects.toThrow("Unauthorized");
});
it("filters by text, category, independent difficulty, rank, scope and archive", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input({ name: "Unique wolf filter", category: "ANIMAL", difficulty: "ELITE", ninjaRank: null })));
  expect((await listEnemyTemplates(campaignId, { q: "wolf filter", category: "ANIMAL", difficulty: "ELITE", rank: "none", scope: "campaign" })).map(e => e.id)).toEqual([id]);
  expect(await listEnemyTemplates(campaignId, { q: "wolf filter", scope: "global" })).toEqual([]);
  expect(await listEnemyTemplates(campaignId, { q: "wolf filter", rank: "GENIN" })).toEqual([]);
  expect(await listEnemyTemplates(campaignId, { q: "wolf filter", category: "SHINOBI" })).toEqual([]);
});
it("builder options include global and own Jutsu but no foreign Jutsu", async () => {
  const own = await database.client.jutsu.create({ data: { campaignId, name: "Own", slug: "own", rank: "D", chakraCost: 1, description: "Own", range: "Self", duration: "Instant", actionType: "Action" } });
  const options = await enemyBuilderOptions(campaignId);
  expect(options.jutsu.map(j => j.id)).toContain(waterJutsu); expect(options.jutsu.map(j => j.id)).toContain(own.id); expect(options.jutsu.map(j => j.id)).not.toContain(foreignJutsu);
  await saveEnemyTemplate(campaignId, null, form(input({ hasChakra: true, jutsuIds: [own.id] })));
});
it("detached blueprints carry source versions, resolved rules and independent nested values", async () => {
  const id = await saveEnemyTemplate(campaignId, null, form(input({ hasChakra: true, jutsuIds: [waterJutsu], natureIds: [water], skills: [{ skill: "Stealth", proficiency: "EXPERTISE" }], savingThrows: ["DEX"] })));
  const template = await read(id), a = enemyBlueprint(template), b = enemyBlueprint(template);
  expect(a).toMatchObject({ templateId: id, templateVersion: 1, schemaVersion: 1 });
  a.jutsu[0].name = "MUTATED INSTANCE";
  (a.attacks as { name: string }[])[0].name = "MUTATED ATTACK";
  expect(b.jutsu[0].name).not.toBe(a.jutsu[0].name); expect(template.jutsuLinks[0].jutsu.name).not.toBe(a.jutsu[0].name);
  expect((await read(id)).attacks).toEqual(input().attacks);
  expect(a).not.toHaveProperty("currentHp"); expect(a).not.toHaveProperty("conditions");
});
it("rejects form smuggling, invalid JSON, duplicate selections and noninteger versions", async () => {
  const smuggled = form(input()); smuggled.append("name", "spoof"); expect(() => parseEnemyForm(smuggled)).toThrow();
  const malformed = form(input()); malformed.set("attacks", "not-json"); await expect(saveEnemyTemplate(campaignId, null, malformed)).rejects.toThrow();
  const duplicate = form(input({ hasChakra: true, natureIds: [water, water] })); await expect(saveEnemyTemplate(campaignId, null, duplicate)).rejects.toThrow();
  const id = await saveEnemyTemplate(campaignId, null, form(input()));
  const stale = form(input()); stale.set("version", "1.5"); await expect(saveEnemyTemplate(campaignId, id, stale)).rejects.toThrow();
});
it.each([
  { maxHp: 0 }, { maxHp: -1 }, { maxHp: 1.5 }, { level: 0 }, { level: 21 }, { dex: 31 }, { dex: 0 }, { speed: -1 },
  { acOverride: -1 }, { initiativeOverride: Number.NaN }, { recommendedLevelMin: 5, recommendedLevelMax: 2 },
  { hasChakra: false, maxChakraOverride: 50 }, { hasChakra: false, jutsuIds: ["id"] },
  { hasChakra: true, reservoir: "SPECIAL", customReservoirMultiplier: null }, { hasChakra: true, customReservoirMultiplier: 2 },
  { attacks: [] }, { attacks: [{ name: "Bad", bonus: 0, damageDice: "99999d999", damageType: "Stich", range: "5 ft", description: "" }] },
  { skills: [{ skill: "Fake", proficiency: "EXPERTISE" }] }, { savingThrows: ["STR", "STR"] },
])("rejects invalid statblock %#", async patch => {
  const fd = form({ ...input(), ...patch } as EnemyTemplateInput);
  await expect(saveEnemyTemplate(campaignId, null, fd)).rejects.toThrow();
});
