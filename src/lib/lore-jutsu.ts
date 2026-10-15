import { z } from "zod";
import type { Jutsu, Prisma } from "@prisma/client";

export const loreJutsuSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,119}$/), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,159}$/),
  name: z.string().min(1).max(160), japaneseName: z.string().max(160).optional(), germanName: z.string().max(160).optional(),
  aliases: z.array(z.string().min(1).max(160)).max(20).default([]), description: z.string().min(1).max(15000),
  rank: z.enum(["E", "D", "C", "B", "A", "S"]), category: z.string().max(160),
  pool: z.enum(["CANON", "ELEMENTAL", "CHARACTER_SIGNATURE", "UZUMAKI", "FOUNDATION"]),
  status: z.literal("DRAFT"), assumptions: z.string().min(20).max(5000),
  chakraCost: z.number().int().min(0).max(1000), range: z.string().min(1).max(200), duration: z.string().min(1).max(200), actionType: z.string().min(1).max(100),
  attackType: z.string().max(100).optional(), damageDice: z.string().max(100).optional(), damageType: z.string().max(100).optional(), saveAbility: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional(), requiresConcentration: z.boolean().default(false),
  natureKeys: z.array(z.string().min(1)).max(6), prerequisiteSlugs: z.array(z.string().min(1)).max(20).default([]), prerequisiteText: z.string().max(3000).default(""),
  allowedNpcKeys: z.array(z.string().min(1)).min(1), requiredClan: z.string().min(1).optional(),
  sources: z.array(z.object({ path: z.string().min(1), sha: z.string().regex(/^[a-f0-9]{40}$/) }).strict()).min(1),
}).strict();
export type LoreJutsu = z.infer<typeof loreJutsuSchema>;
export const normalizeJutsuIdentity = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Exact normalized aliases only; ambiguous matches require an explicit review.
export function matchLoreJutsu(entry: LoreJutsu, library: Jutsu[]) {
  const names = new Set([entry.name, entry.slug, ...entry.aliases].map(normalizeJutsuIdentity));
  return library.filter(j => [j.slug, j.name, j.germanName, j.japaneseName].some(n => n && names.has(normalizeJutsuIdentity(n))));
}

export function privateJutsuData(entry: LoreJutsu, campaignId: string): Prisma.JutsuUncheckedCreateInput {
  return { campaignId, slug: entry.slug, name: entry.name, germanName: entry.germanName, japaneseName: entry.japaneseName,
    description: `[DM-Entwurf] ${entry.description}\n\n${entry.assumptions}`, rank: entry.rank, chakraCost: entry.chakraCost,
    range: entry.range, duration: entry.duration, actionType: entry.actionType, attackType: entry.attackType, damageDice: entry.damageDice, damageType: entry.damageType,
    saveAbility: entry.saveAbility, requiresConcentration: entry.requiresConcentration, origin: "DM_CUSTOM", pool: entry.pool, category: entry.category,
    dmOnly: true, requiredNatureKeys: JSON.stringify(entry.natureKeys), prerequisiteText: entry.prerequisiteText,
    traditionProvenance: JSON.stringify({ allowedNpcKeys: entry.allowedNpcKeys, requiredClan: entry.requiredClan, sources: entry.sources }),
  };
}
