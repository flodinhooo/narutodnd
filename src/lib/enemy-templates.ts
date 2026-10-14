import { z } from "zod";
import { EnemyCategory, EnemyDifficulty, EnemyNinjaRank, RegenRank, Reservoir } from "@prisma/client";
import { abilities, skills } from "./rules";

export const enemyCategories = { ANIMAL: "Tier", HUMANOID: "Gewöhnlicher Gegner", SHINOBI: "Shinobi", MISSING_NIN: "Missing-Nin", OTHER: "Sonstiger Gegner" };
export const enemyDifficulties = { TRIVIAL: "Sehr leicht", EASY: "Leicht", MODERATE: "Mittel", HARD: "Schwer", DEADLY: "Tödlich", ELITE: "Elite" };
export const enemyRanks = { ACADEMY: "Akademieschüler", GENIN: "Genin", CHUNIN: "Chunin", JONIN: "Jonin", KAGE: "Kage" };
export const reservoirLabels = { VERY_LOW: "Sehr niedrig", LOW: "Niedrig", AVERAGE: "Durchschnittlich", HIGH: "Hoch", VERY_HIGH: "Sehr hoch", EXCEPTIONAL: "Aussergewöhnlich", MONSTER: "Monströs", SPECIAL: "Individuell" };
export const trainingLabels = { NOVICE: "Anfänger", TRAINED: "Geschult", ADVANCED: "Fortgeschritten", EXPERT: "Experte", MASTER: "Meister" };
export const enemySkillLabels: Record<keyof typeof skills, string> = { Acrobatics: "Akrobatik", "Animal Handling": "Mit Tieren umgehen", Arcana: "Arkane Kunde", Athletics: "Athletik", Deception: "Täuschen", History: "Geschichte", Insight: "Motiv erkennen", Intimidation: "Einschüchtern", Investigation: "Nachforschungen", Medicine: "Heilkunde", Nature: "Naturkunde", Perception: "Wahrnehmung", Performance: "Auftreten", Persuasion: "Überzeugen", Religion: "Religion", "Sleight of Hand": "Fingerfertigkeit", Stealth: "Heimlichkeit", Survival: "Überleben" };
const short = z.string().trim().max(200);
const text = z.string().trim().max(10000);
const number = (min: number, max: number) => z.preprocess(v => typeof v === "string" && v.trim() ? Number(v) : v, z.number().int().min(min).max(max));
const optionalNumber = (min: number, max: number) => z.preprocess(v => v === "" || v == null ? null : typeof v === "string" ? Number(v) : v, z.number().int().min(min).max(max).nullable());
const json = (v: unknown) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return null; } };
export const enemyAttackSchema = z.object({
  name: short.min(1), bonus: number(-30, 50),
  damageDice: z.string().trim().max(30).regex(/^(?:[1-9]|[1-9][0-9])d(?:2|4|6|8|10|12|20)(?:[+-](?:0|[1-9][0-9]{0,2}))?$/, "Schaden z. B. 1d6+2 oder 2d8."),
  damageType: short.min(1), range: short.min(1), description: text,
});
export const enemyAbilitySchema = z.object({ name: short.min(1), description: text.min(1) });
export const enemySkillsSchema = z.array(z.object({
  skill: z.enum(Object.keys(skills) as [keyof typeof skills, ...(keyof typeof skills)[]]),
  proficiency: z.enum(["PROFICIENT", "EXPERTISE"]),
})).max(20).refine(v => new Set(v.map(s => s.skill)).size === v.length, "Fertigkeiten dürfen nicht doppelt vorkommen.");
export const enemySavesSchema = z.array(z.enum(abilities as [typeof abilities[number], ...typeof abilities[number][]])).max(6).refine(v => new Set(v).size === v.length, "Rettungswürfe dürfen nicht doppelt vorkommen.");
const ids = z.array(z.string().min(1).max(100)).max(100).refine(v => new Set(v).size === v.length, "Doppelte Auswahl.");
export const enemyTemplateSchema = z.object({
  name: short.min(1), description: text, category: z.nativeEnum(EnemyCategory), difficulty: z.nativeEnum(EnemyDifficulty),
  ninjaRank: z.preprocess(v => v === "" ? null : v, z.nativeEnum(EnemyNinjaRank).nullable()),
  level: number(1, 20), recommendedLevelMin: number(1, 20), recommendedLevelMax: number(1, 20),
  maxHp: number(1, 1000000), acOverride: optionalNumber(0, 100), initiativeOverride: optionalNumber(-30, 50), speed: number(0, 1000),
  str: number(1, 30), dex: number(1, 30), con: number(1, 30), int: number(1, 30), wis: number(1, 30), cha: number(1, 30),
  hasChakra: z.boolean(), reservoir: z.nativeEnum(Reservoir),
  customReservoirMultiplier: z.preprocess(v => v === "" || v == null ? null : Number(v), z.number().min(0.1).max(10).nullable()),
  maxChakraOverride: optionalNumber(1, 1000000), controlRank: z.nativeEnum(RegenRank), regenRank: z.nativeEnum(RegenRank),
  attacks: z.preprocess(json, z.array(enemyAttackSchema).min(1, "Mindestens einen Angriff anlegen.").max(30)),
  abilities: z.preprocess(json, z.array(enemyAbilitySchema).max(30)),
  skills: z.preprocess(json, enemySkillsSchema), savingThrows: z.preprocess(json, enemySavesSchema),
  resistances: text, tactics: text, rewards: text, experience: optionalNumber(0, 10000000),
  natureIds: ids, jutsuIds: ids,
}).superRefine((v, ctx) => {
  const error = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.recommendedLevelMin > v.recommendedLevelMax) error("recommendedLevelMax", "Der Levelbereich ist umgekehrt.");
  if (!v.hasChakra && (v.natureIds.length || v.jutsuIds.length || v.maxChakraOverride !== null || v.customReservoirMultiplier !== null)) error("hasChakra", "Gegner ohne Chakra dürfen keine Chakra-Werte, Naturen oder Jutsu haben.");
  if (v.hasChakra && v.reservoir === "SPECIAL" && v.customReservoirMultiplier === null) error("customReservoirMultiplier", "Individuelles Reservoir benötigt einen Multiplikator.");
  if (v.reservoir !== "SPECIAL" && v.customReservoirMultiplier !== null) error("customReservoirMultiplier", "Multiplikator nur für individuelles Reservoir verwenden.");
});
export type EnemyTemplateInput = z.output<typeof enemyTemplateSchema>;
export type EnemyAttack = z.output<typeof enemyAttackSchema>;
export type EnemyAbility = z.output<typeof enemyAbilitySchema>;

