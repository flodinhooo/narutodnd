import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { seedMissions } from "../../../prisma/seed-missions";
import { missionSeeds } from "../../../seeding/missions";
import { enemyTemplateSeeds } from "../../../seeding/enemy-templates";
import type { MissionCommand, MissionInput } from "@/lib/missions";
import type { DmMission } from "@/lib/mission-library";

const { database, requireCampaign, getSession } = vi.hoisted(() => ({ database: { client: null as unknown as PrismaClient }, requireCampaign: vi.fn(), getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return database.client; } }));
vi.mock("@/lib/session", () => ({ requireCampaign, getSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: vi.fn() }));
import { saveMission, performMissionAction, saveMissionConsequence, removeMissionConsequence, deleteMission } from "./mission-actions";
import { importMissionTemplate } from "./mission-import-actions";
import { setSessionContent } from "./mission-session-actions";
import { createGameSession, updateGameSession } from "./campaign-actions";
import { getDmDashboard } from "@/lib/dm-dashboard";
import { getDmMission, getPlayerMission, listMissions, missionOptions, listMissionTemplates } from "@/lib/mission-library";
import { getSessionDashboard } from "@/lib/mission-session";
import MissionPage from "./[campaignId]/missions/[missionId]/page";
import MissionBoard from "./[campaignId]/missions/page";
import NewMission from "./[campaignId]/missions/new/page";

