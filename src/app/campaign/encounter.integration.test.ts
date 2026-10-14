import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient, type EncounterRun } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { enemyTemplateSeeds } from "../../../seeding/enemy-templates";
import { combatSnapshotSchema, type CombatCommand, type RunView } from "@/lib/encounters";
import { calculateMaxChakra } from "@/lib/rules";

const { database, requireCampaign } = vi.hoisted(() => ({ database: { client: null as unknown as PrismaClient }, requireCampaign: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return database.client; } }));
vi.mock("@/lib/session", () => ({ requireCampaign }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: vi.fn() }));
import { saveEncounter, saveEncounterParticipant, removeEncounterParticipant, deleteEncounter, startEncounterRun } from "./encounter-actions";
import { performCombatAction, reloadEncounterRun } from "./combat-actions";
import { getEncounter, getEncounterRun, listEncounters, encounterBuilderOptions } from "@/lib/encounter-library";
import EncounterList from "./[campaignId]/encounters/page";
import EncounterDetail from "./[campaignId]/encounters/[encounterId]/page";
import EncounterNew from "./[campaignId]/encounters/new/page";
import RunPage from "./[campaignId]/encounters/runs/[runId]/page";

let directory: string, campaignId: string, foreignId: string, enemyId: string, shinobiId: string, pcId: string, civilianId: string, npcId: string, foreignEnemy: string, foreignNpc: string, foreignCharacter: string, locationId: string, foreignLocation: string;
let legacySnapshot: unknown;
const legacyCharacters = async () => { const rows = await database.client.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM Character WHERE campaignId = ? ORDER BY id', "legacy-encounter"); for (const row of rows) delete row.portraitOwnerKey; return rows; };
const legacy = async () => Promise.all([legacyCharacters(), database.client.npc.findMany({ where: { campaignId: "legacy-encounter" } }), database.client.enemyTemplate.findMany({ where: { campaignId: "legacy-encounter" } })]);
const fd = (data: Record<string, string>) => { const f = new FormData(); for (const [key, value] of Object.entries(data)) f.set(key, value); return f; };
const eventId = randomUUID();
const encounterForm = (patch: Record<string, string> = {}, version = 1) => fd({ name: "Hafenüberfall", description: "Drei Banditen am Kai", type: "COMBAT", difficulty: "MODERATE", locationId: "", dmNotes: "ENCOUNTER_SECRET", status: "DRAFT", events: "[]", version: String(version), ...patch });
const planForm = (sourceId = enemyId, patch: Record<string, string> = {}) => fd({ source: "ENEMY", sourceId, quantity: "1", side: "HOSTILE", notes: "Gruppennotiz", ...patch });
async function encounter(id: string) { const e = await getEncounter(campaignId, id); if (!e) throw new Error("Missing encounter"); return e; }
async function run(id: string) { const r = await getEncounterRun(campaignId, id); if (!r) throw new Error("Missing run"); return r; }
async function add(id: string, data = planForm()) { await saveEncounterParticipant(campaignId, id, null, (await encounter(id)).version, data); }
async function ready(id: string, patch: Record<string, string> = {}) { await saveEncounter(campaignId, id, encounterForm({ status: "READY", ...patch }, (await encounter(id)).version)); }
async function createRun(quantity = "2", extra?: Record<string, string>) {
  const id = await saveEncounter(campaignId, null, encounterForm()); await add(id, planForm(enemyId, { quantity })); await ready(id, extra);
  return run(await startEncounterRun(campaignId, id, (await encounter(id)).version, randomUUID()));
}
async function action(r: Pick<EncounterRun, "id" | "version">, command: CombatCommand, requestId = randomUUID()): Promise<RunView> {
  const result = await performCombatAction(campaignId, r.id, { expectedVersion: r.version, requestId, command });
  if (!result.ok) throw new Error(result.error); return result.run;
}
async function begin(r: RunView) { return action(await action(r, { kind: "ROLL_INITIATIVE" }), { kind: "BEGIN" }); }
const output = (value: unknown) => JSON.stringify(value, (key, item) => key === "type" || key === "_owner" ? undefined : item);

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "narutodnd-encounter-tests-"));
  database.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  const migrations = join(process.cwd(), "prisma/migrations");
  for (const name of (await readdir(migrations)).filter(n => /^\d/.test(n)).sort()) {
    if (name === "20261014160000_encounters") {
      await database.client.campaign.create({ data: { id: "legacy-encounter", name: "Legacy", dmCodeHash: "ldm", playerCodeHash: "lp" } });
      await database.client.character.create({ data: { campaignId: "legacy-encounter", name: "Legacy PC", currentHp: 3, maxHp: 22, currentChakra: 75 }, select: { id: true } });
      await database.client.npc.create({ data: { campaignId: "legacy-encounter", name: "Legacy NPC", dmSecrets: "Legacy secret" } });
      await database.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[6].data, campaignId: "legacy-encounter" } });
      legacySnapshot = await legacy();
    }
    const sql = (await readFile(join(migrations, name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, "");
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await database.client.$executeRawUnsafe(statement);
  }
  campaignId = (await database.client.campaign.create({ data: { name: "Encounter test", dmCodeHash: "dm", playerCodeHash: "player" } })).id;
  foreignId = (await database.client.campaign.create({ data: { name: "Foreign", dmCodeHash: "fdm", playerCodeHash: "fplayer" } })).id;
  enemyId = (await database.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[6].data, seedKey: "encounter-bandit" } })).id;
  shinobiId = (await database.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[11].data, campaignId } })).id;
  foreignEnemy = (await database.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[6].data, campaignId: foreignId, name: "FOREIGN_ENEMY_SECRET" } })).id;
  pcId = (await database.client.character.create({ data: { campaignId, name: "Spieler", dex: 16, con: 14, maxHp: 25, currentHp: 13, currentChakra: 75, initiativeOverride: 7 } })).id;
  const npcCharacter = await database.client.character.create({ data: { campaignId, name: "Sensei", maxHp: 30, currentHp: 22, currentChakra: 120 } });
  npcId = (await database.client.npc.create({ data: { campaignId, name: "Sensei", category: "SHINOBI", characterId: npcCharacter.id, dmSecrets: "NPC_IDENTITY_SECRET" } })).id;
  civilianId = (await database.client.npc.create({ data: { campaignId, name: "Händlerin", category: "MERCHANT" } })).id;
  foreignNpc = (await database.client.npc.create({ data: { campaignId: foreignId, name: "FOREIGN_NPC_SECRET" } })).id;
  foreignCharacter = (await database.client.character.create({ data: { campaignId: foreignId, name: "Foreign PC" } })).id;
  locationId = (await database.client.location.create({ data: { campaignId, name: "Kai", slug: "kai" } })).id;
  foreignLocation = (await database.client.location.create({ data: { campaignId: foreignId, name: "Foreign pier", slug: "pier" } })).id;
}, 30000);
beforeEach(() => {
  vi.clearAllMocks();
  requireCampaign.mockImplementation(async (id: string) => { if (id !== campaignId) throw new Error("Unauthorized"); return { campaignId, role: "DM" }; });
});
afterAll(async () => {
  await database.client?.$disconnect();
  if (directory) {
    const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("narutodnd-encounter-tests-")) throw new Error("Unexpected cleanup path");
    await rm(target, { recursive: true, force: true });
  }
});

