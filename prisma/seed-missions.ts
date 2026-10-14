import type { PrismaClient } from "@prisma/client";
import { missionBlueprintSchema, missionSeeds } from "../seeding/missions";
export async function seedMissions(prisma: PrismaClient) {
  if (new Set(missionSeeds.map(s => s.key)).size !== missionSeeds.length) throw new Error("Doppelte Missions-Seed-Keys.");
  await prisma.$transaction(async tx => {
    for (const seed of missionSeeds) {
      const blueprint = missionBlueprintSchema.parse(seed.blueprint);
      const keys = [...new Set(blueprint.encounters.flatMap(e => e.enemies.map(g => g.seedKey)))];
      if (await tx.enemyTemplate.count({ where: { campaignId: null, seedKey: { in: keys }, archived: false } }) !== keys.length) throw new Error(`Missionsvorlage ${seed.key}: Bestiary-Seed fehlt.`);
      const old = await tx.missionTemplate.findUnique({ where: { seedKey: seed.key } });
      if (old && JSON.stringify(old.blueprint) === JSON.stringify(blueprint)) continue;
      const data = { title: blueprint.title, rank: blueprint.rank, summary: blueprint.publicInformation, blueprint };
      await tx.missionTemplate.upsert({ where: { seedKey: seed.key }, create: { ...data, seedKey: seed.key }, update: data });
    }
  }); return missionSeeds.length;
}
