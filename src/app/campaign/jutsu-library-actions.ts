"use server";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { campaignJutsuScope } from "@/lib/jutsu-access";

export async function setJutsuRelease(campaignId: string, jutsuId: string, form: FormData) {
  await requireCampaign(campaignId, true);
  const jutsu = await prisma.jutsu.findFirst({ where: { AND: [campaignJutsuScope(campaignId), { id: jutsuId }] }, select: { dmOnly: true, reviewNeeded: true } });
  if (!jutsu) throw new Error("Jutsu nicht gefunden.");
  if (form.get("release") === "yes") {
    if (jutsu.dmOnly || jutsu.reviewNeeded) throw new Error("Geheime oder ungeprüfte Jutsu können nicht freigegeben werden.");
    await prisma.campaignJutsuRelease.upsert({ where: { campaignId_jutsuId: { campaignId, jutsuId } }, create: { campaignId, jutsuId }, update: {} });
  } else {
    await prisma.campaignJutsuRelease.deleteMany({ where: { campaignId, jutsuId } });
  }
  revalidatePath(`/campaign/${campaignId}`, "layout");
}
