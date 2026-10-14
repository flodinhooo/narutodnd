import { z } from "zod";
import { EncounterType, EncounterStatus, EncounterSide, EnemyDifficulty, type Prisma } from "@prisma/client";
import { enemyAttackSchema, enemyAbilitySchema } from "./enemy-templates";
import { EncounterError } from "./action-error";
export { EncounterError } from "./action-error";

export const encounterTypes = { COMBAT: "Kampf", SOCIAL: "Sozial", EXPLORATION: "Erkundung", CHASE: "Verfolgung", MIXED: "Gemischt" };
export const encounterStatuses = { DRAFT: "Entwurf", READY: "Bereit", ARCHIVED: "Archiviert" };
export const runStatuses = { PREPARING: "Vorbereitung", ACTIVE: "Aktiv", COMPLETED: "Abgeschlossen", CANCELLED: "Abgebrochen" };
export const encounterSides = { ALLY: "Verbündet", HOSTILE: "Feindlich", NEUTRAL: "Neutral" };
export const combatConditions = { BLINDED: "Blind", CHARMED: "Bezaubert", FRIGHTENED: "Verängstigt", GRAPPLED: "Gepackt", INCAPACITATED: "Handlungsunfähig", INVISIBLE: "Unsichtbar", PARALYZED: "Gelähmt", PETRIFIED: "Versteinert", POISONED: "Vergiftet", PRONE: "Liegend", RESTRAINED: "Festgesetzt", STUNNED: "Betäubt", EXHAUSTED: "Erschöpft", BLEEDING: "Blutend", BURNING: "Brennend" } as const;
export const conditionSchema = z.array(z.enum(Object.keys(combatConditions) as [keyof typeof combatConditions, ...(keyof typeof combatConditions)[]])).max(15).refine(v => new Set(v).size === v.length, "Zustände dürfen nicht doppelt vorkommen.");
const id = z.string().trim().min(1).max(100);
const text = z.string().trim().max(10000);
export const encounterEventSchema = z.object({ id: z.uuid(), title: z.string().trim().min(1).max(200), trigger: z.string().trim().max(500), description: text }).strict();
export const encounterEventsSchema = z.array(encounterEventSchema).max(50).refine(v => new Set(v.map(e => e.id)).size === v.length, "Ereignis-IDs müssen eindeutig sein.");
export const runEventsSchema = z.array(encounterEventSchema.extend({ done: z.boolean() }));
export const encounterSchema = z.object({ name: z.string().trim().min(1).max(200), description: text, type: z.nativeEnum(EncounterType), difficulty: z.nativeEnum(EnemyDifficulty), locationId: id.nullable(), dmNotes: text, status: z.nativeEnum(EncounterStatus), events: encounterEventsSchema }).strict();
export const planOverridesSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), maxHp: z.number().int().min(1).max(1000000).optional(), ac: z.number().int().min(0).max(100).optional(), initiativeBonus: z.number().int().min(-30).max(50).optional(), maxChakra: z.number().int().min(1).max(1000000).optional() }).strict();
export const encounterPlanSchema = z.object({ source: z.enum(["ENEMY", "CHARACTER", "NPC"]), sourceId: id, quantity: z.number().int().min(1).max(20), side: z.nativeEnum(EncounterSide), notes: text, overrides: planOverridesSchema }).strict().refine(v => v.source === "ENEMY" || v.quantity === 1, "Charaktere und NPCs dürfen nur einmal hinzugefügt werden.");
export function validateEncounter<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const custom = parsed.error.issues.find(i => i.code === "custom");
    throw new EncounterError(custom?.message ?? "Ungültige Eingaben. Prüfe Pflichtfelder, Auswahl und erlaubte Zahlenbereiche.");
  }
  return parsed.data;
}
export function formText(fd: FormData, key: string) {
  const values = fd.getAll(key);
  if (values.length > 1 || values.some(v => typeof v !== "string")) throw new EncounterError("Ungültige oder doppelte Formulardaten.");
  return String(values[0] ?? "").trim();
}
export function formJson(fd: FormData, key: string) { try { return JSON.parse(formText(fd, key)); } catch { throw new EncounterError("Ungültige strukturierte Formulardaten."); } }
export function encounterVersion(value: unknown) { return validateEncounter(z.number().int().positive().max(2147483646), typeof value === "string" && value.trim() ? Number(value) : value); }
export type EncounterInput = z.infer<typeof encounterSchema>;
export type EncounterPlanInput = z.infer<typeof encounterPlanSchema>;
export type RunView = Prisma.EncounterRunGetPayload<{ include: { participants: true } }>;