let directory: string, campaignId: string, foreignId: string, npcId: string, hiddenNpc: string, organizationId: string, locationId: string, hiddenLocation: string, encounterId: string, foreignNpc: string, foreignLocation: string, foreignEncounter: string;
let legacySnapshot: unknown;
const legacy = () => database.client.$queryRawUnsafe('SELECT id,title,dmNotes,status FROM GameSession WHERE id = \'legacy-session\'');
const fd = (data: Record<string, string>) => { const f = new FormData(); for (const [key, value] of Object.entries(data)) f.set(key, value); return f; };
function graph(): MissionInput["objectives"] { const a = randomUUID(), b = randomUUID(); return [{ id: a, title: "Öffentliches Ziel", description: "Öffentliche Aufgabe", playerVisible: true, optional: false, enabled: true, dependencyIds: [] }, { id: b, title: "SECRET_OBJECTIVE", description: "SECRET_DESCRIPTION", playerVisible: false, optional: false, enabled: true, dependencyIds: [a] }]; }
function form(patch: Record<string, string> = {}, objectives = graph(), version = 1) { return fd({ title: "Testmission", rank: "C", description: "PRIVATE_DESCRIPTION", publicInformation: "PUBLIC_BRIEF", rewards: "200 Ryo", dmNotes: "PRIVATE_DM_NOTES", playerVisible: "on", objectives: JSON.stringify(objectives), encounters: "[]", version: String(version), ...patch }); }
const read = async (id: string) => { const m = await getDmMission(campaignId, id); if (!m) throw new Error("Missing mission"); return m; };
function editForm(m: DmMission, patch: Record<string, string> = {}) {
  const f = form({ title: m.title, rank: m.rank, description: m.description, publicInformation: m.publicInformation, rewards: m.rewards, dmNotes: m.dmNotes, playerVisible: m.playerVisible ? "on" : "", clientNpcId: m.clientNpcId ?? "", locationId: m.locationId ?? "", encounters: JSON.stringify(m.encounters.map(e => ({ id: e.id, encounterId: e.encounterId, optional: e.optional }))), ...patch }, m.objectives.map(o => ({ id: o.id, title: o.title, description: o.description, playerVisible: o.playerVisible, optional: o.optional, enabled: o.enabled, dependencyIds: o.dependencies.map(d => d.prerequisiteId) })), m.version);
  for (const n of m.npcs) f.append("npcIds", n.npcId); return f;
}
async function command(id: string, c: MissionCommand, requestId = randomUUID(), version?: number) {
  const result = await performMissionAction(campaignId, id, { requestId, expectedVersion: version ?? (await read(id)).version, command: c }); if (!result.ok) throw new Error(result.error); return result;
}
async function activeMission(f = form()) { const id = await saveMission(campaignId, null, f); for (const status of ["AVAILABLE", "ACCEPTED", "ACTIVE"] as const) await command(id, { kind: "STATUS", status }); return read(id); }
async function prepare(missionId: string, patch: Record<string, string> = {}) { await saveMissionConsequence(campaignId, missionId, null, (await read(missionId)).version, fd({ title: "Vertrauen gewinnen", description: "Nach dem Auftrag", kind: "NPC_ATTITUDE", npcId, value: "FRIENDLY", ...patch })); return (await read(missionId)).consequences.at(-1)!; }
const output = (value: unknown) => JSON.stringify(value, (key, item) => key === "type" || key === "_owner" ? undefined : item);
function player() { const access = { id: "player-access", campaignId, role: "PLAYER" }; getSession.mockResolvedValue(access); requireCampaign.mockImplementation(async (id: string, dm?: boolean) => { if (id !== campaignId || dm) throw new Error("Unauthorized"); return access; }); }
async function newSession(extra = {}) { return database.client.gameSession.create({ data: { campaignId, number: await database.client.gameSession.count() + 1, title: "Session", dmNotes: "SESSION_SECRET", ...extra } }); }

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "narutodnd-mission-tests-")); database.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  const migrations = join(process.cwd(), "prisma/migrations");
  for (const name of (await readdir(migrations)).filter(n => /^\d/.test(n)).sort()) {
    if (name === "20261014180000_missions") {
      await database.client.campaign.create({ data: { id: "legacy-campaign", name: "Legacy", dmCodeHash: "ldm", playerCodeHash: "lp" } });
      await database.client.$executeRawUnsafe('INSERT INTO GameSession(id,campaignId,number,title,dmNotes,updatedAt) VALUES (?,?,?,?,?,?)', "legacy-session", "legacy-campaign", 1, "Legacy session", "Legacy DM secret", Date.now()); legacySnapshot = await legacy();
    }
    const sql = (await readFile(join(migrations, name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, ""); for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await database.client.$executeRawUnsafe(statement);
  }
  campaignId = (await database.client.campaign.create({ data: { name: "Mission tests", dmCodeHash: "dm", playerCodeHash: "p" } })).id;
  foreignId = (await database.client.campaign.create({ data: { name: "Foreign", dmCodeHash: "fdm", playerCodeHash: "fp" } })).id;
  npcId = (await database.client.npc.create({ data: { campaignId, name: "Mika", playerVisible: true } })).id;
  hiddenNpc = (await database.client.npc.create({ data: { campaignId, name: "SECRET_NPC", dmSecrets: "NPC_SECRET" } })).id;
  organizationId = (await database.client.organization.create({ data: { campaignId, name: "Fraktion", type: "FACTION" } })).id;
  locationId = (await database.client.location.create({ data: { campaignId, name: "Hafen", slug: "hafen", playerVisible: true } })).id;
  hiddenLocation = (await database.client.location.create({ data: { campaignId, name: "SECRET_LOCATION", slug: "secret", playerVisible: false } })).id;
  encounterId = (await database.client.encounter.create({ data: { campaignId, name: "SECRET_ENCOUNTER", type: "SOCIAL", status: "READY", dmNotes: "ENCOUNTER_SECRET" } })).id;
  foreignNpc = (await database.client.npc.create({ data: { campaignId: foreignId, name: "Foreign" } })).id;
  foreignLocation = (await database.client.location.create({ data: { campaignId: foreignId, name: "Foreign", slug: "foreign" } })).id;
  foreignEncounter = (await database.client.encounter.create({ data: { campaignId: foreignId, name: "Foreign" } })).id;
  for (const seed of enemyTemplateSeeds) await database.client.enemyTemplate.create({ data: { ...seed.data, seedKey: seed.key } });
}, 30000);
beforeEach(() => { vi.clearAllMocks(); const access = { id: "dm-access", campaignId, role: "DM" }; getSession.mockResolvedValue(access); requireCampaign.mockImplementation(async (id: string) => { if (id !== campaignId) throw new Error("Unauthorized"); return access; }); });
afterAll(async () => { await database.client?.$disconnect(); if (directory) { const target = resolve(directory); if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("narutodnd-mission-tests-")) throw new Error("Unexpected cleanup path"); await rm(target, { recursive: true, force: true }); } });

