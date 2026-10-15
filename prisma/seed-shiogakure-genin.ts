import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { SHIOGAKURE_GENIN, geninAc, geninMaxHp, type GeninSeed } from "../seeding/shiogakure-genin.seed";
import { calculateMaxChakra } from "../src/lib/rules";

export const geninNpcId = (campaignId: string, seedKey: string) =>
  `genin_${createHash("sha256").update(JSON.stringify([campaignId, seedKey])).digest("hex")}`;

// Explicit DM approval: seedKey -> candidate name -> existing library ID.
// The supplied profiles label starting techniques as drafts; none are approved by default.
export type ApprovedGeninJutsu = Readonly<Record<string, Readonly<Record<string, string>>>>;

export function createIfMissing(prisma: PrismaClient, campaignId: string, approved: ApprovedGeninJutsu = {}) {
  return async (genin: GeninSeed) => prisma.$transaction(async tx => {
    const id = geninNpcId(campaignId, genin.seedKey);
    const existing = await tx.npc.findUnique({ where: { id } });
    if (existing) return existing;
    const jutsuIds = new Set<string>();
    for (const [name, jutsuId] of Object.entries(approved[genin.seedKey] ?? {})) {
      if (!genin.startingJutsuNames.includes(name)) throw new Error(`Unknown candidate: ${name}`);
      const jutsu = await tx.jutsu.findFirst({ where: { id: jutsuId, OR: [{ campaignId: null }, { campaignId }] } });
      if (!jutsu) throw new Error(`Missing or foreign Jutsu: ${jutsuId}`);
      jutsuIds.add(jutsu.id);
    }
    const nature = genin.primaryNature ? await tx.chakraNature.findUniqueOrThrow({ where: { key: genin.primaryNature } }) : null;
    const notes = [
      "Spielwerte sind Balancing-Vorschläge, keine bestätigten Kanonwerte.",
      genin.notes, genin.relationships,
      genin.chakraMultiplierProvisional ? `Chakrareserve ${genin.chakraMultiplier}× ist vorläufig.` : "",
      !genin.primaryNature ? "Chakranatur unbekannt; keine Natur freigeschaltet." : "",
      `Jutsu-Kandidaten (ohne ausdrückliche DM-Freigabe gesperrt): ${genin.startingJutsuNames.join(", ") || "keine"}`,
      `Quelle: ${genin.seedKey}`,
    ].filter(Boolean).join("\n");
    return tx.npc.upsert({ where: { id }, update: {}, create: {
      id, campaign: { connect: { id: campaignId } }, name: genin.name, category: "SHINOBI", age: genin.age,
      gender: genin.gender, ninjaRank: genin.rank, village: "Shiogakure", clan: genin.clan,
      description: genin.combatStyle, background: genin.biography, dmSecrets: notes,
      character: { create: {
        campaign: { connect: { id: campaignId } }, name: genin.name, level: genin.level, hitDie: `d${genin.hitDie}`,
        str: genin.abilities.STR, dex: genin.abilities.DEX, con: genin.abilities.CON,
        int: genin.abilities.INT, wis: genin.abilities.WIS, cha: genin.abilities.CHA,
        maxHp: geninMaxHp(genin), currentHp: geninMaxHp(genin), acOverride: geninAc(genin),
        reservoir: "SPECIAL", customReservoirMultiplier: genin.chakraMultiplier,
        currentChakra: calculateMaxChakra(1, genin.abilities.CON, genin.abilities.WIS, "SPECIAL", genin.chakraMultiplier),
        background: genin.biography, description: genin.combatStyle, dmData: { create: { notes } },
        natureLinks: { create: nature ? [{ chakraNatureId: nature.id, isPrimary: true, source: "SHIOGAKURE_SEED" }] : [] },
        jutsuLinks: { create: [...jutsuIds].map(jutsuId => ({ jutsuId, source: "DM_APPROVED_SEED" })) },
      } },
    } });
  });
}

export async function seedShiogakureGenin(prisma: PrismaClient, campaignId: string, approved: ApprovedGeninJutsu = {}) {
  const create = createIfMissing(prisma, campaignId, approved);
  for (const genin of SHIOGAKURE_GENIN) await create(genin);
  return SHIOGAKURE_GENIN.length;
}
