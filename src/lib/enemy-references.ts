import type { Prisma } from "@prisma/client";
import type { EnemyTemplateInput } from "./enemy-templates";
import { enemyMaxChakra } from "./rules/enemies";

export async function validateEnemyReferences(tx: Prisma.TransactionClient, campaignId: string | null, data: EnemyTemplateInput) {
  const natures = await tx.chakraNature.findMany({ where: { id: { in: data.natureIds } }, select: { id: true, key: true } });
  if (natures.length !== data.natureIds.length) throw new Error("Unbekannte Chakra-Natur.");
  const jutsu = await tx.jutsu.findMany({ where: { id: { in: data.jutsuIds }, OR: [{ campaignId: null }, ...(campaignId ? [{ campaignId }] : [])] }, include: { natures: { include: { nature: true } }, prerequisites: true } });
  if (jutsu.length !== data.jutsuIds.length) throw new Error("Jutsu nicht verfügbar oder aus einer fremden Kampagne.");
  const natureKeys = new Set(natures.map(n => n.key)), ids = new Set(data.jutsuIds), max = enemyMaxChakra(data);
  for (const j of jutsu) {
    if (!data.hasChakra || max === null || j.chakraCost < 0 || j.chakraCost > max) throw new Error(`Nicht genügend maximales Chakra für ${j.name}.`);
    let required: unknown;
    try { required = JSON.parse(j.requiredNatureKeys ?? "[]"); } catch { throw new Error(`Ungültige Natur-Voraussetzungen für ${j.name}.`); }
    if (!Array.isArray(required) || !required.every(k => typeof k === "string")) throw new Error(`Ungültige Natur-Voraussetzungen für ${j.name}.`);
    if ([...required, ...j.natures.map(n => n.nature.key)].some(key => !natureKeys.has(key))) throw new Error(`Chakra-Natur fehlt für ${j.name}.`);
    if (j.prerequisites.some(p => !ids.has(p.prerequisiteJutsuId))) throw new Error(`Jutsu-Voraussetzung fehlt für ${j.name}.`);
  }
}
