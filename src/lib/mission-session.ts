import { prisma } from "./prisma";
import { requireCampaign } from "./session";
import { getDmMission, getPlayerMission, publishedMission } from "./mission-library";

export async function getSessionDashboard(campaignId: string, sessionId: string) {
  const access = await requireCampaign(campaignId);
  if (access.role === "DM") {
    const session = await prisma.gameSession.findFirst({ where: { id: sessionId, campaignId }, include: { missionLinks: { select: { missionId: true } }, encounterRunLinks: { include: { run: { select: { id: true, name: true, status: true, round: true, summary: true } } } } } });
    if (!session) return null;
    const missions = await Promise.all(session.missionLinks.map(link => getDmMission(campaignId, link.missionId)));
    return { role: "DM" as const, session, missions: missions.filter(m => m !== null) };
  }
  const session = await prisma.gameSession.findFirst({ where: { id: sessionId, campaignId }, select: { id: true, number: true, title: true, summary: true, playerNotes: true, status: true, missionLinks: { where: { mission: { campaignId, ...publishedMission } }, select: { missionId: true } } } });
  if (!session) return null;
  const missions = await Promise.all(session.missionLinks.map(link => getPlayerMission(campaignId, link.missionId)));
  return { role: "PLAYER" as const, session: { id: session.id, number: session.number, title: session.title, summary: session.summary, playerNotes: session.playerNotes, status: session.status }, missions: missions.filter(m => m !== null) };
}