it("migrates populated data without changing characters, NPCs or enemy templates", async () => { expect(await legacy()).toEqual(legacySnapshot); });
it("creates, edits, filters and archives encounter templates with locations and events", async () => {
  const events = JSON.stringify([{ id: eventId, title: "Verstärkung", trigger: "Runde 3", description: "Wachen betreten den Kai." }]);
  const id = await saveEncounter(campaignId, null, encounterForm({ locationId, events }));
  expect(await encounter(id)).toMatchObject({ campaignId, locationId, version: 1, status: "DRAFT" });
  await saveEncounter(campaignId, id, encounterForm({ name: "Hafenfest", type: "SOCIAL", status: "READY", events }, 1));
  expect((await listEncounters(campaignId, { q: "Hafenfest", type: "SOCIAL", status: "READY" })).some(e => e.id === id)).toBe(true);
  await saveEncounter(campaignId, id, encounterForm({ status: "ARCHIVED" }, 2));
  expect((await listEncounters(campaignId)).some(e => e.id === id)).toBe(false);
  expect((await listEncounters(campaignId, { status: "ARCHIVED" })).some(e => e.id === id)).toBe(true);
});
it("requires archive, name confirmation and no run history before deletion", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm());
  await expect(deleteEncounter(campaignId, id, 1, fd({ confirmation: "Hafenüberfall" }))).rejects.toThrow();
  await saveEncounter(campaignId, id, encounterForm({ status: "ARCHIVED" }, 1));
  await expect(deleteEncounter(campaignId, id, 2, fd({ confirmation: "wrong" }))).rejects.toThrow();
  await deleteEncounter(campaignId, id, 2, fd({ confirmation: "Hafenüberfall" }));
  expect(await getEncounter(campaignId, id)).toBeNull();
  const r = await createRun(); const e = await encounter(r.encounterId);
  await saveEncounter(campaignId, e.id, encounterForm({ status: "ARCHIVED" }, e.version));
  await expect(deleteEncounter(campaignId, e.id, e.version + 1, fd({ confirmation: e.name }))).rejects.toThrow("Run-Historie");
});
it("updates and removes prepared participant groups with version checking", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm()); await add(id);
  let e = await encounter(id); const p = e.participants[0];
  await saveEncounterParticipant(campaignId, id, p.id, e.version, planForm(enemyId, { quantity: "3", override_name: "Wächter", override_maxHp: "33" }));
  e = await encounter(id); expect(e.participants[0]).toMatchObject({ quantity: 3, overrides: { name: "Wächter", maxHp: 33 } });
  await removeEncounterParticipant(campaignId, id, p.id, e.version);
  expect((await encounter(id)).participants).toHaveLength(0);
});
it("rejects duplicate people, foreign sources, invalid quantities and unavailable sources", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm()); await add(id, planForm(pcId, { source: "CHARACTER" }));
  await expect(add(id, planForm(pcId, { source: "CHARACTER" }))).rejects.toThrow("bereits");
  for (const data of [planForm(foreignEnemy), planForm(foreignNpc, { source: "NPC" }), planForm(foreignCharacter, { source: "CHARACTER" }), planForm(enemyId, { quantity: "21" }), planForm(npcId, { source: "NPC", quantity: "2" }), planForm("missing")]) await expect(add(id, data)).rejects.toThrow();
  const linked = await database.client.npc.findUniqueOrThrow({ where: { id: npcId } });
  await expect(add(id, planForm(linked.characterId!, { source: "CHARACTER" }))).rejects.toThrow();
});
it("rejects foreign locations, cross-encounter plan IDs and stale template edits", async () => {
  await expect(saveEncounter(campaignId, null, encounterForm({ locationId: foreignLocation }))).rejects.toThrow();
  const a = await saveEncounter(campaignId, null, encounterForm()), b = await saveEncounter(campaignId, null, encounterForm()); await add(a);
  const plan = (await encounter(a)).participants[0];
  await expect(removeEncounterParticipant(campaignId, b, plan.id, 1)).rejects.toThrow();
  await expect(saveEncounterParticipant(campaignId, b, plan.id, 1, planForm())).rejects.toThrow();
  await expect(saveEncounter(campaignId, a, encounterForm({ name: "Stale" }, 1))).rejects.toThrow("inzwischen");
});
it("starts only ready templates and deduplicates repeated start requests", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm());
  await expect(startEncounterRun(campaignId, id, 1, randomUUID())).rejects.toThrow(); await add(id); await ready(id);
  const e = await encounter(id), request = randomUUID();
  const first = await startEncounterRun(campaignId, id, e.version, request);
  expect(await startEncounterRun(campaignId, id, e.version, request)).toBe(first);
  expect(await database.client.encounterRun.count({ where: { encounterId: id } })).toBe(1);
  await expect(startEncounterRun(campaignId, id, e.version - 1, randomUUID())).rejects.toThrow();
  await expect(startEncounterRun(campaignId, id, e.version - 1, request)).rejects.toThrow("Request-ID");
});
it("creates independent IDs and state for three copies of the same enemy", async () => {
  let r = await createRun("3");
  expect(new Set(r.participants.map(p => p.id)).size).toBe(3); expect(r.participants.map(p => p.name)).toEqual(["Bandit 1", "Bandit 2", "Bandit 3"]);
  r = await action(r, { kind: "DAMAGE", participantId: r.participants[0].id, amount: 5 });
  expect(r.participants.map(p => p.currentHp)).toEqual([11, 16, 16]);
  r = await action(r, { kind: "CONDITIONS", participantId: r.participants[0].id, conditions: ["POISONED"] });
  expect(r.participants[1].conditions).toEqual([]);
});
it("reuses one template for multiple isolated runs and retains configured stat overrides", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm()); await add(id, planForm(enemyId, { quantity: "2", override_name: "Wache", override_maxHp: "40", override_ac: "17", override_initiativeBonus: "5" })); await ready(id);
  const e = await encounter(id), a = await run(await startEncounterRun(campaignId, id, e.version, randomUUID())), b = await run(await startEncounterRun(campaignId, id, e.version, randomUUID()));
  await action(a, { kind: "DAMAGE", participantId: a.participants[0].id, amount: 10 });
  expect((await run(b.id)).participants[0]).toMatchObject({ name: "Wache 1", currentHp: 40, maxHp: 40, ac: 17, initiativeBonus: 5 });
  expect((await run(a.id)).participants[0].currentHp).toBe(30);
});
it("snapshots players, Shinobi NPCs, simple civilians and chakrafree animals", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm());
  for (const [source, sourceId] of [["CHARACTER", pcId], ["NPC", npcId], ["NPC", civilianId]] as const) await add(id, planForm(sourceId, { source, side: "ALLY" }));
  const animal = await database.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[2].data } }); await add(id, planForm(animal.id)); await ready(id);
  const r = await run(await startEncounterRun(campaignId, id, (await encounter(id)).version, randomUUID()));
  expect(r.participants.find(p => p.sourceId === pcId)).toMatchObject({ currentHp: 13, maxHp: 25, currentChakra: 75, initiativeBonus: 7, ac: 15 });
  expect(r.participants.find(p => p.sourceId === npcId)).toMatchObject({ currentHp: 22, maxHp: 30, currentChakra: 120 });
  expect(r.participants.find(p => p.sourceId === civilianId)).toMatchObject({ maxHp: null, currentHp: null, maxChakra: null });
  expect(r.participants.find(p => p.sourceId === animal.id)).toMatchObject({ maxChakra: null, currentChakra: null });
  for (const p of r.participants) combatSnapshotSchema.parse(p.snapshot);
  expect(JSON.stringify(r)).not.toContain("NPC_IDENTITY_SECRET");
});
it("keeps ongoing snapshots unchanged when enemy, Jutsu, character, location or encounter sources change", async () => {
  const localEnemy = await database.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[11].data, campaignId } });
  const jutsu = await database.client.jutsu.create({ data: { name: "Old Jutsu", slug: randomUUID(), description: "Old description", rank: "D", chakraCost: 10, range: "30 ft", duration: "Instant", actionType: "Action" } });
  await database.client.enemyTemplateJutsu.create({ data: { templateId: localEnemy.id, jutsuId: jutsu.id } });
  const id = await saveEncounter(campaignId, null, encounterForm()); await add(id, planForm(localEnemy.id)); await ready(id, { locationId });
  const r = await run(await startEncounterRun(campaignId, id, (await encounter(id)).version, randomUUID()));
  const snapshot = structuredClone(r);
  await database.client.enemyTemplate.update({ where: { id: localEnemy.id }, data: { maxHp: 999, name: "Changed source" } });
  await database.client.jutsu.update({ where: { id: jutsu.id }, data: { name: "Changed Jutsu", chakraCost: 999 } });
  await saveEncounter(campaignId, id, encounterForm({ name: "New encounter", status: "READY" }, (await encounter(id)).version));
  await database.client.location.update({ where: { id: locationId }, data: { name: "Renamed pier" } });
  expect(await run(r.id)).toEqual(snapshot);
});
it("does not mutate Character Sheets or Bestiary sources during combat", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm()); await add(id, planForm(pcId, { source: "CHARACTER" })); await add(id); await ready(id);
  const characterBefore = await database.client.character.findUnique({ where: { id: pcId } }), enemyBefore = await database.client.enemyTemplate.findUnique({ where: { id: enemyId } });
  let r = await run(await startEncounterRun(campaignId, id, (await encounter(id)).version, randomUUID())); r = await begin(r);
  for (const p of r.participants) r = await action(r, { kind: "DAMAGE", participantId: p.id, amount: 5 });
  const pc = r.participants.find(p => p.sourceId === pcId)!; await action(r, { kind: "SPEND_CHAKRA", participantId: pc.id, amount: 10 });
  expect(await database.client.character.findUnique({ where: { id: pcId } })).toEqual(characterBefore);
  expect(await database.client.enemyTemplate.findUnique({ where: { id: enemyId } })).toEqual(enemyBefore);
});
it("uses stable initiative order, round wrap and skips defeated or unconscious actors", async () => {
  let r = await createRun("3");
  for (let i = 0; i < r.participants.length; i++) r = await action(r, { kind: "INITIATIVE", participantId: r.participants[i].id, value: 20 - i });
  r = await action(r, { kind: "BEGIN" }); expect(r.round).toBe(1); expect(r.activeParticipantId).toBe(r.participants[0].id);
  r = await action(r, { kind: "FLAGS", participantId: r.participants[1].id, defeated: true, unconscious: false });
  r = await action(r, { kind: "NEXT" }); expect(r.activeParticipantId).toBe(r.participants[2].id); expect(r.round).toBe(1);
  r = await action(r, { kind: "NEXT" }); expect(r.activeParticipantId).toBe(r.participants[0].id); expect(r.round).toBe(2);
  r = await action(r, { kind: "DAMAGE", participantId: r.participants[0].id, amount: 1000 });
  r = await action(r, { kind: "NEXT" }); expect(r.activeParticipantId).toBe(r.participants[2].id); expect(r.round).toBe(2);
});
it("rolls initiative within W20 plus the snapshotted bonus and forbids changes once active", async () => {
  let r = await createRun();
  r = await action(r, { kind: "ROLL_INITIATIVE" });
  for (const p of r.participants) { expect(p.initiative).toBeGreaterThanOrEqual(1 + p.initiativeBonus); expect(p.initiative).toBeLessThanOrEqual(20 + p.initiativeBonus); }
  r = await action(r, { kind: "BEGIN" });
  expect((await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: r.version, command: { kind: "ROLL_INITIATIVE" } })).ok).toBe(false);
});
it("clamps HP, marks zero HP unconscious, heals and persists wounds", async () => {
  let r = await createRun("1"); const p = r.participants[0];
  r = await action(r, { kind: "DAMAGE", participantId: p.id, amount: 100 }); expect(r.participants[0]).toMatchObject({ currentHp: 0, unconscious: true });
  expect((await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: r.version, command: { kind: "FLAGS", participantId: p.id, defeated: false, unconscious: false } })).ok).toBe(false);
  r = await action(r, { kind: "HEAL", participantId: p.id, amount: 100 }); expect(r.participants[0]).toMatchObject({ currentHp: 16, unconscious: false, severelyWounded: true });
  expect((await reloadEncounterRun(campaignId, r.id))?.participants[0].currentHp).toBe(16);
});
it("manages optional chakra, rejects overspending and never allocates chakra to ordinary enemies", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm()); await add(id, planForm(shinobiId)); await add(id); await ready(id);
  let r = await run(await startEncounterRun(campaignId, id, (await encounter(id)).version, randomUUID()));
  const shinobi = r.participants.find(p => p.sourceId === shinobiId)!, bandit = r.participants.find(p => p.sourceId === enemyId)!;
  expect(shinobi.maxChakra).toBe(calculateMaxChakra(2, 12, 11, "AVERAGE"));
  r = await action(r, { kind: "SPEND_CHAKRA", participantId: shinobi.id, amount: 10 });
  expect(r.participants.find(p => p.id === shinobi.id)?.currentChakra).toBe(shinobi.maxChakra! - 10);
  r = await action(r, { kind: "RESTORE_CHAKRA", participantId: shinobi.id, amount: 9999 });
  expect(r.participants.find(p => p.id === shinobi.id)?.currentChakra).toBe(shinobi.maxChakra);
  for (const command of [{ kind: "SPEND_CHAKRA", participantId: shinobi.id, amount: 9999 }, { kind: "RESTORE_CHAKRA", participantId: bandit.id, amount: 1 }] as CombatCommand[]) expect((await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: r.version, command })).ok).toBe(false);
});
it("persists conditions, participant notes, run notes and event progress after reload", async () => {
  let r = await createRun("1", { events: JSON.stringify([{ id: eventId, title: "Verstärkung", trigger: "Runde 2", description: "Zwei Wachen" }]) });
  const p = r.participants[0];
  r = await action(r, { kind: "CONDITIONS", participantId: p.id, conditions: ["PRONE", "POISONED"] });
  r = await action(r, { kind: "PARTICIPANT_NOTES", participantId: p.id, notes: "Flieht bei 5 HP" });
  r = await action(r, { kind: "RUN_NOTES", notes: "Wachen gewarnt" });
  r = await action(r, { kind: "EVENT", eventId, done: true });
  expect(await run(r.id)).toEqual(r);
  r = await action(r, { kind: "CONDITIONS", participantId: p.id, conditions: [] }); expect(r.participants[0].conditions).toEqual([]);
  expect((r.events as { done: boolean }[])[0].done).toBe(true);
});
it("completes runs as immutable history and permits a fresh run from the same template", async () => {
  let r = await begin(await createRun()); r = await action(r, { kind: "COMPLETE", summary: "Die Banditen fliehen." });
  expect(r).toMatchObject({ status: "COMPLETED", activeParticipantId: null, summary: "Die Banditen fliehen." }); expect(r.endedAt).not.toBeNull();
  expect((await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: r.version, command: { kind: "RUN_NOTES", notes: "overwrite" } })).ok).toBe(false);
  const fresh = await run(await startEncounterRun(campaignId, r.encounterId, (await encounter(r.encounterId)).version, randomUUID()));
  expect(fresh.status).toBe("PREPARING"); expect(fresh.round).toBe(0); expect(fresh.id).not.toBe(r.id);
});
it("supports social encounters with civilians or only events, and cancellation before combat", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm({ type: "SOCIAL", status: "READY" }));
  let r = await run(await startEncounterRun(campaignId, id, 1, randomUUID()));
  r = await action(r, { kind: "BEGIN" }); expect(r.activeParticipantId).toBeNull(); expect(r.round).toBe(1);
  r = await action(r, { kind: "COMPLETE", summary: "Gespräch beendet" }); expect(r.status).toBe("COMPLETED");
  const prep = await createRun(); const cancelled = await action(prep, { kind: "CANCEL", summary: "Vertagt" }); expect(cancelled.status).toBe("CANCELLED");
});
it("repeated damage and next-turn requests are applied exactly once even after a later update", async () => {
  let r = await begin(await createRun()); const p = r.participants[0], requestId = randomUUID(), version = r.version;
  const request = { requestId, expectedVersion: version, command: { kind: "DAMAGE", participantId: p.id, amount: 4 } };
  const first = await performCombatAction(campaignId, r.id, request); expect(first.ok).toBe(true);
  r = await run(r.id); expect(r.participants[0].currentHp).toBe(12);
  const nextRequest = { requestId: randomUUID(), expectedVersion: r.version, command: { kind: "NEXT" } };
  await performCombatAction(campaignId, r.id, nextRequest); const afterNext = await run(r.id);
  await performCombatAction(campaignId, r.id, nextRequest); expect(await run(r.id)).toEqual(afterNext);
  await performCombatAction(campaignId, r.id, request); expect((await run(r.id)).participants[0].currentHp).toBe(12);
  expect((await performCombatAction(campaignId, r.id, { ...request, command: { ...request.command, amount: 9 } })).ok).toBe(false);
});
it("rejects stale updates and never increments version on failed actions", async () => {
  const r = await createRun(), updated = await action(r, { kind: "RUN_NOTES", notes: "New" });
  const stale = await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: r.version, command: { kind: "DAMAGE", participantId: r.participants[0].id, amount: 1 } });
  expect(stale.ok).toBe(false); expect(await run(r.id)).toEqual(updated);
  const invalid = await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: updated.version, command: { kind: "COMPLETE", summary: "Not yet" } });
  expect(invalid.ok).toBe(false); expect(await run(r.id)).toEqual(updated);
});
it("protects cross-run participant IDs and foreign encounter/run metadata", async () => {
  const a = await createRun(), b = await createRun();
  expect((await performCombatAction(campaignId, a.id, { requestId: randomUUID(), expectedVersion: a.version, command: { kind: "DAMAGE", participantId: b.participants[0].id, amount: 10 } })).ok).toBe(false);
  const foreign = await database.client.encounter.create({ data: { campaignId: foreignId, name: "FOREIGN_ENCOUNTER_SECRET" } });
  expect(await getEncounter(campaignId, foreign.id)).toBeNull();
  await expect(saveEncounter(campaignId, foreign.id, encounterForm())).rejects.toThrow();
  await expect(startEncounterRun(campaignId, foreign.id, 1, randomUUID())).rejects.toThrow();
  await database.client.encounterRun.update({ where: { id: b.id }, data: { campaignId: foreignId, name: "FOREIGN_RUN_SECRET" } });
  expect(await getEncounterRun(campaignId, b.id)).toBeNull(); expect(await reloadEncounterRun(campaignId, b.id)).toBeNull();
  expect((await performCombatAction(campaignId, b.id, { requestId: randomUUID(), expectedVersion: b.version, command: { kind: "RUN_NOTES", notes: "x" } })).ok).toBe(false);
  expect(output(await EncounterList({ params: Promise.resolve({ campaignId }), searchParams: Promise.resolve({}) }))).not.toContain("FOREIGN_ENCOUNTER_SECRET");
});
it("requires DM access for every reader, route and mutation, including direct run URLs", async () => {
  requireCampaign.mockRejectedValue(new Error("Unauthorized"));
  for (const op of [
    () => getEncounter(campaignId, "id"), () => getEncounterRun(campaignId, "id"), () => listEncounters(campaignId), () => encounterBuilderOptions(campaignId),
    () => saveEncounter(campaignId, null, encounterForm()), () => saveEncounterParticipant(campaignId, "id", null, 1, planForm()), () => removeEncounterParticipant(campaignId, "id", "plan", 1),
    () => deleteEncounter(campaignId, "id", 1, fd({})), () => startEncounterRun(campaignId, "id", 1, randomUUID()), () => performCombatAction(campaignId, "id", {}), () => reloadEncounterRun(campaignId, "id"),
    () => EncounterDetail({ params: Promise.resolve({ campaignId, encounterId: "id" }) }), () => EncounterNew({ params: Promise.resolve({ campaignId }) }), () => RunPage({ params: Promise.resolve({ campaignId, runId: "id" }) }),
  ]) await expect(op()).rejects.toThrow("Unauthorized");
  expect(requireCampaign.mock.calls.every(call => call[1] === true)).toBe(true);
});
it("excludes foreign and duplicate NPC character identities from builder options", async () => {
  const options = await encounterBuilderOptions(campaignId), linked = await database.client.npc.findUniqueOrThrow({ where: { id: npcId } });
  expect(options.characters.map(c => c.id)).toContain(pcId); expect(options.characters.map(c => c.id)).not.toContain(linked.characterId);
  expect(options.enemies.map(e => e.id)).not.toContain(foreignEnemy); expect(options.npcs.map(n => n.id)).not.toContain(foreignNpc); expect(options.locations.map(l => l.id)).not.toContain(foreignLocation);
});
it.each([
  { kind: "DAMAGE", amount: -1 }, { kind: "DAMAGE", amount: 1.5 }, { kind: "HEAL", amount: 0 }, { kind: "SPEND_CHAKRA", amount: Infinity },
  { kind: "INITIATIVE", value: 101 }, { kind: "CONDITIONS", conditions: ["FAKE"] }, { kind: "CONDITIONS", conditions: ["PRONE", "PRONE"] },
  { kind: "FLAGS", defeated: "yes", unconscious: false }, { kind: "DAMAGE", amount: 1, campaignId: "spoof" },
])("validates combat request %# without mutation", async patch => {
  const r = await createRun("1");
  const response = await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: r.version, command: { participantId: r.participants[0].id, ...patch } });
  expect(response.ok).toBe(false); expect(await run(r.id)).toEqual(r);
});
it("database enforces resource and source integrity", async () => {
  const r = await createRun("1");
  await expect(database.client.encounterRunParticipant.update({ where: { id: r.participants[0].id }, data: { currentHp: -1 } })).rejects.toThrow();
  await expect(database.client.encounterRunParticipant.update({ where: { id: r.participants[0].id }, data: { currentChakra: 10 } })).rejects.toThrow();
  await expect(database.client.encounterParticipantPlan.create({ data: { encounterId: r.encounterId, enemyTemplateId: enemyId, npcId: civilianId } })).rejects.toThrow();
  expect(await database.client.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
});

it("accepts only one concurrent mutation for the same version", async () => {
  const r = await createRun("1"), command = { kind: "DAMAGE", participantId: r.participants[0].id, amount: 1 };
  const results = await Promise.all([randomUUID(), randomUUID()].map(requestId => performCombatAction(campaignId, r.id, { requestId, expectedVersion: r.version, command })));
  expect(results.filter(r => r.ok)).toHaveLength(1);
  expect((await run(r.id)).participants[0].currentHp).toBe(15);
});
it("rejects missing initiative, inactive next turns and invalid events without changing state", async () => {
  const r = await createRun("1");
  for (const command of [{ kind: "BEGIN" }, { kind: "NEXT" }, { kind: "COMPLETE", summary: "too early" }, { kind: "EVENT", eventId: randomUUID(), done: true }] as CombatCommand[]) {
    expect((await performCombatAction(campaignId, r.id, { requestId: randomUUID(), expectedVersion: r.version, command })).ok).toBe(false);
    expect(await run(r.id)).toEqual(r);
  }
});
it("continues existing runs after archiving templates and cannot start archived encounters", async () => {
  let r = await createRun("1");
  const e = await encounter(r.encounterId); await saveEncounter(campaignId, e.id, encounterForm({ status: "ARCHIVED" }, e.version));
  await expect(startEncounterRun(campaignId, e.id, e.version + 1, randomUUID())).rejects.toThrow();
  r = await begin(r); r = await action(r, { kind: "COMPLETE", summary: "Still usable" }); expect(r.status).toBe("COMPLETED");
});
it("adds basic combat HP to a civilian without manufacturing chakra or changing its identity", async () => {
  const id = await saveEncounter(campaignId, null, encounterForm());
  await add(id, planForm(civilianId, { source: "NPC", override_maxHp: "8", override_ac: "11" })); await ready(id);
  const r = await run(await startEncounterRun(campaignId, id, (await encounter(id)).version, randomUUID()));
  expect(r.participants[0]).toMatchObject({ sourceId: civilianId, maxHp: 8, currentHp: 8, ac: 11, maxChakra: null });
  expect((await database.client.npc.findUniqueOrThrow({ where: { id: civilianId } })).characterId).toBeNull();
  await expect(add(id, planForm(civilianId, { source: "NPC", override_maxChakra: "100" }))).rejects.toThrow();
});
it.each(["SOCIAL", "EXPLORATION", "CHASE", "MIXED"])("persists and executes the %s encounter type", async type => {
  const id = await saveEncounter(campaignId, null, encounterForm({ type }));
  if (type === "MIXED") await add(id);
  await ready(id, { type });
  let r = await run(await startEncounterRun(campaignId, id, (await encounter(id)).version, randomUUID()));
  if (r.participants.length) r = await action(r, { kind: "ROLL_INITIATIVE" });
  r = await action(r, { kind: "BEGIN" }); r = await action(r, { kind: "COMPLETE", summary: "Done" });
  expect(r.type).toBe(type); expect(r.status).toBe("COMPLETED");
});
