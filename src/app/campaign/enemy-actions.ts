"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { enemyTemplateSchema, parseEnemyForm } from "@/lib/enemy-templates";
import { validateEnemyReferences } from "@/lib/enemy-references";
import { enemyInclude } from "@/lib/enemy-library";

function version(value: unknown) {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1) throw new Error("Ungültige Vorlagenversion. Bitte neu laden.");
  return n;
}
function refresh(campaignId: string) { revalidatePath(`/campaign/${campaignId}/bestiary`, "layout"); }

export async function saveEnemyTemplate(campaignId: string, id: string | null, fd: FormData) {
  await requireCampaign(campaignId, true);
  const input = parseEnemyForm(fd), expectedVersion = id ? version(fd.get("version")) : null;
  const { natureIds, jutsuIds, ...data } = input;
  const result = await prisma.$transaction(async tx => {
    if (id && !await tx.enemyTemplate.findFirst({ where: { id, campaignId } })) throw new Error("Nur eigene Kampagnenvorlagen können bearbeitet werden.");
    await validateEnemyReferences(tx, campaignId, input);
    if (!id) return (await tx.enemyTemplate.create({ data: { ...data, campaignId, natureLinks: { create: natureIds.map(chakraNatureId => ({ chakraNatureId })) }, jutsuLinks: { create: jutsuIds.map(jutsuId => ({ jutsuId })) } } })).id;
    const changed = await tx.enemyTemplate.updateMany({ where: { id, campaignId, version: expectedVersion! }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("Vorlage wurde inzwischen geändert. Bitte neu laden und erneut bearbeiten.");
    await tx.enemyTemplateNature.deleteMany({ where: { templateId: id } });
    await tx.enemyTemplateJutsu.deleteMany({ where: { templateId: id } });
    await tx.enemyTemplate.update({ where: { id, campaignId }, data: { natureLinks: { create: natureIds.map(chakraNatureId => ({ chakraNatureId })) }, jutsuLinks: { create: jutsuIds.map(jutsuId => ({ jutsuId })) } } });
    return id;
  });
  refresh(campaignId);
  return result;
}

export async function duplicateEnemyTemplate(campaignId: string, id: string) {
  await requireCampaign(campaignId, true);
  const result = await prisma.$transaction(async tx => {
    const source = await tx.enemyTemplate.findFirst({ where: { id, OR: [{ campaignId: null }, { campaignId }] }, include: enemyInclude });
    if (!source) throw new Error("Vorlage nicht verfügbar.");
    const input = enemyTemplateSchema.parse({ ...source, natureIds: source.natureLinks.map(l => l.chakraNatureId), jutsuIds: source.jutsuLinks.map(l => l.jutsuId) });
    await validateEnemyReferences(tx, campaignId, input);
    const { natureIds, jutsuIds, ...data } = input;
    return tx.enemyTemplate.create({ data: { ...data, name: `${source.name.slice(0, 190)} (Kopie)`, campaignId, sourceTemplateId: source.id,
      natureLinks: { create: natureIds.map(chakraNatureId => ({ chakraNatureId })) }, jutsuLinks: { create: jutsuIds.map(jutsuId => ({ jutsuId })) },
    } });
  });
  refresh(campaignId);
  return result.id;
}

export async function archiveEnemyTemplate(campaignId: string, id: string, archived: boolean, expectedVersion: number) {
  await requireCampaign(campaignId, true);
  if (typeof archived !== "boolean") throw new Error("Ungültiger Archivstatus.");
  const changed = await prisma.enemyTemplate.updateMany({ where: { id, campaignId, version: version(expectedVersion) }, data: { archived, version: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("Vorlage nicht verfügbar oder inzwischen geändert. Globale Vorlagen können nicht archiviert werden.");
  refresh(campaignId);
}
