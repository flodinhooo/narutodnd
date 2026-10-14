import type { Prisma } from "@prisma/client";
import { EncounterError } from "./encounters";
import { missionInclude } from "./mission-library";
export async function loadMission(tx: Prisma.TransactionClient, campaignId: string, id: string) {
  const m = await tx.mission.findFirst({ where: { id, campaignId }, include: missionInclude });
  if (!m) throw new EncounterError("Mission nicht verfügbar."); return m;
}
export async function lockMission(tx: Prisma.TransactionClient, campaignId: string, id: string, version: number) {
  if (!Number.isInteger(version) || version < 1) throw new EncounterError("Ungültige Missionsversion.");
  const result = await tx.mission.updateMany({ where: { id, campaignId, version }, data: { version: { increment: 1 } } });
  if (result.count !== 1) throw new EncounterError("Mission wurde inzwischen geändert. Bitte neu laden.");
}
