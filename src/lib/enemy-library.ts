import { prisma } from "./prisma";
import { requireCampaign } from "./session";
import { EnemyCategory, EnemyDifficulty, EnemyNinjaRank } from "@prisma/client";

export const enemyInclude = { natureLinks: { include: { nature: true } }, jutsuLinks: { include: { jutsu: true } } } as const;
export async function getEnemyTemplate(campaignId: string, id: string) {
  await requireCampaign(campaignId, true);
  return prisma.enemyTemplate.findFirst({ where: { id, OR: [{ campaignId: null }, { campaignId }] }, include: enemyInclude });
}
export type BestiaryFilters = { q?: string; category?: string; difficulty?: string; rank?: string; scope?: string; archived?: string };
export async function listEnemyTemplates(campaignId: string, filters: BestiaryFilters = {}) {
  await requireCampaign(campaignId, true);
  const valid = <T extends string>(values: Record<string, T>, value?: string): T | undefined => Object.values(values).find(v => v === value);
  return prisma.enemyTemplate.findMany({
    where: {
      OR: filters.scope === "global" ? [{ campaignId: null }] : filters.scope === "campaign" ? [{ campaignId }] : [{ campaignId: null }, { campaignId }],
      archived: filters.archived === "true", category: valid(EnemyCategory, filters.category), difficulty: valid(EnemyDifficulty, filters.difficulty),
      ...(filters.rank === "none" ? { ninjaRank: null } : { ninjaRank: valid(EnemyNinjaRank, filters.rank) }),
      ...(filters.q?.trim() ? { AND: [{ OR: [{ name: { contains: filters.q.trim().slice(0, 200) } }, { description: { contains: filters.q.trim().slice(0, 200) } }] }] } : {}),
    }, orderBy: [{ level: "asc" }, { name: "asc" }],
  });
}
export async function enemyBuilderOptions(campaignId: string) {
  await requireCampaign(campaignId, true);
  const [natures, jutsu] = await Promise.all([
    prisma.chakraNature.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
    prisma.jutsu.findMany({ where: { OR: [{ campaignId: null }, { campaignId }] }, select: { id: true, name: true, germanName: true, rank: true, chakraCost: true }, orderBy: [{ rank: "asc" }, { name: "asc" }] }),
  ]);
  return { natures, jutsu };
}