export function parseEnemyForm(fd: FormData): EnemyTemplateInput {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(enemyTemplateSchema.shape)) {
    const values = fd.getAll(key);
    if (values.some(v => typeof v !== "string") || (!["natureIds", "jutsuIds", "savingThrows"].includes(key) && values.length > 1)) throw new Error("Ungültige oder doppelte Formulardaten.");
    raw[key] = ["natureIds", "jutsuIds", "savingThrows"].includes(key) ? values : key === "hasChakra" ? values[0] === "on" : values[0] ?? "";
  }
  const result = enemyTemplateSchema.safeParse(raw);
  if (!result.success) {
    const labels: Record<string, string> = { name: "Name", description: "Beschreibung", category: "Kategorie", difficulty: "Schwierigkeit", ninjaRank: "Ninja-Rang", level: "Kampfstufe", recommendedLevelMin: "Empfohlene Mindeststufe", recommendedLevelMax: "Empfohlene Höchststufe", maxHp: "Maximale HP", acOverride: "AC", initiativeOverride: "Initiative", speed: "Bewegung", hasChakra: "Chakra", reservoir: "Reservoir", customReservoirMultiplier: "Multiplikator", maxChakraOverride: "Maximales Chakra", controlRank: "Chakra-Kontrolle", regenRank: "Regeneration", attacks: "Angriffe", abilities: "Fähigkeiten", skills: "Fertigkeiten", savingThrows: "Rettungswürfe", natureIds: "Chakra-Naturen", jutsuIds: "Jutsu", resistances: "Resistenzen", tactics: "Taktik", rewards: "Belohnungen", experience: "Erfahrungspunkte" };
    throw new Error(result.error.issues.map(issue => {
      const key = String(issue.path[0] ?? "Formular"), label = labels[key] ?? key.toUpperCase();
      const message = issue.code === "custom" || issue.code === "invalid_format" ? issue.message
        : issue.code === "too_small" ? `Bitte das Minimum (${issue.minimum}) beachten.`
        : issue.code === "too_big" ? `Bitte das Maximum (${issue.maximum}) beachten.`
        : "Bitte einen gültigen Wert eingeben.";
      return `${label}: ${message}`;
    }).join("; "));
  }
  return result.data;
}
