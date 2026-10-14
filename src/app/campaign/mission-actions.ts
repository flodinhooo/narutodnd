"use server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { EncounterError, formText, formJson, encounterVersion } from "@/lib/encounters";
import { missionInputSchema, consequenceInputSchema, missionRequestSchema, validateMission, type MissionActionResult } from "@/lib/missions";
import { validateObjectiveGraph, assertMissionTransition, assertObjectiveChange, missionCanComplete, missionIsTerminal } from "@/lib/rules/missions";
import { loadMission, lockMission } from "@/lib/mission-write";
import { createEncounterRun } from "@/lib/encounter-run-start";
import { applyMissionConsequence } from "@/lib/mission-consequences";

const refresh = (campaignId: string) => revalidatePath(`/campaign/${campaignId}`, "layout");
export async function saveMission(campaignId: string, id: string | null, fd: FormData) {
  await requireCampaign(campaignId, true);
  const input = validateMission(missionInputSchema, { title: formText(fd, "title"), rank: formText(fd, "rank"), description: formText(fd, "description"), publicInformation: formText(fd, "publicInformation"), rewards: formText(fd, "rewards"), dmNotes: formText(fd, "dmNotes"), playerVisible: formText(fd, "playerVisible") === "on", clientNpcId: formText(fd, "clientNpcId") || null, locationId: formText(fd, "locationId") || null, npcIds: fd.getAll("npcIds").map(String), objectives: formJson(fd, "objectives"), encounters: formJson(fd, "encounters") });
  validateObjectiveGraph(input.objectives);
  if (new Set(input.npcIds).size !== input.npcIds.length || new Set(input.encounters.map(e => e.id)).size !== input.encounters.length) throw new EncounterError("Doppelte Verknüpfungen.");
  const result = await prisma.$transaction(async tx => {
    const npcIds = [...new Set([...input.npcIds, ...(input.clientNpcId ? [input.clientNpcId] : [])])];
    if (await tx.npc.count({ where: { id: { in: npcIds }, campaignId, archived: false } }) !== npcIds.length) throw new EncounterError("NPC nicht verfügbar oder kampagnenfremd.");
    if (input.locationId && !await tx.location.findFirst({ where: { id: input.locationId, campaignId } })) throw new EncounterError("Ort gehört nicht zu dieser Kampagne.");
    const encounterIds = [...new Set(input.encounters.map(e => e.encounterId))];
    if (await tx.encounter.count({ where: { id: { in: encounterIds }, campaignId, status: { not: "ARCHIVED" } } }) !== encounterIds.length) throw new EncounterError("Encounter nicht verfügbar oder kampagnenfremd.");
    const old = id ? await loadMission(tx, campaignId, id) : null;
    if (old && (old.archived || missionIsTerminal(old.status))) throw new EncounterError("Archivierte und beendete Missionen sind im Builder schreibgeschützt.");
    for (const o of input.objectives) { const existing = await tx.missionObjective.findUnique({ where: { id: o.id }, select: { missionId: true } }); if (existing && existing.missionId !== id) throw new EncounterError("Ziel-ID gehört zu einer anderen Mission."); }
    for (const e of input.encounters) { const existing = await tx.missionEncounter.findUnique({ where: { id: e.id }, select: { missionId: true } }); if (existing && existing.missionId !== id) throw new EncounterError("Encounter-Verknüpfung gehört zu einer anderen Mission."); }
    if (old) {
      for (const link of input.encounters) if (old.runs.some(r => r.missionEncounterId === link.id) && old.encounters.find(e => e.id === link.id)?.encounterId !== link.encounterId) throw new EncounterError("Encounter-Verknüpfungen mit Runs können nicht ersetzt werden. Einen neuen Eintrag hinzufügen.");
      for (const objective of old.objectives) if (!input.objectives.some(o => o.id === objective.id) && objective.status !== "PENDING") throw new EncounterError("Begonnene Ziele dürfen nicht entfernt werden.");
      const graph = input.objectives.map(o => ({ ...o, status: old.objectives.find(p => p.id === o.id)?.status ?? "PENDING" as const }));
      for (const objective of graph.filter(o => ["ACTIVE", "COMPLETED"].includes(o.status))) {
        if (!objective.enabled) throw new EncounterError("Begonnene Ziele dürfen nicht gesperrt werden.");
        assertObjectiveChange(graph, objective.id, objective.status);
      }
      await lockMission(tx, campaignId, old.id, encounterVersion(formText(fd, "version")));
    }
    const { objectives, npcIds: selectedNpcs, encounters, ...data } = input;
    const mission = old ? await tx.mission.update({ where: { id: old.id }, data }) : await tx.mission.create({ data: { ...data, campaignId } });
    const missionId = mission.id;
    await tx.missionObjectiveDependency.deleteMany({ where: { objective: { missionId } } });
    await tx.missionObjective.deleteMany({ where: { missionId, id: { notIn: objectives.map(o => o.id) } } });
    for (const [position, o] of objectives.entries()) {
      const { dependencyIds: _deps, ...fields } = o; void _deps;
      await tx.missionObjective.upsert({ where: { id: o.id }, create: { ...fields, position, missionId }, update: { ...fields, position } });
    }
    for (const o of objectives) for (const prerequisiteId of o.dependencyIds) await tx.missionObjectiveDependency.create({ data: { objectiveId: o.id, prerequisiteId } });
    await tx.missionNpc.deleteMany({ where: { missionId } });
    for (const npcId of selectedNpcs) await tx.missionNpc.create({ data: { missionId, npcId } });
    await tx.missionEncounter.deleteMany({ where: { missionId, id: { notIn: encounters.map(e => e.id) } } });
    for (const [position, e] of encounters.entries()) await tx.missionEncounter.upsert({ where: { id: e.id }, create: { ...e, missionId, position }, update: { encounterId: e.encounterId, optional: e.optional, position } });
    return missionId;
  });
  refresh(campaignId); return result;
}

