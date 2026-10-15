"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { EncounterError } from "@/lib/encounters";
import { importMissionBlueprint } from "@/lib/mission-blueprint-import";
import { missionBlueprintSchema } from "../../../seeding/missions";

export async function importMissionTemplate(campaignId: string, templateId: string) {
  await requireCampaign(campaignId, true);
  const id = await prisma.$transaction(async tx => {
    const prior = await tx.mission.findUnique({ where: { campaignId_sourceTemplateId: { campaignId, sourceTemplateId: templateId } } }); if (prior) return prior.id;
    const template = await tx.missionTemplate.findUnique({ where: { id: templateId } }); if (!template) throw new EncounterError("Missionsvorlage nicht verfügbar.");
    const b = missionBlueprintSchema.parse(template.blueprint);
    return importMissionBlueprint(tx, campaignId, templateId, b);
  }, { timeout: 30000 }); revalidatePath(`/campaign/${campaignId}`, "layout"); return id;
}
