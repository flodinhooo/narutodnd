import { prisma } from "./prisma";
import { getSession } from "./session";
import { PortraitError } from "./portrait-image";
import { visibleAtlasIds } from "./atlas-schema";
import { createHash } from "node:crypto";
export async function atlasActor(campaignId: string, dm = false) {
  const actor = await getSession();
  if (!actor || actor.campaignId !== campaignId || !["DM", "PLAYER"].includes(actor.role)) throw new PortraitError("Atlas nicht verfügbar.", 404);
  if (dm && actor.role !== "DM") throw new PortraitError("Diese Aktion erfordert DM-Rechte.", 403);
  return actor;
}
const mapSelect = { id: true, name: true, description: true, type: true, parentId: true, locationId: true, imageKey: true, imageWidth: true, imageHeight: true, playerVisible: true, archived: true, sortOrder: true, version: true } as const;
export async function atlasCatalog(campaignId: string) {
  const actor = await atlasActor(campaignId);
  const all = await prisma.worldMap.findMany({ where: { campaignId }, select: mapSelect, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const visible = visibleAtlasIds(all);
  const maps = actor.role === "DM" ? all : all.filter(m => visible.has(m.id));
  const locations = await prisma.location.findMany({ where: { campaignId, ...(actor.role !== "DM" ? { playerVisible: true } : {}) }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
  const allowedLocations = new Set(locations.map(l => l.id));
  return { role: actor.role as "DM" | "PLAYER", maps: maps.map(({ imageKey, ...m }) => ({ ...m, imageStamp: imageKey ? createHash("sha256").update(imageKey).digest("hex").slice(0, 16) : null, locationId: m.locationId && allowedLocations.has(m.locationId) ? m.locationId : null })), locations };
}
export type AtlasCatalog = Awaited<ReturnType<typeof atlasCatalog>>;
export async function atlasDetail(campaignId: string, mapId: string) {
  const catalog = await atlasCatalog(campaignId), map = catalog.maps.find(m => m.id === mapId);
  if (!map) throw new PortraitError("Karte nicht verfügbar.", 404);
  const allowedMaps = new Set(catalog.maps.map(m => m.id)), allowedLocations = new Set(catalog.locations.map(l => l.id));
  const markers = await prisma.mapMarker.findMany({ where: { mapId, ...(catalog.role !== "DM" ? { playerVisible: true } : {}) }, select: { id: true, x: true, y: true, title: true, description: true, category: true, icon: true, color: true, playerVisible: true, locationId: true, childMapId: true }, orderBy: { title: "asc" } });
  const safeMarkers = catalog.role === "DM" ? markers : markers.filter(m => (!m.locationId || allowedLocations.has(m.locationId)) && (!m.childMapId || allowedMaps.has(m.childMapId)));
  const dmNotes = catalog.role === "DM" ? (await prisma.worldMap.findUnique({ where: { id: mapId }, select: { dmNotes: true } }))?.dmNotes ?? "" : undefined;
  return { ...catalog, map: { ...map, ...(dmNotes !== undefined ? { dmNotes } : {}) }, markers: safeMarkers };
}
export type AtlasDetail = Awaited<ReturnType<typeof atlasDetail>>;
export type AtlasMapView = AtlasDetail["map"];
export type AtlasMarkerView = AtlasDetail["markers"][number];
