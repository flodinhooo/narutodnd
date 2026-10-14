import type { Prisma } from "@prisma/client";
import { EncounterError } from "./encounters";
import { lockMission } from "./mission-write";
import type { DmMission } from "./mission-library";
import type { MissionCommand } from "./missions";

export async function applyMissionConsequence(tx: Prisma.TransactionClient, campaignId: string, mission: DmMission, command: Extract<MissionCommand, { kind: "CONSEQUENCE" }>, actorSessionId: string) {
  const c = mission.consequences.find(c => c.id === command.consequenceId);
  if (!c) throw new EncounterError("Konsequenz gehört nicht zu dieser Mission.");
  if (c.application) return;
  let before: Prisma.InputJsonObject = {}, after: Prisma.InputJsonObject = {};
  if (c.kind === "NPC_ATTITUDE" || c.kind === "ORGANIZATION_ATTITUDE") {
    const target = c.kind === "NPC_ATTITUDE" ? await tx.npc.findFirst({ where: { id: c.npcId!, campaignId, archived: false } }) : await tx.organization.findFirst({ where: { id: c.organizationId!, campaignId, archived: false } });
    if (!target || target.updatedAt.toISOString() !== command.targetUpdatedAt || target.attitude !== command.targetAttitude) throw new EncounterError("Ziel wurde inzwischen geändert. Konsequenz erneut prüfen.");
    before = { id: target.id, name: target.name, attitude: target.attitude };
    after = { ...before, attitude: c.value };
    const where = { id: target.id, campaignId, updatedAt: target.updatedAt, attitude: target.attitude };
    const updated = c.kind === "NPC_ATTITUDE" ? await tx.npc.updateMany({ where, data: { attitude: c.value } }) : await tx.organization.updateMany({ where, data: { attitude: c.value } });
    if (updated.count !== 1) throw new EncounterError("Ziel wurde inzwischen geändert.");
  } else if (c.kind === "UNLOCK_OBJECTIVE") {
    const target = mission.objectives.find(o => o.id === c.objectiveId);
    if (!target || target.status !== "PENDING") throw new EncounterError("Alternatives Ziel ist nicht verfügbar.");
    before = { id: target.id, title: target.title, enabled: target.enabled }; after = { ...before, enabled: true };
    await tx.missionObjective.update({ where: { id: target.id, missionId: mission.id }, data: { enabled: true } });
  } else {
    const target = await tx.mission.findFirst({ where: { id: c.targetMissionId!, campaignId, archived: false } });
    if (!target) throw new EncounterError("Zielmission nicht verfügbar.");
    if (target.id !== mission.id) await lockMission(tx, campaignId, target.id, command.targetVersion ?? 0);
    if (c.kind === "UNLOCK_MISSION") {
      if (target.id === mission.id || target.status !== "DRAFT") throw new EncounterError("Nur andere Missionsentwürfe können freigeschaltet werden.");
      before = { id: target.id, title: target.title, status: target.status, playerVisible: target.playerVisible }; after = { ...before, status: "AVAILABLE", playerVisible: true };
      await tx.mission.update({ where: { id: target.id }, data: { status: "AVAILABLE", playerVisible: true } });
    } else {
      const publicInformation = [target.publicInformation, c.value].filter(Boolean).join("\n\n");
      if (publicInformation.length > 10000) throw new EncounterError("Öffentliche Informationen würden zu lang.");
      before = { id: target.id, title: target.title, publicInformation: target.publicInformation }; after = { ...before, publicInformation };
      await tx.mission.update({ where: { id: target.id }, data: { publicInformation } });
    }
  }
  await tx.missionConsequenceApplication.create({ data: { missionId: mission.id, consequenceId: c.id, actorSessionId, kind: c.kind, title: c.title, before, after } });
}
