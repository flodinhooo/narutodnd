import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { calculateMaxChakra, calculateMaxHp } from "@/lib/rules";
import { characterVisibility, npcSchema, parsePeopleForm } from "@/lib/campaign-people";

const { database, requireCampaign, getSession, revalidatePath } = vi.hoisted(() => ({
  database: { client: null as unknown as PrismaClient }, requireCampaign: vi.fn(), getSession: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return database.client; } }));
vi.mock("@/lib/session", () => ({ requireCampaign, getSession }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: vi.fn() }));
import { archiveNpc, deleteNpc, enableNpcCombat, saveNpc, saveOrganization, setOrganizationMember, removeOrganizationMember, saveRelationship, deleteRelationship, archiveOrganization } from "./people-actions";
import NpcDetail from "./[campaignId]/npcs/[npcId]/page";
import OrganizationDetail from "./[campaignId]/organizations/[organizationId]/page";
import Sheet from "./[campaignId]/characters/[characterId]/page";
import Campaign from "./[campaignId]/page";
import Characters from "./[campaignId]/characters/page";
import Relationships from "./[campaignId]/organizations/relationships/page";
import { updateCharacter } from "../dm-actions";

let directory: string, campaignId: string, foreignId: string;
const fd = (data: Record<string, string>) => { const form = new FormData(); for (const [key, value] of Object.entries(data)) form.set(key, value); return form; };
const npcForm = (extra: Record<string, string> = {}) => fd({ name: "Mika", category: "CIVILIAN", attitude: "HOSTILE", description: "Öffentlich", background: "PRIVATE_BACKGROUND", personality: "PRIVATE_PERSONALITY", dmSecrets: "NPC_SECRET", ...extra });
const organizationForm = (extra: Record<string, string> = {}) => fd({ name: "Team 8", type: "TEAM", dmSecrets: "ORG_SECRET", notes: "PRIVATE_TEAM_NOTES", ...extra });
const output = (value: unknown) => JSON.stringify(value, (key, item) => key === "type" || key === "_owner" ? undefined : item);
const asPlayer = () => { const s = { campaignId, role: "PLAYER" }; getSession.mockResolvedValue(s); requireCampaign.mockImplementation(async (id: string, dm?: boolean) => { if (id !== campaignId || dm) throw new Error("Unauthorized"); return s; }); };

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "narutodnd-people-tests-"));
  database.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  const migrations = join(process.cwd(), "prisma/migrations");
  for (const name of (await readdir(migrations)).filter(n => /^\d/.test(n)).sort()) {
    const sql = (await readFile(join(migrations, name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, "");
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await database.client.$executeRawUnsafe(statement);
  }
  campaignId = (await database.client.campaign.create({ data: { name: "Test", dmCodeHash: "dm", playerCodeHash: "player" } })).id;
  foreignId = (await database.client.campaign.create({ data: { name: "Foreign", dmCodeHash: "foreign-dm", playerCodeHash: "foreign-player" } })).id;
}, 30000);
beforeEach(() => {
  vi.clearAllMocks();
  const s = { campaignId, role: "DM" };
  getSession.mockResolvedValue(s);
  requireCampaign.mockImplementation(async (id: string) => { if (id !== campaignId) throw new Error("Unauthorized"); return s; });
});
afterAll(async () => {
  await database.client?.$disconnect();
  if (directory) {
    const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("narutodnd-people-tests-")) throw new Error("Unexpected cleanup path");
    await rm(target, { recursive: true, force: true });
  }
});

