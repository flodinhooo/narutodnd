import { prisma } from "./prisma";
import { portraitSubject, portraitOwnerKey } from "./portrait-access";
import { portraitStorage } from "./portrait-storage";
import { PortraitError, processPortrait } from "./portrait-image";

export const portraitView = { id: true, label: true, version: true, isDefault: true, width: true, height: true, byteSize: true } as const;
const uploads = new Map<string, { count: number; until: number }>();
export async function changePortrait(campaignId: string, kind: string, entityId: string, fd: FormData) {
  const subject = await portraitSubject(campaignId, kind, entityId, true);
  const op = String(fd.get("op")), id = String(fd.get("id") || ""), version = Number(fd.get("version"));
  const storage = portraitStorage();
  if (op === "OWNER") {
    if (kind !== "character" || subject.actor.role !== "DM" || !("characterId" in subject.scope)) throw new PortraitError("Besitzer kann hier nicht geändert werden.", 403);
    const owner = String(fd.get("owner") || "");
    const sessions = await prisma.campaignAccessSession.findMany({ where: { campaignId, role: "PLAYER", expiresAt: { gt: new Date() } }, select: { id: true } });
    if (owner && !sessions.some(s => portraitOwnerKey(s.id) === owner)) throw new PortraitError("Spielerzugang nicht verfügbar.");
    const changed = await prisma.character.updateMany({ where: { id: entityId, campaignId, portraitOwnerKey: String(fd.get("expectedOwner") || "") || null }, data: { portraitOwnerKey: owner || null } });
    if (!changed.count) throw new PortraitError("Besitzerzuordnung wurde inzwischen geändert. Bitte neu laden.", 409);
    return;
  }
  if (!["UPLOAD", "DEFAULT", "DELETE"].includes(op)) throw new PortraitError("Unbekannte Portrait-Aktion.");
  let image: Awaited<ReturnType<typeof processPortrait>> | undefined, key: string | undefined;
  const label = String(fd.get("label") || "Standard").trim();
  if (op === "UPLOAD") {
    if (!label || label.length > 80) throw new PortraitError("Variantenname muss 1 bis 80 Zeichen enthalten.");
    const now = Date.now(), rate = uploads.get(subject.actor.id);
    if (rate && rate.until > now && rate.count >= 20) throw new PortraitError("Zu viele Uploads. Bitte in zehn Minuten erneut versuchen.", 429);
    for (const [actor, value] of uploads) if (value.until <= now) uploads.delete(actor);
    uploads.set(subject.actor.id, { until: rate && rate.until > now ? rate.until : now + 600000, count: rate && rate.until > now ? rate.count + 1 : 1 });
    const file = fd.get("file");
    if (!(file instanceof File)) throw new PortraitError("Bitte ein Bild auswählen.");
    image = await processPortrait(new Uint8Array(await file.arrayBuffer()), file.type, fd.get("crop") === "true" ? { x: Number(fd.get("x")), y: Number(fd.get("y")) } : undefined);
    key = await storage.put(image.data);
  }
  let obsolete: string | undefined;
  try {
    await prisma.$transaction(async tx => {
      // Recheck ownership/visibility immediately before mutation, after decoding.
      const current = id ? await tx.portrait.findFirst({ where: { id, campaignId, ...subject.scope } }) : null;
      if (id && (!current || !Number.isInteger(version) || current.version !== version)) throw new PortraitError("Portrait wurde inzwischen geändert. Bitte neu laden.", 409);
      if (op !== "UPLOAD" && !current) throw new PortraitError("Portrait nicht verfügbar.", 404);
      if ("characterId" in subject.scope && subject.actor.role !== "DM") {
        const owner = await tx.character.findFirst({ where: { id: subject.scope.characterId, campaignId, portraitOwnerKey: portraitOwnerKey(subject.actor.id), npc: null } });
        if (!owner) throw new PortraitError("Bearbeitungsrecht wurde inzwischen geändert.", 403);
      }
      if (op === "UPLOAD") {
        const count = await tx.portrait.count({ where: { campaignId, ...subject.scope } });
        const size = await tx.portrait.aggregate({ where: { campaignId }, _sum: { byteSize: true }, _count: true });
        if ((!id && count >= 10) || size._count >= 2000 || (size._sum.byteSize ?? 0) + image!.byteSize > 100 * 1024 * 1024) throw new PortraitError("Portrait-Speicherlimit erreicht. Nicht mehr benötigte Bilder entfernen.", 413);
        if (current) {
          const changed = await tx.portrait.updateMany({ where: { id, version }, data: { storageKey: key!, mimeType: image!.mimeType, width: image!.width, height: image!.height, byteSize: image!.byteSize, label, version: { increment: 1 } } });
          if (!changed.count) throw new PortraitError("Portrait inzwischen geändert.", 409);
          obsolete = current.storageKey;
        } else await tx.portrait.create({ data: { campaignId, ...subject.scope, storageKey: key!, mimeType: image!.mimeType, width: image!.width, height: image!.height, byteSize: image!.byteSize, label, isDefault: count === 0 } });
      } else if (op === "DEFAULT") {
        await tx.portrait.updateMany({ where: { campaignId, ...subject.scope, isDefault: true }, data: { isDefault: false, version: { increment: 1 } } });
        await tx.portrait.update({ where: { id }, data: { isDefault: true, version: { increment: 1 } } });
      } else {
        await tx.portrait.delete({ where: { id, version } }); obsolete = current!.storageKey;
        if (current!.isDefault) {
          const next = await tx.portrait.findFirst({ where: { campaignId, ...subject.scope }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
          if (next) await tx.portrait.update({ where: { id: next.id }, data: { isDefault: true, version: { increment: 1 } } });
        }
      }
    });
  } catch (error) { if (key) await storage.remove(key); throw error; }
  if (obsolete) await storage.remove(obsolete).catch(() => console.warn("Verwaiste Portrait-Datei konnte nicht entfernt werden."));
}

export async function portraitImage(id: string) {
  const p = await prisma.portrait.findUnique({ where: { id } });
  if (!p) throw new PortraitError("Bild nicht verfügbar.", 404);
  await portraitSubject(p.campaignId, p.characterId ? "character" : p.npcId ? "npc" : "enemy", p.characterId ?? p.npcId ?? p.enemyTemplateId!);
  const data = await portraitStorage().read(p.storageKey).catch(() => { throw new PortraitError("Bilddatei nicht verfügbar.", 404); });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Content-Disposition": "inline; filename=portrait.webp" } });
}