const participant = z.object({ participantId: id });
export const combatCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("INITIATIVE"), ...participant.shape, value: z.number().int().min(-100).max(100) }).strict(),
  z.object({ kind: z.literal("ROLL_INITIATIVE"), participantId: id.optional() }).strict(),
  z.object({ kind: z.literal("BEGIN") }).strict(), z.object({ kind: z.literal("NEXT") }).strict(),
  z.object({ kind: z.literal("DAMAGE"), ...participant.shape, amount: z.number().int().min(1).max(1000000) }).strict(),
  z.object({ kind: z.literal("HEAL"), ...participant.shape, amount: z.number().int().min(1).max(1000000) }).strict(),
  z.object({ kind: z.literal("SPEND_CHAKRA"), ...participant.shape, amount: z.number().int().min(1).max(1000000) }).strict(),
  z.object({ kind: z.literal("RESTORE_CHAKRA"), ...participant.shape, amount: z.number().int().min(1).max(1000000) }).strict(),
  z.object({ kind: z.literal("CONDITIONS"), ...participant.shape, conditions: conditionSchema }).strict(),
  z.object({ kind: z.literal("FLAGS"), ...participant.shape, defeated: z.boolean(), unconscious: z.boolean() }).strict(),
  z.object({ kind: z.literal("PARTICIPANT_NOTES"), ...participant.shape, notes: text }).strict(),
  z.object({ kind: z.literal("RUN_NOTES"), notes: text }).strict(),
  z.object({ kind: z.literal("EVENT"), eventId: z.uuid(), done: z.boolean() }).strict(),
  z.object({ kind: z.literal("COMPLETE"), summary: text }).strict(),
  z.object({ kind: z.literal("CANCEL"), summary: text }).strict(),
]);
export const combatRequestSchema = z.object({ requestId: z.uuid(), expectedVersion: z.number().int().positive().max(2147483646), command: combatCommandSchema }).strict();
export type CombatCommand = z.infer<typeof combatCommandSchema>;
export type CombatRequest = z.infer<typeof combatRequestSchema>;
export type CombatResult = { ok: true; run: RunView } | { ok: false; error: string };

export const combatSnapshotSchema = z.object({
  schemaVersion: z.literal(1), name: z.string(), description: z.string(), level: z.number().int(), speed: z.number().int(),
  maxHp: z.number().int().positive().nullable(), maxChakra: z.number().int().positive().nullable(), ac: z.number().int().nullable(), initiative: z.number().int(),
  attributes: z.object({ str: z.number(), dex: z.number(), con: z.number(), int: z.number(), wis: z.number(), cha: z.number() }).nullable(),
  attacks: z.array(enemyAttackSchema), abilities: z.array(enemyAbilitySchema),
  skills: z.array(z.object({ skill: z.string(), bonus: z.number() })), savingThrows: z.array(z.object({ ability: z.string(), bonus: z.number() })),
  natures: z.array(z.object({ id: z.string(), key: z.string(), name: z.string() })),
  jutsu: z.array(z.object({ id: z.string(), name: z.string(), germanName: z.string().nullable().optional(), rank: z.string(), chakraCost: z.number().int().nonnegative(), range: z.string(), duration: z.string(), actionType: z.string(), description: z.string(), damageDice: z.string().nullable().optional(), damageType: z.string().nullable().optional(), saveAbility: z.string().nullable().optional(), attackType: z.string().nullable().optional(), requiresConcentration: z.boolean().optional() })),
  reservoir: z.string().nullable(), controlRank: z.string().nullable(), regenRank: z.string().nullable(), resistances: z.string(), tactics: z.string(),
});
export type CombatSnapshot = z.infer<typeof combatSnapshotSchema>;