it("persists a hostile civilian without allocating chakra, jutsu or a character", async () => {
  const id = await saveNpc(campaignId, null, npcForm());
  const n = await database.client.npc.findUniqueOrThrow({ where: { id } });
  expect(n).toMatchObject({ name: "Mika", attitude: "HOSTILE", category: "CIVILIAN", age: null, characterId: null, playerVisible: false });
  expect(requireCampaign).toHaveBeenCalledWith(campaignId, true);
});
it("persists edits and validates age, category and portrait protocols", async () => {
  const id = await saveNpc(campaignId, null, npcForm());
  await saveNpc(campaignId, id, npcForm({ name: "Mika II", age: "42", playerVisible: "on" }));
  expect(await database.client.npc.findUnique({ where: { id } })).toMatchObject({ name: "Mika II", age: 42, playerVisible: true });
  const invalidInputs: Record<string, string>[] = [{ age: "-1" }, { age: "3.5" }, { category: "BAD" }, { portraitUrl: "javascript:alert(1)" }];
  for (const invalid of invalidInputs) await expect(saveNpc(campaignId, id, npcForm(invalid))).rejects.toThrow();
  const duplicate = npcForm(); duplicate.append("name", "spoof");
  expect(() => parsePeopleForm(npcSchema, duplicate)).toThrow();
});
it("prevents foreign NPC updates and location references", async () => {
  const n = await database.client.npc.create({ data: { campaignId: foreignId, name: "Foreign NPC" } });
  const l = await database.client.location.create({ data: { campaignId: foreignId, name: "Foreign", slug: "foreign" } });
  await expect(saveNpc(campaignId, n.id, npcForm())).rejects.toThrow();
  await expect(saveNpc(campaignId, null, npcForm({ locationId: l.id }))).rejects.toThrow();
  await expect(saveOrganization(campaignId, null, organizationForm({ locationId: l.id }))).rejects.toThrow();
});
it("promotes an NPC without changing identity, memberships or relationships; repeated promotion is harmless", async () => {
  const id = await saveNpc(campaignId, null, npcForm()), target = await saveNpc(campaignId, null, npcForm({ name: "Sensei" }));
  const org = await saveOrganization(campaignId, null, organizationForm());
  await setOrganizationMember(campaignId, org, fd({ person: `npc:${id}`, role: "Schüler" }));
  await saveRelationship(campaignId, fd({ source: `npc:${id}`, target: `npc:${target}`, type: "STUDENT" }));
  await enableNpcCombat(campaignId, id, new FormData());
  const first = await database.client.npc.findUniqueOrThrow({ where: { id } });
  await enableNpcCombat(campaignId, id, new FormData());
  const promoted = await database.client.npc.findUniqueOrThrow({ where: { id }, include: { character: true, memberships: true, outgoingRelationships: true } });
  expect(promoted.characterId).toBe(first.characterId);
  expect(promoted.memberships).toHaveLength(1); expect(promoted.outgoingRelationships).toHaveLength(1);
  expect(promoted.character).toMatchObject({ maxHp: calculateMaxHp(1, 10), currentChakra: calculateMaxChakra(1, 10, 10, "AVERAGE") });
});
it("links an existing same-campaign character and rejects foreign or already-linked characters", async () => {
  const c = await database.client.character.create({ data: { campaignId, name: "Existing" } });
  const other = await database.client.character.create({ data: { campaignId: foreignId, name: "Foreign" } });
  const id = await saveNpc(campaignId, null, npcForm());
  await expect(enableNpcCombat(campaignId, id, fd({ characterId: other.id }))).rejects.toThrow();
  await enableNpcCombat(campaignId, id, fd({ characterId: c.id }));
  expect((await database.client.npc.findUniqueOrThrow({ where: { id } })).characterId).toBe(c.id);
  const second = await saveNpc(campaignId, null, npcForm());
  await expect(enableNpcCombat(campaignId, second, fd({ characterId: c.id }))).rejects.toThrow();
});
it("supports multiple organisations, arbitrary team sizes and membership updates without duplicates", async () => {
  const org = await saveOrganization(campaignId, null, organizationForm()), clan = await saveOrganization(campaignId, null, organizationForm({ type: "CLAN", name: "Clan" }));
  for (let i = 0; i < 6; i++) {
    const id = await saveNpc(campaignId, null, npcForm({ name: `Member ${i}` }));
    await setOrganizationMember(campaignId, org, fd({ person: `npc:${id}`, role: "Schüler" }));
    await setOrganizationMember(campaignId, org, fd({ person: `npc:${id}`, role: "Sensei", isLeader: "on" }));
    await setOrganizationMember(campaignId, clan, fd({ person: `npc:${id}`, role: "Mitglied" }));
  }
  expect(await database.client.organizationMember.count({ where: { organizationId: org } })).toBe(6);
  expect(await database.client.organizationMember.count({ where: { organizationId: org, role: "Sensei", isLeader: true } })).toBe(6);
  const member = await database.client.organizationMember.findFirstOrThrow({ where: { organizationId: org } });
  await removeOrganizationMember(campaignId, clan, member.id);
  expect(await database.client.organizationMember.findUnique({ where: { id: member.id } })).not.toBeNull();
  await removeOrganizationMember(campaignId, org, member.id);
  expect(await database.client.organizationMember.findUnique({ where: { id: member.id } })).toBeNull();
});
it("validates foreign membership and relationship endpoints, self-relations and archived organisations", async () => {
  const org = await saveOrganization(campaignId, null, organizationForm());
  const id = await saveNpc(campaignId, null, npcForm());
  const foreign = await database.client.npc.create({ data: { campaignId: foreignId, name: "Foreign" } });
  await expect(setOrganizationMember(campaignId, org, fd({ person: `npc:${foreign.id}` }))).rejects.toThrow();
  await expect(saveRelationship(campaignId, fd({ source: `npc:${id}`, target: `npc:${foreign.id}`, type: "ENEMY" }))).rejects.toThrow();
  await expect(saveRelationship(campaignId, fd({ source: `npc:${id}`, target: `npc:${id}`, type: "FRIEND" }))).rejects.toThrow();
  await archiveOrganization(campaignId, org, true);
  await expect(setOrganizationMember(campaignId, org, fd({ person: `npc:${id}` }))).rejects.toThrow();
});
it("persists relationship direction, updates details and supports removal", async () => {
  const source = await saveNpc(campaignId, null, npcForm()), target = await saveNpc(campaignId, null, npcForm());
  const data = { source: `npc:${source}`, target: `npc:${target}`, type: "MENTOR", description: "Mentor" };
  await saveRelationship(campaignId, fd(data)); await saveRelationship(campaignId, fd({ ...data, description: "Updated", dmSecrets: "secret" }));
  const relationships = await database.client.characterRelationship.findMany({ where: { sourceNpcId: source, targetNpcId: target } });
  expect(relationships).toHaveLength(1); expect(relationships[0].description).toBe("Updated");
  expect(await database.client.characterRelationship.count({ where: { sourceNpcId: target, targetNpcId: source } })).toBe(0);
  await deleteRelationship(campaignId, relationships[0].id);
  expect(await database.client.characterRelationship.findUnique({ where: { id: relationships[0].id } })).toBeNull();
});
it("requires archive and exact name confirmation; preserves linked combat sheets", async () => {
  const id = await saveNpc(campaignId, null, npcForm());
  await expect(deleteNpc(campaignId, id, fd({ confirmation: "Mika" }))).rejects.toThrow();
  await archiveNpc(campaignId, id, true);
  await expect(deleteNpc(campaignId, id, fd({ confirmation: "wrong" }))).rejects.toThrow();
  await deleteNpc(campaignId, id, fd({ confirmation: "Mika" }));
  expect(await database.client.npc.findUnique({ where: { id } })).toBeNull();
  const linked = await saveNpc(campaignId, null, npcForm());
  await enableNpcCombat(campaignId, linked, new FormData()); await archiveNpc(campaignId, linked, true);
  await expect(deleteNpc(campaignId, linked, fd({ confirmation: "Mika" }))).rejects.toThrow();
});
it("excludes DM secrets, background, personality, hidden organisations and members from player output", async () => {
  const id = await saveNpc(campaignId, null, npcForm({ playerVisible: "on" }));
  const org = await saveOrganization(campaignId, null, organizationForm({ playerVisible: "on" }));
  const hidden = await saveNpc(campaignId, null, npcForm({ name: "HIDDEN_MEMBER" }));
  await setOrganizationMember(campaignId, org, fd({ person: `npc:${hidden}` }));
  await setOrganizationMember(campaignId, org, fd({ person: `npc:${id}` }));
  asPlayer();
  const npcOutput = output(await NpcDetail({ params: Promise.resolve({ campaignId, npcId: id }) }));
  const orgOutput = output(await OrganizationDetail({ params: Promise.resolve({ campaignId, organizationId: org }) }));
  for (const secret of ["NPC_SECRET", "PRIVATE_BACKGROUND", "PRIVATE_PERSONALITY"]) expect(npcOutput).not.toContain(secret);
  for (const secret of ["ORG_SECRET", "PRIVATE_TEAM_NOTES", "HIDDEN_MEMBER"]) expect(orgOutput).not.toContain(secret);
  expect(npcOutput).toContain("Öffentlich"); expect(orgOutput).toContain("Mika");
  await expect(NpcDetail({ params: Promise.resolve({ campaignId, npcId: hidden }) })).rejects.toThrow("NOT_FOUND");
});
it("protects direct sheet URLs and both existing rosters while retaining player characters", async () => {
  const hidden = await saveNpc(campaignId, null, npcForm({ name: "HIDDEN_COMBATANT" }));
  await enableNpcCombat(campaignId, hidden, new FormData());
  const n = await database.client.npc.findUniqueOrThrow({ where: { id: hidden } });
  const pc = await database.client.character.create({ data: { campaignId, name: "PUBLIC_PC" } });
  asPlayer();
  expect(output(await Sheet({ params: Promise.resolve({ campaignId, characterId: n.characterId! }) }))).not.toContain("HIDDEN_COMBATANT");
  for (const page of [Campaign, Characters]) {
    const rendered = output(await page({ params: Promise.resolve({ campaignId }) }));
    expect(rendered).not.toContain("HIDDEN_COMBATANT"); expect(rendered).toContain("PUBLIC_PC");
  }
  expect(await database.client.character.findFirst({ where: { id: pc.id, campaignId, ...characterVisibility(false) } })).not.toBeNull();
});
it("denies every new mutation to players and foreign campaign requests", async () => {
  asPlayer();
  const operations = [
    () => saveNpc(campaignId, null, npcForm()), () => archiveNpc(campaignId, "id", true), () => deleteNpc(campaignId, "id", new FormData()),
    () => enableNpcCombat(campaignId, "id", new FormData()), () => saveOrganization(campaignId, null, organizationForm()),
    () => archiveOrganization(campaignId, "id", true), () => setOrganizationMember(campaignId, "id", new FormData()),
    () => removeOrganizationMember(campaignId, "id", "member"), () => saveRelationship(campaignId, new FormData()), () => deleteRelationship(campaignId, "id"),
  ];
  for (const operation of operations) await expect(operation()).rejects.toThrow("Unauthorized");
  await expect(NpcDetail({ params: Promise.resolve({ campaignId: foreignId, npcId: "id" }) })).rejects.toThrow("Unauthorized");
});
it("finishes the additive migration chain without foreign key violations", async () => {
  expect(await database.client.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
});

it("keeps identity and sheet names in sync in both editors", async () => {
  const id = await saveNpc(campaignId, null, npcForm());
  await enableNpcCombat(campaignId, id, new FormData());
  const n = await database.client.npc.findUniqueOrThrow({ where: { id } });
  await saveNpc(campaignId, id, npcForm({ name: "Profile renamed" }));
  expect((await database.client.character.findUniqueOrThrow({ where: { id: n.characterId! } })).name).toBe("Profile renamed");
  await updateCharacter(campaignId, n.characterId!, fd({ name: "Sheet renamed" }));
  expect((await database.client.npc.findUniqueOrThrow({ where: { id } })).name).toBe("Sheet renamed");
});

it("shows a published relationship only while both endpoint identities are visible", async () => {
  const source = await saveNpc(campaignId, null, npcForm({ name: "Visible friend", playerVisible: "on" }));
  const target = await saveNpc(campaignId, null, npcForm({ name: "Secret rival" }));
  const pc = await database.client.character.create({ data: { campaignId, name: "Player ally" } });
  await saveRelationship(campaignId, fd({ source: `npc:${source}`, target: `npc:${target}`, type: "RIVAL", playerVisible: "on", dmSecrets: "RELATIONSHIP_SECRET" }));
  await saveRelationship(campaignId, fd({ source: `character:${pc.id}`, target: `npc:${source}`, type: "ALLY", description: "PUBLIC_RELATIONSHIP", playerVisible: "on", dmSecrets: "RELATIONSHIP_SECRET" }));
  asPlayer();
  const rendered = output(await Relationships({ params: Promise.resolve({ campaignId }) }));
  expect(rendered).toContain("PUBLIC_RELATIONSHIP");
  expect(rendered).not.toContain("Secret rival");
  expect(rendered).not.toContain("RELATIONSHIP_SECRET");
});

it("database rejects ambiguous membership identities even outside server actions", async () => {
  const org = await saveOrganization(campaignId, null, organizationForm());
  await expect(database.client.organizationMember.create({ data: { organizationId: org } })).rejects.toThrow();
});
