import { prisma } from "./prisma";
import { requireCampaign } from "./session";

export async function getDmDashboard(campaignId: string) {
  await requireCampaign(campaignId, true);
  const [sessions, missions, runs] = await Promise.all([
    prisma.gameSession.findMany({ where: { campaignId, status: { in: ["ACTIVE", "PLANNED"] } }, orderBy: [{ status: "asc" }, { number: "desc" }], take: 6, select: { id: true, number: true, title: true, status: true } }),
    prisma.mission.findMany({ where: { campaignId, archived: false, status: { in: ["ACTIVE", "ACCEPTED"] } }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, title: true, rank: true, status: true, objectives: { where: { optional: false }, select: { status: true } } } }),
    prisma.encounterRun.findMany({ where: { campaignId, status: { in: ["ACTIVE", "PREPARING"] } }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, status: true, round: true } }),
  ]);
  return { sessions, missions, runs };
}