export async function saveMissionConsequence(campaignId: string, missionId: string, id: string | null, version: number, fd: FormData) {
  await requireCampaign(campaignId, true);
  const input = validateMission(consequenceInputSchema, { title: formText(fd, "title"), description: formText(fd, "description"), kind: formText(fd, "kind"), npcId: formText(fd, "npcId") || null, organizationId: formText(fd, "organizationId") || null, targetMissionId: formText(fd, "targetMissionId") || null, objectiveId: formText(fd, "objectiveId") || null, value: formText(fd, "value") });
  await prisma.$transaction(async tx => {
    const m = await loadMission(tx, campaignId, missionId);
    if (m.archived) throw new EncounterError("Mission zuerst wiederherstellen.");
    if (id && !m.consequences.some(c => c.id === id && !c.application)) throw new EncounterError("Konsequenz fehlt oder wurde bereits angewendet.");
    if (input.npcId && !await tx.npc.findFirst({ where: { id: input.npcId, campaignId, archived: false } })) throw new EncounterError("NPC nicht verfügbar.");
    if (input.organizationId && !await tx.organization.findFirst({ where: { id: input.organizationId, campaignId, archived: false } })) throw new EncounterError("Organisation nicht verfügbar.");
    if (input.targetMissionId && !await tx.mission.findFirst({ where: { id: input.targetMissionId, campaignId, archived: false } })) throw new EncounterError("Zielmission nicht verfügbar.");
    if (input.kind === "UNLOCK_MISSION" && input.targetMissionId === missionId) throw new EncounterError("Eine Mission kann sich nicht selbst freischalten.");
    if (input.objectiveId && !m.objectives.some(o => o.id === input.objectiveId)) throw new EncounterError("Ziel gehört nicht zu dieser Mission.");
    await lockMission(tx, campaignId, missionId, encounterVersion(version));
    if (id) await tx.missionConsequence.update({ where: { id, missionId }, data: input }); else await tx.missionConsequence.create({ data: { ...input, missionId } });
  }); refresh(campaignId);
}
export async function removeMissionConsequence(campaignId: string, missionId: string, id: string, version: number) {
  await requireCampaign(campaignId, true);
  await prisma.$transaction(async tx => { const m = await loadMission(tx, campaignId, missionId); if (!m.consequences.some(c => c.id === id && !c.application) || m.archived) throw new EncounterError("Konsequenz nicht löschbar."); await lockMission(tx, campaignId, missionId, encounterVersion(version)); await tx.missionConsequence.delete({ where: { id, missionId } }); }); refresh(campaignId);
}
export async function deleteMission(campaignId: string, missionId: string, version: number, fd: FormData) {
  await requireCampaign(campaignId, true);
  await prisma.$transaction(async tx => {
    const m = await loadMission(tx, campaignId, missionId);
    if (!m.archived || m.status !== "DRAFT" || formText(fd, "confirmation") !== m.title || m.runs.length || m.sessions.length || m.consequences.some(c => c.application)) throw new EncounterError("Nur archivierte Entwürfe ohne Historie können mit Namensbestätigung gelöscht werden.");
    if (await tx.missionConsequence.count({ where: { targetMissionId: missionId, missionId: { not: missionId } } })) throw new EncounterError("Mission wird von einer Konsequenz referenziert.");
    await lockMission(tx, campaignId, missionId, encounterVersion(version)); await tx.mission.delete({ where: { id: missionId } });
  }); refresh(campaignId);
}
export async function performMissionAction(campaignId: string, missionId: string, submitted: unknown): Promise<MissionActionResult> {
  const actor = await requireCampaign(campaignId);
  try {
    const request = validateMission(missionRequestSchema, submitted), c = request.command;
    if (actor.role !== "DM" && !(c.kind === "STATUS" && c.status === "ACCEPTED")) throw new EncounterError("Diese Aktion erfordert DM-Rechte.");
    const hash = createHash("sha256").update(JSON.stringify(request)).digest("hex");
    const resultId = await prisma.$transaction(async tx => {
      const m = await loadMission(tx, campaignId, missionId);
      if (actor.role !== "DM" && (!m.playerVisible || m.archived || m.status === "DRAFT")) throw new EncounterError("Mission nicht verfügbar.");
      const prior = await tx.missionAction.findUnique({ where: { missionId_requestId: { missionId, requestId: request.requestId } } });
      if (prior) { if (prior.payloadHash !== hash) throw new EncounterError("Request-ID bereits anders verwendet."); return prior.resultId; }
      if (m.archived && c.kind !== "ARCHIVE") throw new EncounterError("Mission ist archiviert.");
      await lockMission(tx, campaignId, missionId, request.expectedVersion);
      let resultId: string | null = null;
      if (c.kind === "STATUS") {
        assertMissionTransition(m.status, c.status);
        if (actor.role !== "DM" && m.status !== "AVAILABLE") throw new EncounterError("Nur verfügbare Missionen können angenommen werden.");
        if (c.status === "COMPLETED" && !missionCanComplete(m.objectives)) throw new EncounterError("Zuerst alle Pflichtziele erfüllen.");
        await tx.mission.update({ where: { id: missionId }, data: { status: c.status } });
      } else if (c.kind === "OBJECTIVE") {
        if (m.status !== "ACTIVE") throw new EncounterError("Ziele können nur während einer aktiven Mission geändert werden.");
        assertObjectiveChange(m.objectives.map(o => ({ ...o, dependencyIds: o.dependencies.map(d => d.prerequisiteId) })), c.objectiveId, c.status);
        await tx.missionObjective.update({ where: { id: c.objectiveId, missionId }, data: { status: c.status } });
      } else if (c.kind === "ARCHIVE") await tx.mission.update({ where: { id: missionId }, data: { archived: c.archived } });
      else if (c.kind === "CONSEQUENCE") {
        if (!["ACTIVE", "COMPLETED", "FAILED", "CANCELLED"].includes(m.status)) throw new EncounterError("Konsequenzen erst während oder nach der Durchführung bestätigen.");
        await applyMissionConsequence(tx, campaignId, m, c, actor.id);
      } else if (c.kind === "START_ENCOUNTER") {
        if (m.status !== "ACTIVE") throw new EncounterError("Zuerst Mission starten.");
        const link = m.encounters.find(e => e.id === c.linkId); if (!link) throw new EncounterError("Encounter gehört nicht zu dieser Mission.");
        resultId = await createEncounterRun(tx, campaignId, link.encounterId, c.encounterVersion, request.requestId);
        await tx.missionEncounterRun.create({ data: { missionId, runId: resultId, missionEncounterId: link.id } });
        if (c.sessionId) {
          const session = await tx.gameSession.findFirst({ where: { id: c.sessionId, campaignId, status: { not: "COMPLETED" } } });
          if (!session || session.version !== c.sessionVersion || !await tx.sessionMission.findUnique({ where: { sessionId_missionId: { sessionId: session.id, missionId } } })) throw new EncounterError("Session nicht verfügbar, veraltet oder Mission nicht zugeordnet.");
          await tx.gameSession.update({ where: { id: session.id, version: session.version }, data: { version: { increment: 1 } } });
          await tx.sessionEncounterRun.create({ data: { sessionId: session.id, runId: resultId } });
        }
      }
      await tx.missionAction.create({ data: { missionId, requestId: request.requestId, payloadHash: hash, kind: c.kind, resultId } }); return resultId;
    }, { timeout: 30000 });
    refresh(campaignId); return { ok: true, ...(resultId ? { url: `/campaign/${campaignId}/encounters/runs/${resultId}` } : {}) };
  } catch (error) {
    if (error instanceof EncounterError) return { ok: false, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2028", "P1008", "P2002", "P2025"].includes(error.code)) return { ok: false, error: "Gleichzeitige Änderung erkannt. Bitte neu laden." };
    throw error;
  }
}
