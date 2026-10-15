import { z } from "zod";
import { AtlasMapType } from "@prisma/client";
import { PortraitError } from "./private-image-error";
export const mapTypes = { WORLD: "Welt", REGION: "Region", ISLAND: "Insel", CITY: "Stadt", VILLAGE: "Dorf", DISTRICT: "Viertel", BUILDING: "Gebäude", DUNGEON: "Dungeon", CUSTOM: "Eigene Karte" };
export const markerCategories = { SETTLEMENT: "Siedlung", BUILDING: "Gebäude", SHINOBI: "Shinobi-Einrichtung", TRADE: "Handel", MEDICAL: "Medizin", RELIGION: "Religion", NATURE: "Natur", HARBOR: "Hafen", TRAINING: "Trainingsgebiet", SECRET: "Geheimort", OTHER: "Sonstiges" };
export const markerIcons = { pin: "●", home: "⌂", tower: "♜", trade: "⚒", medical: "+", shrine: "⛩", tree: "♣", harbor: "⚓", training: "⚔", secret: "?", mountain: "▲" };
export const mapInput = z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(10000), type: z.nativeEnum(AtlasMapType), parentId: z.string().min(1).nullable(), locationId: z.string().min(1).nullable(), dmNotes: z.string().max(10000), playerVisible: z.boolean(), archived: z.boolean(), sortOrder: z.number().int().min(-10000).max(10000) }).strict();
export const markerInput = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(10000), x: z.number().min(0).max(1), y: z.number().min(0).max(1), category: z.enum(Object.keys(markerCategories) as [keyof typeof markerCategories, ...(keyof typeof markerCategories)[]]), icon: z.enum(Object.keys(markerIcons) as [keyof typeof markerIcons, ...(keyof typeof markerIcons)[]]), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), playerVisible: z.boolean(), locationId: z.string().min(1).nullable(), childMapId: z.string().min(1).nullable() }).strict();
export type MapInput = z.infer<typeof mapInput>;
export type MarkerInput = z.infer<typeof markerInput>;
export function parseAtlas<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) throw new PortraitError("Bitte Pflichtfelder, Koordinaten, Typ und Farbformat prüfen."); return parsed.data; }
export function assertAtlasParent(nodes: { id: string; parentId: string | null }[], id: string, parentId: string | null) {
  const seen = new Set([id]); let cursor = parentId;
  while (cursor) { if (seen.has(cursor)) throw new PortraitError("Kartenhierarchie darf keine Zyklen enthalten."); seen.add(cursor); const node = nodes.find(n => n.id === cursor); if (!node) throw new PortraitError("Übergeordnete Karte gehört nicht zu dieser Kampagne."); cursor = node.parentId; }
}
export function visibleAtlasIds(nodes: { id: string; parentId: string | null; playerVisible: boolean; archived: boolean }[]) {
  return new Set(nodes.filter(node => { const seen = new Set<string>(); let current: typeof node | undefined = node; while (current) { if (seen.has(current.id) || !current.playerVisible || current.archived) return false; seen.add(current.id); if (!current.parentId) return true; current = nodes.find(n => n.id === current!.parentId); } return false; }).map(n => n.id));
}
