import { MissionRank, MissionStatus, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { requireCampaign } from "./session";

export const missionInclude = {
  clientNpc: { select: { id: true, name: true } }, location: { select: { id: true, name: true } },
  objectives: { orderBy: { position: "asc" }, include: { dependencies: true } },
  npcs: { include: { npc: { select: { id: true, name: true, archived: true } } } },
  encounters: { orderBy: { position: "asc" }, include: { encounter: { select: { id: true, name: true, version: true, status: true } } } },
  runs: { include: { run: { select: { id: true, name: true, status: true, summary: true, round: true } } } },
  sessions: { include: { session: { select: { id: true, title: true, number: true, version: true } } } },
  consequences: { include: { application: true, npc: { select: { name: true, attitude: true, updatedAt: true } }, organization: { select: { name: true, attitude: true, updatedAt: true } }, targetMission: { select: { title: true, version: true, status: true } }, objective: { select: { title: true, enabled: true } } } },
} satisfies Prisma.MissionInclude;
export type DmMission = Prisma.MissionGetPayload<{ include: typeof missionInclude }>;
export async function getDmMission(campaignId: string, id: string) { await requireCampaign(campaignId, true); return prisma.mission.findFirst({ where: { id, campaignId }, include: missionInclude }); }
export const publishedMission = { playerVisible: true, archived: false, status: { not: "DRAFT" as const } };
export async function getPlayerMission(campaignId: string, id: string) {
  await requireCampaign(campaignId);
  const m = await prisma.mission.findFirst({ where: { id, campaignId, ...publishedMission }, select: {
    id: true, title: true, rank: true, publicInformation: true, rewards: true, status: true, version: true, clientNpcId: true, locationId: true,
    objectives: { where: { playerVisible: true, enabled: true }, orderBy: { position: "asc" }, select: { id: true, title: true, description: true, position: true, status: true, optional: true, dependencies: { select: { prerequisite: { select: { status: true } } } } } },
    npcs: { where: { npc: { campaignId, playerVisible: true, archived: false } }, select: { npc: { select: { id: true, name: true } } } },
  } });
  if (!m) return null;
  const [clientNpc, location] = await Promise.all([
    m.clientNpcId ? prisma.npc.findFirst({ where: { id: m.clientNpcId, campaignId, playerVisible: true, archived: false }, select: { id: true, name: true } }) : null,
    m.locationId ? prisma.location.findFirst({ where: { id: m.locationId, campaignId, playerVisible: true }, select: { id: true, name: true, slug: true } }) : null,
  ]);
  return { id: m.id, title: m.title, rank: m.rank, publicInformation: m.publicInformation, rewards: m.rewards, status: m.status, version: m.version, clientNpc, location, npcs: m.npcs.map(n => n.npc), objectives: m.objectives.map(o => ({ id: o.id, title: o.title, description: o.description, status: o.status, optional: o.optional, available: o.dependencies.every(d => d.prerequisite.status === "COMPLETED") })) };
}
export async function listMissions(campaignId: string, filters: { q?: string; rank?: string; status?: string; archived?: string } = {}) {
  const session = await requireCampaign(campaignId), dm = session.role === "DM";
  const rank = Object.values(MissionRank).find(r => r === filters.rank), status = Object.values(MissionStatus).find(r => r === filters.status);
  return prisma.mission.findMany({ where: { campaignId, ...(dm ? { archived: filters.archived === "true" } : publishedMission), ...(rank ? { rank } : {}), ...(status ? { AND: [{ status }] } : {}), ...(filters.q ? { title: { contains: filters.q.slice(0, 200) } } : {}) }, select: { id: true, title: true, rank: true, status: true, publicInformation: true, rewards: true }, orderBy: { updatedAt: "desc" } });
}
export async function missionOptions(campaignId: string) {
  await requireCampaign(campaignId, true);
  const [npcs, locations, encounters, organizations, missions, sessions, runs] = await Promise.all([
    prisma.npc.findMany({ where: { campaignId, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { campaignId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.encounter.findMany({ where: { campaignId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.organization.findMany({ where: { campaignId, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mission.findMany({ where: { campaignId, archived: false }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.gameSession.findMany({ where: { campaignId }, select: { id: true, title: true, number: true, version: true }, orderBy: { number: "desc" } }),
    prisma.encounterRun.findMany({ where: { campaignId }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { npcs, locations, encounters, organizations, missions, sessions, runs };
}
export async function listMissionTemplates(campaignId: string) { await requireCampaign(campaignId, true); return prisma.missionTemplate.findMany({ select: { id: true, seedKey: true, title: true, rank: true, summary: true }, orderBy: { seedKey: "asc" } }); }
