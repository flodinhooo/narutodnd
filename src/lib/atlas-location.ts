import { prisma } from "./prisma";
import { atlasActor, atlasCatalog } from "./atlas-library";
import { publishedMission } from "./mission-library";
export async function atlasLocationDetail(campaignId: string, id: string) {
  const actor = await atlasActor(campaignId), dm = actor.role === "DM";
  const location = await prisma.location.findFirst({ where: { id, campaignId, ...(!dm ? { playerVisible: true } : {}) }, select: { id: true, type: true, name: true, slug: true, description: true, shortDescription: true, parentId: true } });
  if (!location) return null;
  const [parent, children, npcs, organizations, missions, encounters, catalog] = await Promise.all([
    location.parentId ? prisma.location.findFirst({ where: { id: location.parentId, campaignId, ...(!dm ? { playerVisible: true } : {}) }, select: { id: true, name: true, slug: true } }) : null,
    prisma.location.findMany({ where: { parentId: id, campaignId, ...(!dm ? { playerVisible: true } : {}) }, select: { id: true, name: true, slug: true } }),
    prisma.npc.findMany({ where: { locationId: id, campaignId, archived: false, ...(!dm ? { playerVisible: true } : {}) }, select: { id: true, name: true, characterId: true } }),
    prisma.organization.findMany({ where: { locationId: id, campaignId, archived: false, ...(!dm ? { playerVisible: true } : {}) }, select: { id: true, name: true } }),
    prisma.mission.findMany({ where: { locationId: id, campaignId, ...(!dm ? publishedMission : {}) }, select: { id: true, title: true, rank: true, status: true } }),
    dm ? prisma.encounter.findMany({ where: { locationId: id, campaignId }, select: { id: true, name: true, type: true } }) : [],
    atlasCatalog(campaignId),
  ]);
  return { location: { id: location.id, type: location.type, name: location.name, slug: location.slug, description: location.description, shortDescription: location.shortDescription }, parent, children, npcs, organizations, missions, encounters, maps: catalog.maps.filter(m => m.locationId === id).map(m => ({ id: m.id, name: m.name })) };
}
export type AtlasLocationView = NonNullable<Awaited<ReturnType<typeof atlasLocationDetail>>>;
