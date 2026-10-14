"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { EncounterError, encounterVersion, formText } from "@/lib/encounters";

export async function setSessionContent(campaignId: string, sessionId: string, version: number, fd: FormData) {
  await requireCampaign(campaignId, true);
  const kind = formText(fd, "kind"), id = formText(fd, "id"), assigned = formText(fd, "assigned") === "true";
  if (!["MISSION", "RUN"].includes(kind) || !id) throw new EncounterError("Ungültige Session-Verknüpfung.");
  await prisma.$transaction(async tx => {
    const session = await tx.gameSession.findFirst({ where: { id: sessionId, campaignId } }); if (!session) throw new EncounterError("Session nicht verfügbar.");
    if (kind === "MISSION" && !await tx.mission.findFirst({ where: { id, campaignId } })) throw new EncounterError("Mission gehört nicht zu dieser Kampagne.");
    if (kind === "RUN" && !await tx.encounterRun.findFirst({ where: { id, campaignId } })) throw new EncounterError("Run gehört nicht zu dieser Kampagne.");
    const exists = kind === "MISSION" ? await tx.sessionMission.findUnique({ where: { sessionId_missionId: { sessionId, missionId: id } } }) : await tx.sessionEncounterRun.findUnique({ where: { sessionId_runId: { sessionId, runId: id } } });
    if (Boolean(exists) === assigned) return;
    const locked = await tx.gameSession.updateMany({ where: { id: sessionId, campaignId, version: encounterVersion(version) }, data: { version: { increment: 1 } } });
    if (locked.count !== 1) throw new EncounterError("Session wurde inzwischen geändert. Bitte neu laden.");
    if (kind === "MISSION") { if (assigned) await tx.sessionMission.create({ data: { sessionId, missionId: id } }); else await tx.sessionMission.delete({ where: { sessionId_missionId: { sessionId, missionId: id } } }); }
    else { if (assigned) await tx.sessionEncounterRun.create({ data: { sessionId, runId: id } }); else await tx.sessionEncounterRun.delete({ where: { sessionId_runId: { sessionId, runId: id } } }); }
  }); revalidatePath(`/campaign/${campaignId}`, "layout");
}
