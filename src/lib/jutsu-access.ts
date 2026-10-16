import type { Prisma } from "@prisma/client";

export function campaignJutsuScope(campaignId: string): Prisma.JutsuWhereInput {
  return { OR: [{ campaignId: null }, { campaignId }] };
}

// This predicate also protects direct URLs and related-technique links.
export function playerJutsuScope(campaignId: string): Prisma.JutsuWhereInput {
  return { AND: [campaignJutsuScope(campaignId), { dmOnly: false, reviewNeeded: false }, {
    OR: [
      { releases: { some: { campaignId } } },
      { characterLinks: { some: { character: { campaignId, npc: null } } } },
    ],
  }] };
}

export function creatorJutsuScope(campaignId: string, isDm: boolean): Prisma.JutsuWhereInput {
  return { AND: [isDm ? campaignJutsuScope(campaignId) : playerJutsuScope(campaignId), { dmOnly: false, reviewNeeded: false, rank: { in: ["E", "D", "C", "B", "A"] } }] };
}