it("migrates existing session data without changes and initializes its version", async () => { expect(await legacy()).toEqual(legacySnapshot); expect((await database.client.gameSession.findUniqueOrThrow({ where: { id: "legacy-session" } })).version).toBe(1); });
it("creates and edits missions, relational objectives, NPCs and ordered encounters", async () => {
  const f = form({ clientNpcId: npcId, locationId, encounters: JSON.stringify([{ id: randomUUID(), encounterId, optional: true }]) }); f.append("npcIds", npcId);
  const id = await saveMission(campaignId, null, f); let m = await read(id);
  expect(m).toMatchObject({ status: "DRAFT", rank: "C", clientNpcId: npcId, locationId }); expect(m.objectives[1].dependencies[0].prerequisiteId).toBe(m.objectives[0].id); expect(m.encounters[0].optional).toBe(true);
  await saveMission(campaignId, id, editForm(m, { title: "Umbenannt", rank: "S" })); m = await read(id); expect(m.title).toBe("Umbenannt"); expect(m.version).toBe(2); expect(m.objectives).toHaveLength(2);
  expect((await listMissions(campaignId, { q: "Umbenannt", rank: "S", status: "DRAFT" })).some(m => m.id === id)).toBe(true);
});
it("supports archival and only deletes confirmed drafts without history", async () => {
  const id = await saveMission(campaignId, null, form()); await expect(deleteMission(campaignId, id, 1, fd({ confirmation: "Testmission" }))).rejects.toThrow();
  await command(id, { kind: "ARCHIVE", archived: true }); expect((await listMissions(campaignId)).some(m => m.id === id)).toBe(false);
  await expect(deleteMission(campaignId, id, 2, fd({ confirmation: "wrong" }))).rejects.toThrow(); await deleteMission(campaignId, id, 2, fd({ confirmation: "Testmission" })); expect(await getDmMission(campaignId, id)).toBeNull();
});
it("validates status transitions and requires all mandatory objectives before completion", async () => {
  const id = await saveMission(campaignId, null, form());
  expect((await performMissionAction(campaignId, id, { requestId: randomUUID(), expectedVersion: 1, command: { kind: "STATUS", status: "COMPLETED" } })).ok).toBe(false);
  for (const status of ["AVAILABLE", "ACCEPTED", "ACTIVE"] as const) await command(id, { kind: "STATUS", status });
  await expect(command(id, { kind: "STATUS", status: "COMPLETED" })).rejects.toThrow("Pflichtziele");
  for (const o of (await read(id)).objectives) await command(id, { kind: "OBJECTIVE", objectiveId: o.id, status: "COMPLETED" });
  await command(id, { kind: "STATUS", status: "COMPLETED" }); expect((await read(id)).status).toBe("COMPLETED"); await expect(command(id, { kind: "STATUS", status: "ACTIVE" })).rejects.toThrow();
});
it("rejects cycles, self-dependencies, missing prerequisites and reused cross-mission IDs", async () => {
  const g = graph(); g[0].dependencyIds = [g[1].id]; await expect(saveMission(campaignId, null, form({}, g))).rejects.toThrow("Zyklen");
  const self = graph(); self[0].dependencyIds = [self[0].id]; await expect(saveMission(campaignId, null, form({}, self))).rejects.toThrow();
  const missing = graph(); missing[1].dependencyIds = ["foreign"]; await expect(saveMission(campaignId, null, form({}, missing))).rejects.toThrow();
  const a = await saveMission(campaignId, null, form()), old = await read(a); await expect(saveMission(campaignId, null, form({}, old.objectives.map(o => ({ ...o, dependencyIds: o.dependencies.map(d => d.prerequisiteId) })).map(({ id, title, description, playerVisible, optional, enabled, dependencyIds }) => ({ id, title, description, playerVisible, optional, enabled, dependencyIds }))))).rejects.toThrow();
});
it("enforces prerequisites, reset guards, disabled goals and optional skipping", async () => {
  const m = await activeMission(), [a, b] = m.objectives;
  await expect(command(m.id, { kind: "OBJECTIVE", objectiveId: b.id, status: "COMPLETED" })).rejects.toThrow("Voraussetzungen");
  await expect(command(m.id, { kind: "OBJECTIVE", objectiveId: a.id, status: "SKIPPED" })).rejects.toThrow();
  await command(m.id, { kind: "OBJECTIVE", objectiveId: a.id, status: "COMPLETED" }); await command(m.id, { kind: "OBJECTIVE", objectiveId: b.id, status: "ACTIVE" });
  await expect(command(m.id, { kind: "OBJECTIVE", objectiveId: a.id, status: "PENDING" })).rejects.toThrow();
  expect((await read(m.id)).objectives[0].status).toBe("COMPLETED");
});
it("preserves progress on graph edits and rejects stale saves or removing begun objectives", async () => {
  const m = await activeMission(); await command(m.id, { kind: "OBJECTIVE", objectiveId: m.objectives[0].id, status: "COMPLETED" });
  await expect(saveMission(campaignId, m.id, editForm(m))).rejects.toThrow("inzwischen"); const fresh = await read(m.id); await saveMission(campaignId, m.id, editForm(fresh, { title: "Fortschritt bleibt" })); expect((await read(m.id)).objectives[0].status).toBe("COMPLETED");
  const f = editForm(await read(m.id)); f.set("objectives", "[]"); await expect(saveMission(campaignId, m.id, f)).rejects.toThrow("Begonnene");
});
it("prepares consequences without changing targets, then confirms and audits exactly once", async () => {
  const m = await activeMission(), before = await database.client.npc.findUniqueOrThrow({ where: { id: npcId } }); const c = await prepare(m.id);
  expect(await database.client.npc.findUnique({ where: { id: npcId } })).toEqual(before);
  const fresh = await read(m.id), requestId = randomUUID(), payload = { requestId, expectedVersion: fresh.version, command: { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true, targetUpdatedAt: before.updatedAt.toISOString(), targetAttitude: before.attitude } };
  expect((await performMissionAction(campaignId, m.id, payload)).ok).toBe(true); expect((await performMissionAction(campaignId, m.id, payload)).ok).toBe(true);
  expect((await database.client.npc.findUniqueOrThrow({ where: { id: npcId } })).attitude).toBe("FRIENDLY");
  const logs = await database.client.missionConsequenceApplication.findMany({ where: { consequenceId: c.id } }); expect(logs).toHaveLength(1); expect(logs[0]).toMatchObject({ actorSessionId: "dm-access", before: { attitude: before.attitude }, after: { attitude: "FRIENDLY" } });
  await command(m.id, { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true }); expect(await database.client.missionConsequenceApplication.count({ where: { consequenceId: c.id } })).toBe(1);
  await expect(removeMissionConsequence(campaignId, m.id, c.id, (await read(m.id)).version)).rejects.toThrow();
});
it("rejects consequence confirmation against changed NPCs and changed source versions", async () => {
  const m = await activeMission(), c = await prepare(m.id), npc = await database.client.npc.findUniqueOrThrow({ where: { id: npcId } });
  await database.client.npc.update({ where: { id: npcId }, data: { attitude: "HOSTILE", updatedAt: new Date(npc.updatedAt.getTime() + 1000) } });
  await expect(command(m.id, { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true, targetUpdatedAt: npc.updatedAt.toISOString(), targetAttitude: npc.attitude })).rejects.toThrow("Ziel");
  expect(await database.client.missionConsequenceApplication.count({ where: { consequenceId: c.id } })).toBe(0);
});
it("changes faction attitude through an explicit confirmed action", async () => {
  const m = await activeMission(), c = await prepare(m.id, { kind: "ORGANIZATION_ATTITUDE", npcId: "", organizationId, value: "HOSTILE" }), org = await database.client.organization.findUniqueOrThrow({ where: { id: organizationId } });
  await command(m.id, { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true, targetUpdatedAt: org.updatedAt.toISOString(), targetAttitude: org.attitude }); expect((await database.client.organization.findUniqueOrThrow({ where: { id: organizationId } })).attitude).toBe("HOSTILE");
});
it("unlocks another mission with target version checks and explicit player release", async () => {
  const m = await activeMission(), target = await saveMission(campaignId, null, form({ playerVisible: "" }));
  const c = await prepare(m.id, { kind: "UNLOCK_MISSION", npcId: "", targetMissionId: target, value: "" });
  await expect(command(m.id, { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true, targetVersion: 999 })).rejects.toThrow();
  await command(m.id, { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true, targetVersion: 1 }); expect(await read(target)).toMatchObject({ status: "AVAILABLE", playerVisible: true, version: 2 });
});
it("reveals only the expressly entered information and does not copy DM secrets", async () => {
  const m = await activeMission(), c = await prepare(m.id, { kind: "REVEAL_INFORMATION", npcId: "", targetMissionId: m.id, value: "SHARED_INFORMATION" });
  await command(m.id, { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true }); const result = await getPlayerMission(campaignId, m.id);
  expect(result?.publicInformation).toContain("SHARED_INFORMATION"); expect(output(result)).not.toContain("PRIVATE_DM_NOTES");
});
it("unlocks optional alternative objectives but retains their dependency guards", async () => {
  const g = graph(); g[1].enabled = false; g[1].optional = true;
  const m = await activeMission(form({}, g)); await expect(command(m.id, { kind: "OBJECTIVE", objectiveId: g[1].id, status: "COMPLETED" })).rejects.toThrow();
  const c = await prepare(m.id, { kind: "UNLOCK_OBJECTIVE", npcId: "", objectiveId: g[1].id, value: "" }); await command(m.id, { kind: "CONSEQUENCE", consequenceId: c.id, confirmed: true });
  await expect(command(m.id, { kind: "OBJECTIVE", objectiveId: g[1].id, status: "COMPLETED" })).rejects.toThrow("Voraussetzungen");
  await command(m.id, { kind: "OBJECTIVE", objectiveId: g[1].id, status: "SKIPPED" }); expect((await read(m.id)).objectives[1].status).toBe("SKIPPED");
});
it("deduplicates status/objective requests and rejects altered payloads", async () => {
  const m = await activeMission(), request = { requestId: randomUUID(), expectedVersion: m.version, command: { kind: "OBJECTIVE", objectiveId: m.objectives[0].id, status: "COMPLETED" } };
  expect((await performMissionAction(campaignId, m.id, request)).ok).toBe(true); const after = await read(m.id); expect((await performMissionAction(campaignId, m.id, request)).ok).toBe(true); expect(await read(m.id)).toEqual(after);
  expect((await performMissionAction(campaignId, m.id, { ...request, command: { ...request.command, status: "FAILED" } })).ok).toBe(false);
});
it("serializes parallel actions against the same mission version", async () => {
  const m = await activeMission(); const results = await Promise.all([randomUUID(), randomUUID()].map(requestId => performMissionAction(campaignId, m.id, { requestId, expectedVersion: m.version, command: { kind: "OBJECTIVE", objectiveId: m.objectives[0].id, status: "COMPLETED" } }))); expect(results.filter(r => r.ok)).toHaveLength(1);
});
it("serves players only published information and visible objectives/NPCs/locations", async () => {
  const f = form({ clientNpcId: hiddenNpc, locationId: hiddenLocation, encounters: JSON.stringify([{ id: randomUUID(), encounterId, optional: false }]) }); f.append("npcIds", npcId); f.append("npcIds", hiddenNpc);
  const m = await activeMission(f); await prepare(m.id); player(); const data = await getPlayerMission(campaignId, m.id), rendered = output(await MissionPage({ params: Promise.resolve({ campaignId, missionId: m.id }) }));
  for (const secret of ["PRIVATE_DESCRIPTION", "PRIVATE_DM_NOTES", "SECRET_OBJECTIVE", "SECRET_DESCRIPTION", "SECRET_NPC", "SECRET_LOCATION", "SECRET_ENCOUNTER", "ENCOUNTER_SECRET", "targetUpdatedAt"]) { expect(output(data)).not.toContain(secret); expect(rendered).not.toContain(secret); }
  expect(data?.objectives).toHaveLength(1); expect(data?.clientNpc).toBeNull(); expect(data?.location).toBeNull(); expect(data?.npcs.map(n => n.name)).toEqual(["Mika"]);
});
it("hides drafts, unpublished and archived missions in direct URLs and boards", async () => {
  const draft = await saveMission(campaignId, null, form({ title: "SECRET_DRAFT" })), hidden = await activeMission(form({ title: "SECRET_HIDDEN", playerVisible: "" })), archived = await activeMission(form({ title: "SECRET_ARCHIVE" })); await command(archived.id, { kind: "ARCHIVE", archived: true }); player();
  for (const id of [draft, hidden.id, archived.id]) { expect(await getPlayerMission(campaignId, id)).toBeNull(); await expect(MissionPage({ params: Promise.resolve({ campaignId, missionId: id }) })).rejects.toThrow("NOT_FOUND"); }
  const rendered = output(await MissionBoard({ params: Promise.resolve({ campaignId }), searchParams: Promise.resolve({}) })); for (const secret of ["SECRET_DRAFT", "SECRET_HIDDEN", "SECRET_ARCHIVE"]) expect(rendered).not.toContain(secret);
});
it("allows players to accept published available missions, with no other mutation rights", async () => {
  const id = await saveMission(campaignId, null, form()); await command(id, { kind: "STATUS", status: "AVAILABLE" }); const m = await read(id); player();
  expect((await performMissionAction(campaignId, id, { requestId: randomUUID(), expectedVersion: m.version, command: { kind: "STATUS", status: "ACCEPTED" } })).ok).toBe(true);
  for (const command of [{ kind: "STATUS", status: "ACTIVE" }, { kind: "ARCHIVE", archived: true }, { kind: "OBJECTIVE", objectiveId: m.objectives[0].id, status: "COMPLETED" }] as MissionCommand[]) expect((await performMissionAction(campaignId, id, { requestId: randomUUID(), expectedVersion: m.version + 1, command })).ok).toBe(false);
  await expect(saveMission(campaignId, null, form())).rejects.toThrow("Unauthorized");
});
it("atomically starts a snapshotted Encounter Run from a mission without changing its template", async () => {
  const linkId = randomUUID(), m = await activeMission(form({ encounters: JSON.stringify([{ id: linkId, encounterId, optional: true }]) })); const templateBefore = await database.client.encounter.findUnique({ where: { id: encounterId } });
  const request = { requestId: randomUUID(), expectedVersion: m.version, command: { kind: "START_ENCOUNTER", linkId, encounterVersion: 1 } };
  const result = await performMissionAction(campaignId, m.id, request); expect(result.ok).toBe(true); await performMissionAction(campaignId, m.id, request); const after = await read(m.id); expect(after.runs).toHaveLength(1); expect(after.runs[0].missionEncounterId).toBe(linkId); expect(await database.client.encounter.findUnique({ where: { id: encounterId } })).toEqual(templateBefore);
});
it("assigns multiple missions and existing runs to a session idempotently", async () => {
  const session = await newSession(), a = await saveMission(campaignId, null, form()), b = await saveMission(campaignId, null, form());
  await setSessionContent(campaignId, session.id, 1, fd({ kind: "MISSION", id: a, assigned: "true" })); await setSessionContent(campaignId, session.id, 1, fd({ kind: "MISSION", id: a, assigned: "true" }));
  await expect(setSessionContent(campaignId, session.id, 1, fd({ kind: "MISSION", id: b, assigned: "true" }))).rejects.toThrow("inzwischen"); await setSessionContent(campaignId, session.id, 2, fd({ kind: "MISSION", id: b, assigned: "true" }));
  const dashboard = await getSessionDashboard(campaignId, session.id); expect(dashboard?.missions).toHaveLength(2);
});
it("starts an Encounter Run inside an assigned GameSession and rolls back invalid session starts", async () => {
  const linkId = randomUUID(), m = await activeMission(form({ encounters: JSON.stringify([{ id: linkId, encounterId, optional: false }]) })), session = await newSession();
  await setSessionContent(campaignId, session.id, session.version, fd({ kind: "MISSION", id: m.id, assigned: "true" }));
  await expect(command(m.id, { kind: "START_ENCOUNTER", linkId, encounterVersion: 1, sessionId: session.id, sessionVersion: 1 })).rejects.toThrow(); expect((await read(m.id)).runs).toHaveLength(0);
  await command(m.id, { kind: "START_ENCOUNTER", linkId, encounterVersion: 1, sessionId: session.id, sessionVersion: 2 }); const dashboard = await getSessionDashboard(campaignId, session.id); expect(dashboard?.role === "DM" && dashboard.session.encounterRunLinks).toHaveLength(1);
  const runId = (await read(m.id)).runs[0].runId; await setSessionContent(campaignId, session.id, 3, fd({ kind: "RUN", id: runId, assigned: "false" })); expect(await database.client.encounterRun.findUnique({ where: { id: runId } })).not.toBeNull();
});
it("filters hidden missions, objectives, NPCs, runs and DM notes from session projections", async () => {
  const visible = await activeMission(), hidden = await activeMission(form({ playerVisible: "", title: "SECRET_SESSION_MISSION" })), session = await newSession();
  await setSessionContent(campaignId, session.id, 1, fd({ kind: "MISSION", id: visible.id, assigned: "true" })); await setSessionContent(campaignId, session.id, 2, fd({ kind: "MISSION", id: hidden.id, assigned: "true" })); player();
  const d = await getSessionDashboard(campaignId, session.id); expect(d?.missions).toHaveLength(1); for (const secret of ["SESSION_SECRET", "SECRET_SESSION_MISSION", "SECRET_OBJECTIVE", "PRIVATE_DM_NOTES", "encounterRunLinks"]) expect(output(d)).not.toContain(secret);
});
it("protects session note editing with role, valid status and version checks", async () => {
  const session = await newSession(); const f = fd({ title: "Edited", summary: "Public", playerNotes: "For players", dmNotes: "PRIVATE_UPDATED", status: "ACTIVE", version: "1" }); await updateGameSession(campaignId, session.id, f);
  await expect(updateGameSession(campaignId, session.id, f)).rejects.toThrow(); const edited = await database.client.gameSession.findUniqueOrThrow({ where: { id: session.id } }); expect(edited).toMatchObject({ title: "Edited", version: 2, dmNotes: "PRIVATE_UPDATED" });
});
it("seeds six global blueprints idempotently without changing campaigns", async () => {
  const counts = await Promise.all([database.client.mission.count(), database.client.npc.count(), database.client.location.count(), database.client.encounter.count()]);
  expect(await seedMissions(database.client)).toBe(6); const before = await database.client.missionTemplate.findMany({ orderBy: { seedKey: "asc" } }); await seedMissions(database.client); expect(await database.client.missionTemplate.findMany({ orderBy: { seedKey: "asc" } })).toEqual(before); expect(before.map(b => b.rank).sort()).toEqual(["A", "B", "C", "C", "D", "D"]); expect(await Promise.all([database.client.mission.count(), database.client.npc.count(), database.client.location.count(), database.client.encounter.count()])).toEqual(counts);
});
it("explicitly imports all six missions with objectives and references; repeated import preserves progress", async () => {
  await seedMissions(database.client); const npcBefore = await database.client.npc.findUnique({ where: { id: npcId } });
  for (const template of await listMissionTemplates(campaignId)) {
    const id = await importMissionTemplate(campaignId, template.id), imported = await read(id); expect(imported.status).toBe("DRAFT"); expect(imported.playerVisible).toBe(false); expect(imported.objectives.length).toBeGreaterThanOrEqual(3); expect(imported.encounters.length).toBeGreaterThan(0);
    const before = await read(id); expect(await importMissionTemplate(campaignId, template.id)).toBe(id); expect(await read(id)).toEqual(before);
  }
  expect(await database.client.npc.findUnique({ where: { id: npcId } })).toEqual(npcBefore); expect(await database.client.mission.count({ where: { sourceTemplateId: { not: null }, campaignId } })).toBe(6);
  expect(missionSeeds).toHaveLength(6);
});
it("prevents cross-campaign references, objective mutations and GameSession assignments", async () => {
  const patches: Record<string, string>[] = [{ clientNpcId: foreignNpc }, { locationId: foreignLocation }, { encounters: JSON.stringify([{ id: randomUUID(), encounterId: foreignEncounter, optional: false }]) }];
  for (const patch of patches) await expect(saveMission(campaignId, null, form(patch))).rejects.toThrow();
  const foreign = await database.client.mission.create({ data: { campaignId: foreignId, title: "Foreign", rank: "C" } }), session = await newSession();
  expect(await getDmMission(campaignId, foreign.id)).toBeNull(); await expect(saveMission(campaignId, foreign.id, form())).rejects.toThrow(); await expect(setSessionContent(campaignId, session.id, 1, fd({ kind: "MISSION", id: foreign.id, assigned: "true" }))).rejects.toThrow();
  const m = await activeMission(); await expect(prepare(m.id, { npcId: foreignNpc })).rejects.toThrow(); await expect(command(m.id, { kind: "OBJECTIVE", objectiveId: randomUUID(), status: "COMPLETED" })).rejects.toThrow();
});
it("requires DM authorization for all builder and template/session operations", async () => {
  player(); for (const op of [() => getDmMission(campaignId, "id"), () => missionOptions(campaignId), () => listMissionTemplates(campaignId), () => saveMission(campaignId, null, form()), () => saveMissionConsequence(campaignId, "id", null, 1, fd({})), () => removeMissionConsequence(campaignId, "id", "c", 1), () => deleteMission(campaignId, "id", 1, fd({})), () => importMissionTemplate(campaignId, "id"), () => setSessionContent(campaignId, "s", 1, fd({})), () => NewMission({ params: Promise.resolve({ campaignId }) })]) await expect(op()).rejects.toThrow("Unauthorized");
  await expect(getPlayerMission(foreignId, "id")).rejects.toThrow("Unauthorized"); expect(await database.client.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
});
it("offers only own active work in the DM dashboard and rejects players", async () => {
  const m = await activeMission();
  const own = await database.client.gameSession.create({ data: { campaignId, title: "Dashboard session", number: 88, status: "ACTIVE" } });
  await database.client.gameSession.create({ data: { campaignId: foreignId, title: "FOREIGN_SECRET", number: 89, status: "ACTIVE" } });
  await database.client.mission.create({ data: { campaignId: foreignId, title: "FOREIGN_SECRET", rank: "S", status: "ACTIVE" } });
  const dashboard = await getDmDashboard(campaignId);
  expect(dashboard.sessions[0].id).toBe(own.id); expect(dashboard.missions.some(x => x.id === m.id)).toBe(true);
  expect(JSON.stringify(dashboard)).not.toContain("FOREIGN_SECRET"); expect(JSON.stringify(dashboard)).not.toContain("PRIVATE_DM_NOTES");
  player(); await expect(getDmDashboard(campaignId)).rejects.toThrow("Unauthorized");
});
it("creates a session after the highest number and validates inputs before writing", async () => {
  const highest = (await database.client.gameSession.aggregate({ where: { campaignId }, _max: { number: true } }))._max.number ?? 0;
  const id = await createGameSession(campaignId, fd({ title: "Neue Vorbereitung", dmNotes: "Secret" }));
  expect(await database.client.gameSession.findUnique({ where: { id } })).toMatchObject({ number: highest + 1, dmNotes: "Secret", status: "PLANNED" });
  await expect(createGameSession(campaignId, fd({ title: " " }))).rejects.toThrow();
  player(); await expect(createGameSession(campaignId, fd({ title: "Forbidden" }))).rejects.toThrow("Unauthorized");
});
