import type { PrismaClient } from "@prisma/client";
import { enemyTemplateSeeds } from "../seeding/enemy-templates";
import { enemyTemplateSchema } from "../src/lib/enemy-templates";
import { validateEnemyReferences } from "../src/lib/enemy-references";

// Called after the existing Jutsu/nature seed. All records and references are
// validated in one transaction; a missing prerequisite leaves no partial library.
export async function seedBestiary(prisma: PrismaClient) {
  if (new Set(enemyTemplateSeeds.map(s => s.key)).size !== enemyTemplateSeeds.length) throw new Error("Doppelte Bestiary-Seed-Keys.");
  await prisma.$transaction(async tx => {
    for (const seed of enemyTemplateSeeds) {
      const natures = await tx.chakraNature.findMany({ where: { key: { in: seed.natureKeys } } });
      const jutsu = await tx.jutsu.findMany({ where: { campaignId: null, slug: { in: seed.jutsuSlugs } } });
      if (natures.length !== seed.natureKeys.length || jutsu.length !== seed.jutsuSlugs.length) throw new Error(`Seed ${seed.key}: zuerst die vollständige Jutsu-/Natur-Bibliothek seeden (fehlende oder mehrdeutige Referenzen).`);
      const input = enemyTemplateSchema.parse({ ...seed.data, natureIds: natures.map(n => n.id), jutsuIds: jutsu.map(j => j.id) });
      await validateEnemyReferences(tx, null, input);
      const { natureIds, jutsuIds, ...data } = input;
      const existing = await tx.enemyTemplate.findUnique({ where: { seedKey: seed.key }, include: { natureLinks: true, jutsuLinks: true } });
      if (existing && existing.campaignId !== null) throw new Error("Seed-Key gehört zu einer Kampagnenvorlage.");
      const sameIds = (a: string[], b: string[]) => [...a].sort().join(",") === [...b].sort().join(",");
      if (existing && !existing.archived && Object.entries(data).every(([key, value]) => JSON.stringify(existing[key as keyof typeof data]) === JSON.stringify(value))
        && sameIds(natureIds, existing.natureLinks.map(l => l.chakraNatureId)) && sameIds(jutsuIds, existing.jutsuLinks.map(l => l.jutsuId))) continue;
      const template = await tx.enemyTemplate.upsert({ where: { seedKey: seed.key },
        create: { ...data, seedKey: seed.key },
        update: { ...data, archived: false, version: { increment: 1 } },
      });
      await tx.enemyTemplateNature.deleteMany({ where: { templateId: template.id } });
      await tx.enemyTemplateJutsu.deleteMany({ where: { templateId: template.id } });
      await tx.enemyTemplate.update({ where: { id: template.id }, data: {
        natureLinks: { create: natureIds.map(chakraNatureId => ({ chakraNatureId })) },
        jutsuLinks: { create: jutsuIds.map(jutsuId => ({ jutsuId })) },
      } });
    }
  }, { timeout: 60000 });
  return enemyTemplateSeeds.length;
}
