import { z } from "zod";
import { MissionRank, MissionStatus, ObjectiveStatus, ConsequenceKind } from "@prisma/client";
import { validateEncounter } from "./encounters";
export const missionStatuses = { DRAFT: "Entwurf", AVAILABLE: "Verfügbar", ACCEPTED: "Angenommen", ACTIVE: "Aktiv", COMPLETED: "Abgeschlossen", FAILED: "Gescheitert", CANCELLED: "Abgebrochen" };
export const objectiveStatuses = { PENDING: "Offen", ACTIVE: "In Arbeit", COMPLETED: "Erfüllt", FAILED: "Gescheitert", SKIPPED: "Übersprungen" };
export const consequenceKinds = { NPC_ATTITUDE: "NPC-Haltung ändern", ORGANIZATION_ATTITUDE: "Fraktionshaltung ändern", UNLOCK_MISSION: "Mission freischalten", REVEAL_INFORMATION: "Information veröffentlichen", UNLOCK_OBJECTIVE: "Alternatives Ziel freischalten" };
const id = z.string().trim().min(1).max(100), text = z.string().trim().max(10000), short = z.string().trim().min(1).max(200);
export const objectiveInputSchema = z.object({ id, title: short, description: text, playerVisible: z.boolean(), optional: z.boolean(), enabled: z.boolean(), dependencyIds: z.array(id).max(100).refine(v => new Set(v).size === v.length, "Doppelte Voraussetzungen.") }).strict();
export const missionInputSchema = z.object({ title: short, rank: z.nativeEnum(MissionRank), description: text, publicInformation: text, rewards: text, dmNotes: text, playerVisible: z.boolean(), clientNpcId: id.nullable(), locationId: id.nullable(), npcIds: z.array(id).max(100), objectives: z.array(objectiveInputSchema).max(100), encounters: z.array(z.object({ id, encounterId: id, optional: z.boolean() }).strict()).max(50) }).strict();
export type MissionInput = z.infer<typeof missionInputSchema>;
export const consequenceInputSchema = z.object({ title: short, description: text, kind: z.nativeEnum(ConsequenceKind), npcId: id.nullable(), organizationId: id.nullable(), targetMissionId: id.nullable(), objectiveId: id.nullable(), value: text }).strict().superRefine((v, ctx) => {
  const targets = [v.npcId, v.organizationId, v.targetMissionId, v.objectiveId].filter(Boolean).length;
  if (targets !== 1 || (v.kind === "NPC_ATTITUDE" && !v.npcId) || (v.kind === "ORGANIZATION_ATTITUDE" && !v.organizationId) || (["UNLOCK_MISSION", "REVEAL_INFORMATION"].includes(v.kind) && !v.targetMissionId) || (v.kind === "UNLOCK_OBJECTIVE" && !v.objectiveId)) ctx.addIssue({ code: "custom", message: "Genau ein passendes Ziel für die Konsequenz auswählen." });
  if (["NPC_ATTITUDE", "ORGANIZATION_ATTITUDE"].includes(v.kind) && !["FRIENDLY", "NEUTRAL", "HOSTILE", "UNKNOWN"].includes(v.value)) ctx.addIssue({ code: "custom", message: "Ungültige Haltung." });
  if (v.kind === "REVEAL_INFORMATION" && !v.value.trim()) ctx.addIssue({ code: "custom", message: "Den freizugebenden Text ausdrücklich eingeben." });
});
export const missionCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("STATUS"), status: z.nativeEnum(MissionStatus) }).strict(),
  z.object({ kind: z.literal("OBJECTIVE"), objectiveId: id, status: z.nativeEnum(ObjectiveStatus) }).strict(),
  z.object({ kind: z.literal("ARCHIVE"), archived: z.boolean() }).strict(),
  z.object({ kind: z.literal("CONSEQUENCE"), consequenceId: id, confirmed: z.literal(true), targetVersion: z.number().int().positive().optional(), targetUpdatedAt: z.iso.datetime().optional(), targetAttitude: z.string().optional() }).strict(),
  z.object({ kind: z.literal("START_ENCOUNTER"), linkId: id, encounterVersion: z.number().int().positive(), sessionId: id.optional(), sessionVersion: z.number().int().positive().optional() }).strict(),
]);
export const missionRequestSchema = z.object({ requestId: z.uuid(), expectedVersion: z.number().int().positive(), command: missionCommandSchema }).strict();
export type MissionCommand = z.infer<typeof missionCommandSchema>;
export type MissionActionResult = { ok: true; url?: string } | { ok: false; error: string };
export const validateMission = validateEncounter;
