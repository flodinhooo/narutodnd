import { prisma } from "./prisma";
import { requireCampaign } from "./session";
import { EncounterStatus, EncounterType, type Prisma } from "@prisma/client";

export const encounterInclude = { participants: { include: { enemyTemplate: { select: { name: true } }, character: { select: { name: true } }, npc: { select: { name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, location: { select: { id: true, name: true } }, runs: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, name: true, createdAt: true, round: true } } } satisfies Prisma.EncounterInclude;
export const runInclude = { participants: { orderBy: { ordinal: "asc" } } } as const;
export async function getEncounter(campaignId: string, id: string) {
  await requireCampaign(campaignId, true);
  return prisma.encounter.findFirst({ where: { id, campaignId }, include: encounterInclude });
}
export async function getEncounterRun(campaignId: string, id: string) {
  await requireCampaign(campaignId, true);
  return prisma.encounterRun.findFirst({ where: { id, campaignId }, include: runInclude });
}
export async function listEncounters(campaignId: string, filters: { q?: string; type?: string; status?: string } = {}) {
  await requireCampaign(campaignId, true);
  const type = Object.values(EncounterType).find(v => v === filters.type), status = Object.values(EncounterStatus).find(v => v === filters.status);
  return prisma.encounter.findMany({ where: { campaignId, ...(type ? { type } : {}), ...(status ? { status } : { status: { not: "ARCHIVED" } }), ...(filters.q ? { name: { contains: filters.q.slice(0, 200) } } : {}) }, include: { _count: { select: { participants: true, runs: true } } }, orderBy: { updatedAt: "desc" } });
}
export async function encounterBuilderOptions(campaignId: string) {
  await requireCampaign(campaignId, true);
  const [enemies, characters, npcs, locations] = await Promise.all([
    prisma.enemyTemplate.findMany({ where: { archived: false, OR: [{ campaignId: null }, { campaignId }] }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    prisma.character.findMany({ where: { campaignId, npc: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.npc.findMany({ where: { campaignId, archived: false }, select: { id: true, name: true, characterId: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { campaignId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { enemies, characters, npcs, locations };
}
