import { z } from "zod";
import { createHash } from "node:crypto";
import { npcCategories, organizationTypes, relationshipTypes } from "./campaign-people";
const key = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,119}$/);
const source = z.object({ path: z.string().min(1).max(1000).refine(p => !p.startsWith("/") && !p.includes("\\") && !p.split("/").includes("..")), sha: z.string().regex(/^[a-f0-9]{40}$/) }).strict();
const common = { key, name: z.string().trim().min(1).max(160), sources: z.array(source).min(1), notes: z.string().max(20000).default("") };
export const loreBundleSchema = z.object({
  format: z.literal(1), key, revision: z.string().regex(/^[a-f0-9]{40}$/),
  npcs: z.array(z.object({ ...common, category: z.enum(Object.keys(npcCategories) as [keyof typeof npcCategories, ...(keyof typeof npcCategories)[]]), age: z.number().int().min(0).max(2000).nullable().default(null), gender: z.string().max(60).default(""), ninjaRank: z.string().max(80).default(""), occupation: z.string().max(160).default(""), village: z.string().max(160).default(""), clan: z.string().max(160).default("") }).strict()).max(1000),
  organizations: z.array(z.object({ ...common, type: z.enum(Object.keys(organizationTypes) as [keyof typeof organizationTypes, ...(keyof typeof organizationTypes)[]]), members: z.array(z.object({ npcKey: key, role: z.string().max(100).default(""), isLeader: z.boolean().default(false) }).strict()).default([]) }).strict()).max(1000),
  relationships: z.array(z.object({ key, sourceKey: key, targetKey: key, type: z.enum(Object.keys(relationshipTypes) as [keyof typeof relationshipTypes, ...(keyof typeof relationshipTypes)[]]), description: z.string().max(2000), sources: z.array(source).min(1) }).strict()).max(5000),
}).strict().superRefine((bundle, ctx) => {
  const npcKeys = new Set(bundle.npcs.map(n => n.key));
  for (const list of [bundle.npcs, bundle.organizations, bundle.relationships]) if (new Set(list.map(n => n.key)).size !== list.length) ctx.addIssue({ code: "custom", message: "Doppelte Lore-Keys." });
  for (const o of bundle.organizations) {
    if (new Set(o.members.map(m => m.npcKey)).size !== o.members.length) ctx.addIssue({ code: "custom", message: "Doppelte Mitgliedschaft." });
    for (const m of o.members) if (!npcKeys.has(m.npcKey)) ctx.addIssue({ code: "custom", message: "Unbekanntes Mitglied." });
  }
  for (const r of bundle.relationships) if (!npcKeys.has(r.sourceKey) || !npcKeys.has(r.targetKey) || r.sourceKey === r.targetKey) ctx.addIssue({ code: "custom", message: "Ungültige Lore-Beziehung." });
});
export type LoreBundle = z.infer<typeof loreBundleSchema>;
export function loreEntityId(campaignId: string, bundleKey: string, kind: string, key: string) {
  return "lore_" + createHash("sha256").update(JSON.stringify([campaignId, bundleKey, kind, key])).digest("hex").slice(0, 40);
}
export function loreProvenance(bundle: LoreBundle, entry: { sources: { path: string; sha: string }[]; notes?: string }) {
  return JSON.stringify({ source: "Private read-only lore bundle", bundle: bundle.key, revision: bundle.revision, sources: entry.sources, notes: entry.notes ?? "" }, null, 2);
}
