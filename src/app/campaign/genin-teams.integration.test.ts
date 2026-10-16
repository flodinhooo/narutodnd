import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
const { database, getSession, requireCampaign } = vi.hoisted(() => ({ database: { client: null as unknown as PrismaClient }, getSession: vi.fn(), requireCampaign: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return database.client; } }));
vi.mock("@/lib/session", () => ({ getSession, requireCampaign }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { loreBundleSchema, loreEntityId } from "@/lib/lore-bundle";
import { importSelectedLore } from "@/lib/lore-importer";
import { calculateMaxChakra } from "@/lib/rules";
import { snapshotPlan } from "@/lib/encounter-snapshots";
import { atlasLocationDetail } from "@/lib/atlas-location";
import { setOrganizationMember } from "./people-actions";
import Library from "./[campaignId]/jutsu-library/page";
import JutsuDetail from "./[campaignId]/jutsu-library/[slug]/page";
import Sheet from "./[campaignId]/characters/[characterId]/page";
import { isStartingJutsuAllowed } from "@/lib/character-creation";
import { SHIO_ATLAS_KEY } from "../../../seeding/world-atlas";

const source = { path: "Fixture/Teams.md", sha: "a".repeat(40) };
function packet() {
  return loreBundleSchema.parse({ format: 1, key: "team-fixture:v1", revision: "b".repeat(40), teamStructure: "THREE_NPC_ONE_PLAYER",
    npcs: Array.from({ length: 12 }, (_, i) => ({ key: `person-${i}`, name: `Fixture Person ${i}`, category: "SHINOBI", status: "CONFIRMED", ninjaRank: i % 4 === 0 ? "JONIN" : "GENIN", sources: [source],
      ...(i % 4 === 0 ? { locationKey: "reigan", combat: { status: "DRAFT", assumptions: "All numerical fixture values are explicit DM drafts.", level: 10, str: 12, dex: 16, con: 14, int: 15, wis: 17, cha: 12, hitDie: "d10", reservoir: "SPECIAL", customReservoirMultiplier: 1.25, controlRank: "EXPERT", regenRank: "ADVANCED", speed: 30, hpOverride: 77, natureKeys: ["WATER"], jutsuSlugs: ["fixture-basic", `fixture-signature-${i}`], skills: [{ skill: "Perception", proficiency: "EXPERTISE" }], savingThrows: ["DEX", "WIS"], features: "Fixture defensive feature; stored outside editable DM notes." } } : {}),
      identities: [{ bundleKey: "previous-fixture:v1", key: `person-${i}` }],
    })),
    organizations: Array.from({ length: 4 }, (_, i) => ({ key: `team-${i + 1}`, name: `Fixture Team ${i + 1}`, type: "TEAM", status: "CONFIRMED", sources: [source], identities: [{ bundleKey: "previous-fixture:v1", key: `team-${i + 1}` }],
      description: i === 3 ? "PLAYER TEAM – Reserved / Awaiting Character Creation" : "Documented team", reservedPlayerTeam: i === 3,
      members: i === 3 ? [] : Array.from({ length: 4 }, (_, j) => ({ npcKey: `person-${i * 4 + j}`, isLeader: j === 0, role: j === 0 ? "Sensei" : "Genin" })),
    })),
    relationships: [0, 4, 8].flatMap(i => [1, 2, 3].map(j => ({ key: `mentor-${i}-${j}`, sourceKey: `person-${i}`, targetKey: `person-${i + j}`, type: "MENTOR", description: "Documented mentorship", sources: [source] }))),
    jutsu: [0, 4, 8].map(i => ({ key: `signature-${i}`, slug: `fixture-signature-${i}`, name: `Fixture Signature ${i}`, aliases: [`Fixture Signāture ${i}`], description: "PRIVATE_TECHNIQUE", rank: "A", category: "SIGNATURE", pool: "CHARACTER_SIGNATURE", status: "DRAFT", assumptions: "Proposed cost and save mechanic require DM confirmation.", chakraCost: 30, range: "30 ft", duration: "1 round", actionType: "Action", natureKeys: ["WATER"], prerequisiteSlugs: ["fixture-basic"], allowedNpcKeys: [`person-${i}`], sources: [source] })),
  });
}
const selection = (b = packet()) => ({ npcs: b.npcs.map(n => n.key), organizations: b.organizations.map(o => o.key), relationships: b.relationships.map(r => r.key), combat: b.npcs.filter(n => n.combat).map(n => n.key), missions: [], jutsu: b.jutsu.map(j => j.key), approveDrafts: true, approveCombat: true, includeJutsu: true });
let directory: string, campaignId: string, foreignId: string;
const db = () => database.client;
const output = (value: unknown) => JSON.stringify(value, (key, item) => key === "type" || key === "_owner" ? undefined : item);
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "genin-teams-tests-")); database.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  for (const name of (await readdir("prisma/migrations")).filter(n => /^\d/.test(n)).sort()) {
    const sql = (await readFile(join("prisma/migrations", name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, "");
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db().$executeRawUnsafe(statement);
  }
  await db().chakraNature.create({ data: { key: "WATER", displayName: "Water", description: "", playerSelectable: true } });
  await db().jutsu.create({ data: { slug: "fixture-basic", name: "Fixture Basic", description: "Public", rank: "D", chakraCost: 5, range: "Self", duration: "Instant", actionType: "Action" } });
}, 30000);
beforeEach(async () => {
  const token = crypto.randomUUID(); campaignId = (await db().campaign.create({ data: { name: "Fixture", dmCodeHash: token, playerCodeHash: token + "-player", jutsuLibraryAccess: "OPEN" } })).id;
  foreignId = (await db().campaign.create({ data: { name: "Foreign", dmCodeHash: token + "foreign", playerCodeHash: token + "foreign-player" } })).id;
  const location = await db().location.create({ data: { campaignId, slug: "reigan", name: "Reigan" } });
  await db().atlasLocationSeed.create({ data: { campaignId, seedKey: `${SHIO_ATLAS_KEY}:location:reigan`, locationId: location.id } });
  getSession.mockResolvedValue({ campaignId, role: "DM" }); requireCampaign.mockImplementation(async (id: string, dm?: boolean) => { const actor = await getSession(); if (actor.campaignId !== id || (dm && actor.role !== "DM")) throw new Error("Unauthorized"); return actor; });
});
afterAll(async () => {
  await db()?.$disconnect(); if (directory) { const target = resolve(directory); if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("genin-teams-tests-")) throw new Error("Unsafe cleanup"); await rm(target, { recursive: true, force: true }); }
});
it("validates three complete NPC teams and an empty reserved player team", () => {
  expect(packet().organizations.map(o => o.members.length)).toEqual([4, 4, 4, 0]);
  for (const mutate of [
    (b: ReturnType<typeof packet>) => b.organizations[3].members.push(b.organizations[0].members[0]),
    (b: ReturnType<typeof packet>) => { b.organizations[1].members[1].npcKey = "person-1"; },
    (b: ReturnType<typeof packet>) => { b.organizations[0].members[0].isLeader = false; },
    (b: ReturnType<typeof packet>) => b.organizations.pop(),
  ]) { const b = packet(); mutate(b); expect(loreBundleSchema.safeParse(b).success).toBe(false); }
});
it("rejects duplicate aliases and cyclic prerequisites", () => {
  const b = packet(); b.jutsu[1].aliases.push(b.jutsu[0].name); expect(loreBundleSchema.safeParse(b).success).toBe(false);
  const c = packet(); c.jutsu[0].prerequisiteSlugs = [c.jutsu[1].slug]; c.jutsu[1].prerequisiteSlugs = [c.jutsu[0].slug]; expect(loreBundleSchema.safeParse(c).success).toBe(false);
});
it("requires separate approval for drafts and combat profiles", async () => {
  await expect(importSelectedLore(db(), campaignId, packet(), { ...selection(), approveCombat: false })).rejects.toThrow("Kampfprofile");
  await expect(importSelectedLore(db(), campaignId, packet(), { ...selection(), approveDrafts: false })).rejects.toThrow("Entwürfe");
  expect(await db().npc.count({ where: { campaignId } })).toBe(0);
});
it("resolves stable identities despite renamed NPCs and upgrades an existing empty team", async () => {
  const personId = loreEntityId(campaignId, "previous-fixture:v1", "npc", "person-1"), teamId = loreEntityId(campaignId, "previous-fixture:v1", "organization", "team-1");
  await db().npc.create({ data: { id: personId, campaignId, name: "Manual renamed student", dmSecrets: "Manual note" } });
  await db().organization.create({ data: { id: teamId, campaignId, name: "Manual team name", type: "TEAM" } });
  const preview = await importSelectedLore(db(), campaignId, packet(), selection()); expect(preview.conflicts).toEqual([]); expect(preview.createNpcs).toBe(11); expect(preview.createOrganizations).toBe(3);
  await importSelectedLore(db(), campaignId, packet(), selection(), true, preview.fingerprint);
  expect(await db().npc.findUnique({ where: { id: personId } })).toMatchObject({ name: "Manual renamed student", dmSecrets: "Manual note" });
  expect(await db().organization.count({ where: { campaignId } })).toBe(4); expect(await db().organizationMember.count({ where: { organizationId: teamId } })).toBe(4);
});
it("reports ambiguous identities and name collisions instead of creating duplicates", async () => {
  const b = packet();
  for (const bundleKey of [b.key, "previous-fixture:v1"]) await db().npc.create({ data: { id: loreEntityId(campaignId, bundleKey, "npc", "person-0"), campaignId, name: bundleKey } });
  expect((await importSelectedLore(db(), campaignId, b, selection())).conflicts.some(c => c.includes("Identitäten"))).toBe(true);
  await db().npc.create({ data: { campaignId, name: "Fixture Person 2" } });
  await expect(importSelectedLore(db(), campaignId, b, selection(), true)).rejects.toThrow("Importkonflikte"); expect(await db().jutsu.count({ where: { campaignId } })).toBe(0);
});
it("preflights individual, clan, nature and learned prerequisites atomically", async () => {
  for (const mutate of [
    (b: ReturnType<typeof packet>) => { b.jutsu[0].allowedNpcKeys = ["person-4"]; },
    (b: ReturnType<typeof packet>) => { b.jutsu[0].requiredClan = "FixtureClan"; },
    (b: ReturnType<typeof packet>) => { b.npcs[0].combat!.natureKeys = []; },
    (b: ReturnType<typeof packet>) => { b.npcs[0].combat!.jutsuSlugs = [b.jutsu[0].slug]; },
  ]) { const b = packet(); mutate(b); const plan = await importSelectedLore(db(), campaignId, b, selection(b)); expect(plan.conflicts.length).toBeGreaterThan(0); await expect(importSelectedLore(db(), campaignId, b, selection(b), true)).rejects.toThrow("Importkonflikte"); }
  expect(await db().npc.count({ where: { campaignId } })).toBe(0);
});
it("accepts explicit clan-bound Hiden assignments and protects an edited existing clan", async () => {
  const b = packet(); b.jutsu[0].category = "HIDEN"; b.jutsu[0].requiredClan = "FixtureClan"; b.npcs[0].clan = "FixtureClan";
  await importSelectedLore(db(), campaignId, b, selection(b), true);
  const npc = await db().npc.findFirstOrThrow({ where: { campaignId, name: b.npcs[0].name } });
  expect(await db().characterJutsu.count({ where: { characterId: npc.characterId! } })).toBe(2);
  await db().npc.update({ where: { id: npc.id }, data: { clan: "Different manual clan" } });
  expect((await importSelectedLore(db(), campaignId, b, selection(b))).conflicts.some(c => c.includes("Clan-Voraussetzung"))).toBe(true);
});
it("adds explicitly selected techniques to existing sheets without resetting their combat values", async () => {
  const b = packet(); await importSelectedLore(db(), campaignId, b, { ...selection(b), jutsu: [], includeJutsu: false }, true);
  const npc = await db().npc.findFirstOrThrow({ where: { campaignId, name: b.npcs[0].name } });
  await db().character.update({ where: { id: npc.characterId! }, data: { level: 12, maxHp: 123, currentHp: 4 } });
  await importSelectedLore(db(), campaignId, b, selection(b), true);
  expect(await db().character.count({ where: { campaignId } })).toBe(3);
  expect(await db().character.findUnique({ where: { id: npc.characterId! } })).toMatchObject({ level: 12, maxHp: 123, currentHp: 4 });
  expect(await db().characterJutsu.count({ where: { characterId: npc.characterId! } })).toBe(2);
});
it("rejects stale preview and preserves all edits across repeated imports", async () => {
  const b = packet(), plan = await importSelectedLore(db(), campaignId, b, selection()); expect(plan.createJutsu).toBe(3); expect(await db().npc.count({ where: { campaignId } })).toBe(0);
  await importSelectedLore(db(), campaignId, b, selection(), true, plan.fingerprint);
  const oldPlan = await importSelectedLore(db(), campaignId, b, selection());
  const npc = await db().npc.findFirstOrThrow({ where: { campaignId, name: "Fixture Person 0" } });
  await db().character.update({ where: { id: npc.characterId! }, data: { currentHp: 1, wis: 19 } });
  await expect(importSelectedLore(db(), campaignId, b, selection(), true, oldPlan.fingerprint)).rejects.toThrow("veraltet");
  const before = await db().character.findMany({ where: { campaignId }, orderBy: { id: "asc" } });
  const result = await importSelectedLore(db(), campaignId, b, selection(), true); expect(result.createNpcs + result.createOrganizations + result.createJutsu + result.createJutsuAssignments + result.createCharacters).toBe(0);
  expect(await db().character.findMany({ where: { campaignId }, orderBy: { id: "asc" } })).toEqual(before);
  expect(await db().npc.count({ where: { campaignId } })).toBe(12); expect(await db().character.count({ where: { campaignId } })).toBe(3);
  expect(await db().npc.count({ where: { campaignId: foreignId } })).toBe(0); expect(await db().jutsu.count({ where: { campaignId: null } })).toBe(1);
});
it("uses private existing aliases without duplicating or resetting the library", async () => {
  const b = packet(); const j = b.jutsu[0];
  const existing = await db().jutsu.create({ data: { campaignId, slug: "manual-variant", name: j.aliases[0], description: "Manual mechanic", rank: "A", chakraCost: 99, range: "Self", duration: "Instant", actionType: "Action", dmOnly: true } });
  await importSelectedLore(db(), campaignId, b, selection(), true);
  expect(await db().jutsu.count({ where: { campaignId } })).toBe(3); expect(await db().jutsu.findUnique({ where: { id: existing.id } })).toMatchObject({ description: "Manual mechanic", chakraCost: 99 });
});
it("stores combat features, snapshots Jutsu and shows atlas links only to allowed roles", async () => {
  await importSelectedLore(db(), campaignId, packet(), selection(), true);
  const n = await db().npc.findFirstOrThrow({ where: { campaignId, name: "Fixture Person 0" }, include: { character: true } });
  expect(n.character!.maxHp).toBe(77); expect(n.character!.currentChakra).toBe(calculateMaxChakra(10, 14, 17, "SPECIAL", 1.25));
  await db().characterDMData.update({ where: { characterId: n.characterId! }, data: { notes: "Ordinary edited note" } });
  const encounter = await db().encounter.create({ data: { campaignId, name: "Fixture encounter" } }); const plan = await db().encounterParticipantPlan.create({ data: { encounterId: encounter.id, npcId: n.id } });
  const { snapshot } = await snapshotPlan(db(), campaignId, plan); expect(snapshot.abilities[0].description).toContain("outside editable"); expect(snapshot.jutsu).toHaveLength(2);
  expect((await atlasLocationDetail(campaignId, n.locationId!))!.npcs.map(n => n.id)).toContain(n.id);
  getSession.mockResolvedValue({ campaignId, role: "PLAYER" }); expect((await atlasLocationDetail(campaignId, n.locationId!))!.npcs).toHaveLength(0);
});
it("hides private techniques from an open library, detail pages, sheets and character creation", async () => {
  await importSelectedLore(db(), campaignId, packet(), selection(), true);
  getSession.mockResolvedValue({ campaignId, role: "PLAYER" });
  const library = await Library({ params: Promise.resolve({ campaignId }), searchParams: Promise.resolve({}) }); expect(output(library)).not.toContain("PRIVATE_TECHNIQUE");
  await expect(JutsuDetail({ params: Promise.resolve({ campaignId, slug: "fixture-signature-0" }) })).rejects.toThrow("404");
  const n = await db().npc.findFirstOrThrow({ where: { campaignId, name: "Fixture Person 0" } }); await db().npc.update({ where: { id: n.id }, data: { playerVisible: true } });
  const sheet = await Sheet({ params: Promise.resolve({ campaignId, characterId: n.characterId! }) }); expect(output(sheet)).not.toContain("PRIVATE_TECHNIQUE");
  expect(isStartingJutsuAllowed({ dmOnly: true, rank: "D", campaignId, requiredNatureKeys: "[]", natures: [{ nature: { key: "WATER", playerSelectable: true } }] }, campaignId)).toBe(false);
});
it("leaves Team 4 empty and supports later explicit same-campaign PC and Sensei assignments", async () => {
  await importSelectedLore(db(), campaignId, packet(), selection(), true);
  const team = await db().organization.findFirstOrThrow({ where: { campaignId, name: "Fixture Team 4" }, include: { members: true } }); expect(team.members).toHaveLength(0); expect(team.notes).toContain("Awaiting Character Creation");
  const pc = await db().character.create({ data: { campaignId, name: "Later PC" } }), foreign = await db().character.create({ data: { campaignId: foreignId, name: "Foreign PC" } });
  const form = (person: string, leader = false) => { const f = new FormData(); f.set("person", person); f.set("role", leader ? "Sensei" : "Genin"); if (leader) f.set("isLeader", "on"); return f; };
  await expect(setOrganizationMember(campaignId, team.id, form(`character:${foreign.id}`))).rejects.toThrow();
  getSession.mockResolvedValue({ campaignId, role: "PLAYER" }); await expect(setOrganizationMember(campaignId, team.id, form(`character:${pc.id}`))).rejects.toThrow("Unauthorized");
  getSession.mockResolvedValue({ campaignId, role: "DM" }); await setOrganizationMember(campaignId, team.id, form(`character:${pc.id}`)); await setOrganizationMember(campaignId, team.id, form(`character:${pc.id}`));
  const sensei = await db().npc.create({ data: { campaignId, name: "Later documented Sensei" } }); await setOrganizationMember(campaignId, team.id, form(`npc:${sensei.id}`, true));
  await importSelectedLore(db(), campaignId, packet(), selection(), true);
  expect(await db().organizationMember.count({ where: { organizationId: team.id } })).toBe(2);
});
