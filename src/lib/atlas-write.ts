import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { atlasActor } from "./atlas-library";
import { assertAtlasParent, mapInput, markerInput, parseAtlas } from "./atlas-schema";
import { processMapImage, atlasStorage } from "./atlas-image";
import { PortraitError } from "./portrait-image";

const uploadRates = new Map<string, { count: number; until: number }>();
function json(fd: FormData) { try { return JSON.parse(String(fd.get("data") || "{}")); } catch { throw new PortraitError("Ungültige Formulardaten."); } }
export async function mutateAtlas(campaignId: string, fd: FormData) {
  const actor = await atlasActor(campaignId, true);
  const op = String(fd.get("op")), mapId = String(fd.get("mapId") || ""), id = String(fd.get("id") || ""), version = Number(fd.get("version"));
  const requestId = parseAtlas(z.uuid(), fd.get("requestId"));
  if (!["CREATE_MAP", "SAVE_MAP", "DELETE_MAP", "SAVE_MARKER", "MOVE_MARKER", "DELETE_MARKER", "IMAGE", "REMOVE_IMAGE"].includes(op)) throw new PortraitError("Unbekannte Kartenaktion.");
  const input = json(fd), confirmation = String(fd.get("confirmation") || "");
  let image: Awaited<ReturnType<typeof processMapImage>> | undefined, imageHash: string | undefined, key: string | undefined;
  if (op === "IMAGE") {
    const file = fd.get("file"); if (!(file instanceof File) || file.size > 25 * 1024 * 1024) throw new PortraitError("Kartenbild fehlt oder überschreitet 25 MiB.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer()); imageHash = createHash("sha256").update(bytes).digest("hex");
    // Validate identity before expensive decoding. Duplicate requests bypass processing.
    const existing = await prisma.worldMap.findFirst({ where: { id: mapId, campaignId } }); if (!existing) throw new PortraitError("Karte nicht verfügbar.", 404);
    const rate = uploadRates.get(actor.id), now = Date.now();
    if (rate && rate.until > now && rate.count >= 10) throw new PortraitError("Zu viele Karten-Uploads. Bitte später erneut versuchen.", 429);
    for (const [id, value] of uploadRates) if (value.until <= now) uploadRates.delete(id);
    uploadRates.set(actor.id, { count: rate && rate.until > now ? rate.count + 1 : 1, until: rate && rate.until > now ? rate.until : now + 600000 });
  }
  const hash = createHash("sha256").update(JSON.stringify({ op, mapId, id, version: Number.isNaN(version) ? null : version, input, confirmation, imageHash })).digest("hex");
  const prior = await prisma.atlasChange.findUnique({ where: { campaignId_requestId: { campaignId, requestId } } });
  if (prior) { if (prior.payloadHash !== hash) throw new PortraitError("Request-ID wurde bereits anders verwendet.", 409); return { mapId: prior.mapId }; }
  if (op === "IMAGE") { const file = fd.get("file") as File; image = await processMapImage(new Uint8Array(await file.arrayBuffer()), file.type); key = await atlasStorage().put(image.data); }
  let obsolete: string | undefined, replay = false;
  try {
    const result = await prisma.$transaction(async tx => {
      const duplicate = await tx.atlasChange.findUnique({ where: { campaignId_requestId: { campaignId, requestId } } });
      if (duplicate) { if (duplicate.payloadHash !== hash) throw new PortraitError("Request-ID wurde bereits anders verwendet.", 409); replay = true; return duplicate.mapId; }
      const current = op === "CREATE_MAP" ? null : await tx.worldMap.findFirst({ where: { id: mapId, campaignId } });
      if (op !== "CREATE_MAP" && !current) throw new PortraitError("Karte nicht verfügbar.", 404);
      if (current && (!Number.isInteger(version) || version <= 0)) throw new PortraitError("Ungültige Kartenversion.");
      if (current && current.archived && !["SAVE_MAP", "DELETE_MAP"].includes(op)) throw new PortraitError("Karte zuerst aus dem Archiv wiederherstellen.");
      let resultId: string | null = current?.id || null;
      if (op === "CREATE_MAP" || op === "SAVE_MAP") {
        const data = parseAtlas(mapInput, input), maps = await tx.worldMap.findMany({ where: { campaignId }, select: { id: true, parentId: true } });
        assertAtlasParent(maps, mapId || "new-map", data.parentId);
        if (data.locationId && !await tx.location.findFirst({ where: { id: data.locationId, campaignId } })) throw new PortraitError("Ort gehört nicht zu dieser Kampagne.");
        if (current && await tx.mapMarker.count({ where: { childMapId: mapId, mapId: { not: data.parentId || "" } } })) throw new PortraitError("Vor dem Verschieben die eingehenden Detailkarten-Marker lösen.");
        if (op === "CREATE_MAP") {
          if (maps.length >= 100) throw new PortraitError("Maximal 100 Karten pro Kampagne.");
          resultId = (await tx.worldMap.create({ data: { ...data, campaignId } })).id;
        } else {
          const locked = await tx.worldMap.updateMany({ where: { id: mapId, campaignId, version }, data: { ...data, version: { increment: 1 } } }); if (locked.count !== 1) throw new PortraitError("Karte wurde inzwischen geändert. Bitte neu laden.", 409);
        }
      } else {
        const locked = await tx.worldMap.updateMany({ where: { id: mapId, campaignId, version }, data: { version: { increment: 1 } } }); if (!locked.count) throw new PortraitError("Karte wurde inzwischen geändert. Bitte neu laden.", 409);
        if (op === "DELETE_MAP") {
          if (!current!.archived || confirmation !== current!.name || await tx.worldMap.count({ where: { parentId: mapId } }) || await tx.mapMarker.count({ where: { childMapId: mapId } })) throw new PortraitError("Nur archivierte Karten ohne Unterkarten/eingehende Marker können mit Namensbestätigung gelöscht werden.");
          obsolete = current!.imageKey || undefined; await tx.worldMap.delete({ where: { id: mapId } }); resultId = null;
        } else if (op === "IMAGE" || op === "REMOVE_IMAGE") {
          if (op === "IMAGE") {
            const sum = await tx.worldMap.aggregate({ where: { campaignId }, _sum: { imageBytes: true } });
            if ((sum._sum.imageBytes ?? 0) - (current!.imageBytes ?? 0) + image!.byteSize > 512 * 1024 * 1024) throw new PortraitError("Karten-Speicherlimit von 512 MiB erreicht.");
          }
          obsolete = current!.imageKey || undefined;
          await tx.worldMap.update({ where: { id: mapId }, data: { imageKey: key || null, imageWidth: image?.width || null, imageHeight: image?.height || null, imageBytes: image?.byteSize || null } });
        } else if (op === "SAVE_MARKER") {
          const data = parseAtlas(markerInput, input);
          if (data.locationId && !await tx.location.findFirst({ where: { id: data.locationId, campaignId } })) throw new PortraitError("Ort gehört nicht zu dieser Kampagne.");
          if (data.childMapId && !await tx.worldMap.findFirst({ where: { id: data.childMapId, parentId: mapId, campaignId } })) throw new PortraitError("Detailkarte muss eine direkte Unterkarte dieser Karte sein.");
          if (id) {
            if (!(await tx.mapMarker.updateMany({ where: { id, mapId }, data })).count) throw new PortraitError("Marker gehört nicht zu dieser Karte.");
          } else {
            if (!current!.imageKey) throw new PortraitError("Zuerst ein Kartenbild hochladen.");
            if (await tx.mapMarker.count({ where: { mapId } }) >= 1000) throw new PortraitError("Maximal 1000 Marker pro Karte.");
            await tx.mapMarker.create({ data: { ...data, mapId } });
          }
        } else if (op === "MOVE_MARKER") {
          const data = parseAtlas(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(), input);
          if (!current!.imageKey || !(await tx.mapMarker.updateMany({ where: { id, mapId }, data })).count) throw new PortraitError("Marker nicht verfügbar.");
        } else if (op === "DELETE_MARKER" && !(await tx.mapMarker.deleteMany({ where: { id, mapId } })).count) throw new PortraitError("Marker gehört nicht zu dieser Karte.");
      }
      await tx.atlasChange.create({ data: { campaignId, requestId, payloadHash: hash, mapId: resultId } }); return resultId;
    }, { timeout: 60000 });
    if (replay && key) await atlasStorage().remove(key);
    if (obsolete) await atlasStorage().remove(obsolete).catch(() => console.warn("Nicht mehr referenzierte Kartendatei benötigt Bereinigung."));
    return { mapId: result };
  } catch (e) { if (key) await atlasStorage().remove(key); throw e; }
}
