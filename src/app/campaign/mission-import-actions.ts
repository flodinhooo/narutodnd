"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { EncounterError } from "@/lib/encounters";
import { missionBlueprintSchema } from "../../../seeding/missions";

export async function importMissionTemplate(campaignId: string, templateId: string) {
  await requireCampaign(campaignId, true);
  const id = await prisma.$transaction(async tx => {
    const prior = await tx.mission.findUnique({ where: { campaignId_sourceTemplateId: { campaignId, sourceTemplateId: templateId } } }); if (prior) return prior.id;
    const template = await tx.missionTemplate.findUnique({ where: { id: templateId } }); if (!template) throw new EncounterError("Missionsvorlage nicht verfügbar.");
    const b = missionBlueprintSchema.parse(template.blueprint);
    const locations = await tx.location.findMany({ where: { campaignId, name: b.location.name } });
    const location = locations.length === 1 ? locations[0] : await tx.location.create({ data: { campaignId, name: b.location.name, slug: `${b.location.slug}-${randomUUID().slice(0, 8)}`, type: "LANDMARK", description: "Importierter Schauplatz einer Missionsvorlage.", playerVisible: false } });
    const npcMap = new Map<string, string>();
    for (const n of b.npcs) {
      const existing = await tx.npc.findMany({ where: { campaignId, name: n.name, archived: false } });
      const npc = existing.length === 1 ? existing[0] : await tx.npc.create({ data: { campaignId, name: n.name, category: n.category, description: n.description, locationId: location.id, playerVisible: false } }); npcMap.set(n.key, npc.id);
    }
    const mission = await tx.mission.create({ data: { campaignId, sourceTemplateId: templateId, title: b.title, rank: b.rank, description: b.description, publicInformation: b.publicInformation, dmNotes: b.dmNotes, rewards: b.rewards, clientNpcId: npcMap.get(b.clientNpcKey), locationId: location.id, npcs: { create: [...npcMap.values()].map(npcId => ({ npcId })) } } });
    const objectiveMap = new Map(b.objectives.map(o => [o.id, randomUUID()]));
    for (const [position, o] of b.objectives.entries()) await tx.missionObjective.create({ data: { id: objectiveMap.get(o.id)!, missionId: mission.id, title: o.title, description: o.description, position, playerVisible: o.playerVisible, optional: o.optional, enabled: o.enabled } });
    for (const o of b.objectives) for (const dep of o.dependencyIds) await tx.missionObjectiveDependency.create({ data: { objectiveId: objectiveMap.get(o.id)!, prerequisiteId: objectiveMap.get(dep)! } });
    for (const [position, e] of b.encounters.entries()) {
      const encounter = await tx.encounter.create({ data: { campaignId, name: e.name, type: e.type, difficulty: e.difficulty, description: e.description, dmNotes: b.dmNotes, locationId: location.id, status: "READY" } });
      for (const group of e.enemies) {
        const enemy = await tx.enemyTemplate.findUnique({ where: { seedKey: group.seedKey } });
        if (!enemy || enemy.campaignId !== null || enemy.archived) throw new EncounterError("Bestiary-Vorlage fehlt oder ist archiviert.");
        await tx.encounterParticipantPlan.create({ data: { encounterId: encounter.id, enemyTemplateId: enemy.id, quantity: group.quantity, side: e.type === "COMBAT" || e.type === "MIXED" ? "HOSTILE" : "NEUTRAL" } });
      }
      for (const key of e.npcKeys) await tx.encounterParticipantPlan.create({ data: { encounterId: encounter.id, npcId: npcMap.get(key)!, side: "ALLY" } });
      await tx.missionEncounter.create({ data: { missionId: mission.id, encounterId: encounter.id, position, optional: e.optional } });
    }
    await tx.missionConsequence.create({ data: { missionId: mission.id, title: "Vertrauen des Auftraggebers", kind: "NPC_ATTITUDE", npcId: npcMap.get(b.clientNpcKey), value: "FRIENDLY", description: "Nach erfolgreicher Zusammenarbeit vom DM bestätigen." } });
    if (b.objectives.some(o => !o.enabled)) await tx.missionConsequence.create({ data: { missionId: mission.id, title: "Alternativen Hinweis freischalten", kind: "UNLOCK_OBJECTIVE", objectiveId: objectiveMap.get(b.objectives.find(o => !o.enabled)!.id) } });
    return mission.id;
  }, { timeout: 30000 }); revalidatePath(`/campaign/${campaignId}`, "layout"); return id;
}
