import { z } from "zod";
import { loreJutsuSchema, normalizeJutsuIdentity } from "./lore-jutsu";
import { createHash } from "node:crypto";
import { npcCategories, organizationTypes, relationshipTypes } from "./campaign-people";
import { skills, abilities } from "./rules";
import { missionBlueprintSchema } from "../../seeding/missions";
const key = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,119}$/);
const source = z.object({ path: z.string().min(1).max(1000).refine(p => !p.startsWith("/") && !p.includes("\\") && !p.split("/").includes("..")), sha: z.string().regex(/^[a-f0-9]{40}$/) }).strict();
const identity = z.object({ bundleKey: key, key }).strict();
const common = { identities: z.array(identity).max(10).default([]), legacySeedKey: key.optional(), key, name: z.string().trim().min(1).max(160), sources: z.array(source).min(1), notes: z.string().max(20000).default(""), status: z.enum(["CONFIRMED", "INCOMPLETE", "DRAFT"]).default("INCOMPLETE") };
export const loreCombatSchema = z.object({
  hitDieAbilityBonus: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional(),
  status: z.literal("DRAFT"), assumptions: z.string().min(20).max(10000), level: z.number().int().min(1).max(20),
  str: z.number().int().min(1).max(20), dex: z.number().int().min(1).max(20), con: z.number().int().min(1).max(20), int: z.number().int().min(1).max(20), wis: z.number().int().min(1).max(20), cha: z.number().int().min(1).max(20),
  hitDie: z.enum(["d8", "d10"]), reservoir: z.enum(["VERY_LOW", "LOW", "AVERAGE", "HIGH", "VERY_HIGH", "EXCEPTIONAL", "MONSTER", "SPECIAL"]), customReservoirMultiplier: z.number().positive().max(10).optional(),
  controlRank: z.enum(["NOVICE", "TRAINED", "ADVANCED", "EXPERT", "MASTER"]), regenRank: z.enum(["NOVICE", "TRAINED", "ADVANCED", "EXPERT", "MASTER"]),
  speed: z.number().int().min(5).max(120), acOverride: z.number().int().min(1).max(30).optional(), hpOverride: z.number().int().min(1).max(1000).optional(),
  natureKeys: z.array(z.string().min(1).max(80)).max(6), jutsuSlugs: z.array(z.string().min(1).max(160)).max(80),
  skills: z.array(z.object({ skill: z.enum(Object.keys(skills) as [keyof typeof skills, ...(keyof typeof skills)[]]), proficiency: z.enum(["PROFICIENT", "EXPERTISE"]) }).strict()).max(18),
  savingThrows: z.array(z.enum(abilities as [typeof abilities[number], ...typeof abilities[number][]])).max(6), features: z.string().max(10000),
}).strict().superRefine((c, ctx) => { for (const list of [c.natureKeys, c.jutsuSlugs, c.savingThrows, c.skills.map(s => s.skill)]) if (new Set(list).size !== list.length) ctx.addIssue({ code: "custom", message: "Doppelte Kampfprofil-Einträge." }); });
export const loreBundleSchema = z.object({
  format: z.literal(1), key, title: z.string().max(160).optional(), teamStructure: z.literal("THREE_NPC_ONE_PLAYER").optional(), jutsu: z.array(loreJutsuSchema).max(200).default([]), revision: z.string().regex(/^[a-f0-9]{40}$/),
  npcs: z.array(z.object({ ...common, category: z.enum(Object.keys(npcCategories) as [keyof typeof npcCategories, ...(keyof typeof npcCategories)[]]), age: z.number().int().min(0).max(2000).nullable().default(null), gender: z.string().max(60).default(""), ninjaRank: z.string().max(80).default(""), occupation: z.string().max(160).default(""), village: z.string().max(160).default(""), clan: z.string().max(160).default(""), description: z.string().max(10000).default(""), background: z.string().max(10000).default(""), personality: z.string().max(10000).default(""), motivation: z.string().max(3000).default(""), interaction: z.string().max(3000).default(""), locationKey: key.optional(), combat: loreCombatSchema.optional() }).strict()).max(1000),
  organizations: z.array(z.object({ ...common, description: z.string().max(10000).default(""), reservedPlayerTeam: z.boolean().default(false), locationKey: key.optional(), type: z.enum(Object.keys(organizationTypes) as [keyof typeof organizationTypes, ...(keyof typeof organizationTypes)[]]), members: z.array(z.object({ npcKey: key, role: z.string().max(100).default(""), isLeader: z.boolean().default(false) }).strict()).default([]) }).strict()).max(1000),
  relationships: z.array(z.object({ key, sourceKey: key, targetKey: key, status: z.enum(["CONFIRMED", "DRAFT"]).default("CONFIRMED"), type: z.enum(Object.keys(relationshipTypes) as [keyof typeof relationshipTypes, ...(keyof typeof relationshipTypes)[]]), description: z.string().max(2000), sources: z.array(source).min(1) }).strict()).max(5000),
  missions: z.array(z.object({ key, status: z.literal("DRAFT"), locationKey: key, blueprint: missionBlueprintSchema, sources: z.array(source).min(1), followUpKeys: z.array(key).default([]) }).strict()).max(100).default([]),
}).strict().superRefine((bundle, ctx) => {
  const npcKeys = new Set(bundle.npcs.map(n => n.key));
  if (new Set(bundle.jutsu.map(j => j.key)).size !== bundle.jutsu.length || new Set(bundle.jutsu.map(j => j.slug)).size !== bundle.jutsu.length) ctx.addIssue({ code: "custom", message: "Doppelte Jutsu-Identität." });
  for (const j of bundle.jutsu) {
    if (j.allowedNpcKeys.some(k => !npcKeys.has(k)) || j.sources.some(s => s.path.startsWith("/") || s.path.includes("\\") || s.path.split("/").includes(".."))) ctx.addIssue({ code: "custom", message: "Ungültige Jutsu-Referenz." });
  }
  const aliases = new Map<string, string>();
  for (const j of bundle.jutsu) for (const name of [j.name, j.slug, ...j.aliases]) {
    const normalized = normalizeJutsuIdentity(name), prior = aliases.get(normalized);
    if (prior && prior !== j.key) ctx.addIssue({ code: "custom", message: "Mehrdeutige Jutsu-Aliase im Paket." });
    aliases.set(normalized, j.key);
  }
  const visitingJutsu = new Set<string>(), visitedJutsu = new Set<string>();
  function visitJutsu(slug: string): boolean {
    if (visitingJutsu.has(slug)) return false;
    if (visitedJutsu.has(slug)) return true;
    const j = bundle.jutsu.find(j => j.slug === slug);
    if (!j) return true;
    visitingJutsu.add(slug);
    for (const prerequisite of j.prerequisiteSlugs) if (!visitJutsu(prerequisite)) return false;
    visitingJutsu.delete(slug); visitedJutsu.add(slug); return true;
  }
  if (bundle.jutsu.some(j => !visitJutsu(j.slug))) ctx.addIssue({ code: "custom", message: "Zyklische Jutsu-Voraussetzung." });
  for (const o of bundle.organizations) if (o.reservedPlayerTeam && (o.type !== "TEAM" || o.members.length)) ctx.addIssue({ code: "custom", message: "Reserviertes Spielerteam muss ohne Mitglieder bleiben." });
  if (bundle.teamStructure) {
    const teams = bundle.organizations.filter(o => o.type === "TEAM"), students = new Set<string>(), teachersSeen = new Set<string>();
    if (teams.length !== 4 || teams.filter(t => t.reservedPlayerTeam).length !== 1) ctx.addIssue({ code: "custom", message: "Drei NPC-Teams und ein reserviertes Spielerteam erforderlich." });
    for (const team of teams.filter(t => !t.reservedPlayerTeam)) {
      const teachers = team.members.filter(m => m.isLeader), genin = team.members.filter(m => !m.isLeader);
      if (teachers.length !== 1 || genin.length !== 3 || team.members.length !== 4) ctx.addIssue({ code: "custom", message: "NPC-Team benötigt einen Sensei und drei Genin." });
      for (const m of teachers) {
        const rank = bundle.npcs.find(n => n.key === m.npcKey)?.ninjaRank;
        if (teachersSeen.has(m.npcKey) || normalizeJutsuIdentity(rank ?? "") !== "jonin") ctx.addIssue({ code: "custom", message: "Jedes NPC-Team benötigt einen eigenen dokumentierten Jonin-Sensei." });
        teachersSeen.add(m.npcKey);
      }
      for (const m of genin) { if (students.has(m.npcKey)) ctx.addIssue({ code: "custom", message: "Genin mehreren Teams zugeordnet." }); students.add(m.npcKey); }
      for (const m of genin) if (normalizeJutsuIdentity(bundle.npcs.find(n => n.key === m.npcKey)?.ninjaRank ?? "") !== "genin") ctx.addIssue({ code: "custom", message: "Teammitglied ist kein dokumentierter Genin." });
    }
  }
  for (const list of [bundle.npcs, bundle.organizations, bundle.relationships]) if (new Set(list.map(n => n.key)).size !== list.length) ctx.addIssue({ code: "custom", message: "Doppelte Lore-Keys." });
  for (const o of bundle.organizations) {
    if (new Set(o.members.map(m => m.npcKey)).size !== o.members.length) ctx.addIssue({ code: "custom", message: "Doppelte Mitgliedschaft." });
    for (const m of o.members) if (!npcKeys.has(m.npcKey)) ctx.addIssue({ code: "custom", message: "Unbekanntes Mitglied." });
  }
  for (const r of bundle.relationships) if (!npcKeys.has(r.sourceKey) || !npcKeys.has(r.targetKey) || r.sourceKey === r.targetKey) ctx.addIssue({ code: "custom", message: "Ungültige Lore-Beziehung." });
  const missions = new Map(bundle.missions.map(m => [m.key, m]));
  if (missions.size !== bundle.missions.length) ctx.addIssue({ code: "custom", message: "Doppelte Missions-Keys." });
  const active = new Set<string>(), done = new Set<string>();
  function visit(key: string): boolean { if (active.has(key)) return false; if (done.has(key)) return true; const m = missions.get(key); if (!m) return false; active.add(key); for (const next of m.followUpKeys) if (!visit(next)) return false; active.delete(key); done.add(key); return true; }
  if (bundle.missions.some(m => !visit(m.key) || m.blueprint.npcs.some(n => !npcKeys.has(n.key)))) ctx.addIssue({ code: "custom", message: "Fehlende oder zyklische Missionsreferenz." });
});
export type LoreBundle = z.infer<typeof loreBundleSchema>;
export function loreEntityId(campaignId: string, bundleKey: string, kind: string, key: string) {
  return "lore_" + createHash("sha256").update(JSON.stringify([campaignId, bundleKey, kind, key])).digest("hex").slice(0, 40);
}
export function loreProvenance(bundle: LoreBundle, entry: { sources: { path: string; sha: string }[]; notes?: string }) {
  return JSON.stringify({ source: "Private read-only lore bundle", bundle: bundle.key, revision: bundle.revision, sources: entry.sources, notes: entry.notes ?? "" }, null, 2);
}
