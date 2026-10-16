import { prisma } from "./prisma";
import { getSession } from "./session";
import { PortraitError } from "./portrait-image";
import { createHash } from "node:crypto";
import {controllerKey} from "./character-control";
export const portraitOwnerKey = (id: string) => createHash("sha256").update(id).digest("hex");
export type PortraitKind = "character" | "npc" | "enemy";
export async function portraitSubject(campaignId: string, kind: string, id: string, write = false) {
  const actor = await getSession();
  if (!actor || actor.campaignId !== campaignId || !["DM", "PLAYER"].includes(actor.role)) throw new PortraitError("Bild nicht verfügbar.", 404);
  let canEdit = actor.role === "DM";
  let scope: { characterId: string } | { npcId: string } | { enemyTemplateId: string };
  if (kind === "character") {
    const c = await prisma.character.findFirst({ where: { id, campaignId }, include: { npc: { select: { id: true, playerVisible: true, archived: true } } } });
    if (!c || (actor.role !== "DM" && c.npc && (!c.npc.playerVisible || c.npc.archived))) throw new PortraitError("Bild nicht verfügbar.", 404);
    canEdit ||= !c.npc && (c.portraitOwnerKey === portraitOwnerKey(actor.id) || (!!c.portraitOwnerKey && c.portraitOwnerKey === await controllerKey()));
    scope = c.npc ? { npcId: c.npc.id } : { characterId: id };
  } else if (kind === "npc") {
    const n = await prisma.npc.findFirst({ where: { id, campaignId } });
    if (!n || (actor.role !== "DM" && (!n.playerVisible || n.archived))) throw new PortraitError("Bild nicht verfügbar.", 404);
    scope = { npcId: id };
  } else if (kind === "enemy") {
    const e = await prisma.enemyTemplate.findFirst({ where: { id, campaignId } });
    if (!e || actor.role !== "DM") throw new PortraitError("Bild nicht verfügbar.", 404);
    scope = { enemyTemplateId: id };
  } else throw new PortraitError("Bild nicht verfügbar.", 404);
  if (write && !canEdit) throw new PortraitError("Für dieses Portrait fehlen die Bearbeitungsrechte.", 403);
  return { actor, canEdit, scope, campaignId };
}
