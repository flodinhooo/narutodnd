import { EncounterError } from "@/lib/action-error";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const npcCategories = { SHINOBI: "Shinobi", CIVILIAN: "Zivilist", MERCHANT: "Händler", MEDICAL: "Medizinisches Personal", POLITICAL: "Politische Figur", MERCENARY: "Bandit / Söldner", ANIMAL: "Tier", OTHER: "Sonstiger NPC" } as const;
export const attitudes = { FRIENDLY: "Verbündet", NEUTRAL: "Neutral", HOSTILE: "Feindlich", UNKNOWN: "Unbekannt" } as const;
export const organizationTypes = { TEAM: "Shinobi-Team", CLAN: "Clan", FAMILY: "Familie", ANBU: "ANBU-Einheit", GUILD: "Händlergilde", POLITICAL: "Politische Organisation", FACTION: "Fraktion", OTHER: "Sonstige Gruppierung" } as const;
export const relationshipTypes = { FAMILY: "Familie", FRIEND: "Freundschaft", RIVAL: "Rivalität", MENTOR: "Mentor", STUDENT: "Schüler", ALLY: "Verbündeter", ENEMY: "Feind", IDENTITY: "Geheimidentität", CUSTOM: "Individuell" } as const;
const text = z.string().trim().max(10000);
const short = z.string().trim().max(200);
const optionalId = z.string().trim().max(100).transform(v => v || null);
export const npcSchema = z.object({
  name: short.min(1), category: z.enum(Object.keys(npcCategories) as [keyof typeof npcCategories, ...(keyof typeof npcCategories)[]]),
  attitude: z.enum(Object.keys(attitudes) as [keyof typeof attitudes, ...(keyof typeof attitudes)[]]),
  age: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(0).max(10000)]),
  gender: short, description: text, background: text, personality: text, occupation: short,
  residence: short, affiliation: short, ninjaRank: short, village: short, clan: short,
  portraitUrl: z.union([z.literal(""), z.url().max(2000).refine(v => /^https?:\/\//i.test(v), "Nur HTTP(S)-Portraits sind erlaubt.")]),
  publicNotes: text, dmSecrets: text, playerVisible: z.boolean(), locationId: optionalId,
});
export const organizationSchema = z.object({
  name: short.min(1), type: z.enum(Object.keys(organizationTypes) as [keyof typeof organizationTypes, ...(keyof typeof organizationTypes)[]]),
  description: text, notes: text, dmSecrets: text, playerVisible: z.boolean(), locationId: optionalId,
});
export function parsePeopleForm<T extends z.ZodRawShape>(schema: z.ZodObject<T>, fd: FormData) {
  const raw = Object.fromEntries(Object.keys(schema.shape).map(key => {
    const values = fd.getAll(key);
    if (values.length > 1 || values.some(v => typeof v !== "string")) throw new EncounterError("Ungültige Formulardaten.");
    return [key, key === "playerVisible" ? values[0] === "on" : values[0] ?? ""];
  }));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const labels: Record<string, string> = { name: "Name", age: "Alter", gender: "Geschlecht", category: "Kategorie", attitude: "Haltung", description: "Beschreibung", background: "Hintergrund", personality: "Persönlichkeit", occupation: "Beruf", residence: "Wohnort", affiliation: "Zugehörigkeit", ninjaRank: "Ninja-Rang", village: "Herkunftsdorf", clan: "Clan", locationId: "Ort", portraitUrl: "Portrait-URL", publicNotes: "Öffentliche Notizen", dmSecrets: "DM-Geheimnisse", notes: "Notizen", type: "Typ", playerVisible: "Spielerfreigabe" };
    const fields = [...new Set(result.error.issues.map(i => labels[String(i.path[0])] ?? "Formular"))];
    throw new EncounterError(`Bitte folgende Angaben prüfen: ${fields.join(", ")}. Pflichtfelder, Wertebereiche und Formate beachten.`);
  }
  return result.data;
}

// Reused by all existing character entry points: a guessed sheet URL must not
// bypass the visibility of its NPC identity. Existing player characters pass.
export function characterVisibility(dm: boolean): Prisma.CharacterWhereInput {
  return dm ? {} : { OR: [{ npc: null }, { npc: { playerVisible: true, archived: false } }] };
}

// Explicit allowlist: secrets are never read for a player, including nested data.
export const publicNpcSelect = {
  id: true, name: true, category: true, age: true, gender: true, description: true,
  occupation: true, residence: true, affiliation: true, portraitUrl: true,
  publicNotes: true, ninjaRank: true, village: true, clan: true, characterId: true,
} satisfies Prisma.NpcSelect;
export const publicOrganizationSelect = { id: true, name: true, type: true, description: true } satisfies Prisma.OrganizationSelect;
