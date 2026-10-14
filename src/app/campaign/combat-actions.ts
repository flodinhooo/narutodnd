"use server";

import { createHash, randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { combatRequestSchema, runEventsSchema, validateEncounter, EncounterError, type CombatResult } from "@/lib/encounters";
import { runInclude } from "@/lib/encounter-library";
import { canTakeTurn, initiativeOrder, nextEncounterTurn, encounterHpChange, encounterChakraChange } from "@/lib/rules/encounters";

export async function reloadEncounterRun(campaignId: string, runId: string) {
  await requireCampaign(campaignId, true);
  return prisma.encounterRun.findFirst({ where: { id: runId, campaignId }, include: runInclude });
}

export async function performCombatAction(campaignId: string, runId: string, submitted: unknown): Promise<CombatResult> {
  await requireCampaign(campaignId, true);
  try {
    const input = validateEncounter(combatRequestSchema, submitted), command = input.command;
    const payloadHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const run = await prisma.$transaction(async tx => {
      const old = await tx.encounterRun.findFirst({ where: { id: runId, campaignId }, include: runInclude });
      if (!old) throw new EncounterError("Durchführung nicht verfügbar.");
      const previous = await tx.encounterRunAction.findUnique({ where: { runId_requestId: { runId, requestId: input.requestId } } });
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new EncounterError("Request-ID bereits für eine andere Aktion verwendet.");
        return old;
      }
      if (old.status === "COMPLETED" || old.status === "CANCELLED") throw new EncounterError("Diese Durchführung ist beendet und schreibgeschützt.");
      const changed = await tx.encounterRun.updateMany({ where: { id: runId, campaignId, version: input.expectedVersion }, data: { version: { increment: 1 } } });
      if (changed.count !== 1) throw new EncounterError("Der Kampfstand wurde inzwischen geändert. Bitte Stand aktualisieren.");
      const p = "participantId" in command && command.participantId ? old.participants.find(p => p.id === command.participantId) : null;
      if ("participantId" in command && command.participantId && !p) throw new EncounterError("Teilnehmer gehört nicht zu diesem Run.");
      const preparing = () => { if (old.status !== "PREPARING") throw new EncounterError("Initiative kann nur vor Beginn der Zugreihenfolge geändert werden."); };
      const active = () => { if (old.status !== "ACTIVE") throw new EncounterError("Begegnung ist noch nicht aktiv."); };
      const updateParticipant = (data: Prisma.EncounterRunParticipantUpdateManyMutationInput) => tx.encounterRunParticipant.updateMany({ where: { id: p!.id, runId }, data });
      switch (command.kind) {
        case "INITIATIVE": {
          preparing(); if (p!.maxHp === null) throw new EncounterError("Dieser Teilnehmer hat keine Kampfinitiative.");
          await updateParticipant({ initiative: command.value }); break;
        }
        case "ROLL_INITIATIVE": {
          preparing();
          const targets = p ? [p] : old.participants.filter(p => p.maxHp !== null);
          if (!targets.length || targets.some(p => p.maxHp === null)) throw new EncounterError("Keine passenden Kampfteilnehmer.");
          for (const target of targets) await tx.encounterRunParticipant.update({ where: { id: target.id, runId }, data: { initiative: randomInt(1, 21) + target.initiativeBonus } });
          break;
        }
        case "BEGIN": {
          preparing();
          const combatants = old.participants.filter(p => p.maxHp !== null);
          if (combatants.some(p => p.initiative === null)) throw new EncounterError("Zuerst Initiative für alle Kampfteilnehmer erfassen oder würfeln.");
          const order = initiativeOrder(combatants.filter(canTakeTurn));
          if (!order.length && ["COMBAT", "MIXED"].includes(old.type)) throw new EncounterError("Keine handlungsfähigen Kampfteilnehmer.");
          await tx.encounterRun.update({ where: { id: runId }, data: { status: "ACTIVE", round: 1, activeParticipantId: order[0]?.id ?? null, startedAt: new Date() } });
          break;
        }
        case "NEXT": {
          active();
          await tx.encounterRun.update({ where: { id: runId }, data: nextEncounterTurn(old.participants, old.activeParticipantId, old.round) });
          break;
        }
        case "DAMAGE": case "HEAL": {
          const patch = encounterHpChange(p!.currentHp, p!.maxHp, command.amount, command.kind === "HEAL");
          await updateParticipant({ ...patch, unconscious: patch.currentHp === 0 || (p!.unconscious && !(command.kind === "HEAL" && p!.currentHp === 0)) });
          break;
        }
        case "SPEND_CHAKRA": case "RESTORE_CHAKRA": {
          await updateParticipant({ currentChakra: encounterChakraChange(p!.currentChakra, p!.maxChakra, command.amount, command.kind === "RESTORE_CHAKRA") }); break;
        }
        case "FLAGS": {
          if (p!.currentHp === 0 && !command.unconscious) throw new EncounterError("Teilnehmer mit 0 HP bleiben bewusstlos. Zuerst heilen.");
          await updateParticipant({ defeated: command.defeated, unconscious: command.unconscious }); break;
        }
        case "CONDITIONS": await updateParticipant({ conditions: command.conditions }); break;
        case "PARTICIPANT_NOTES": await updateParticipant({ notes: command.notes }); break;
        case "RUN_NOTES": await tx.encounterRun.update({ where: { id: runId }, data: { notes: command.notes } }); break;
        case "EVENT": {
          const events = validateEncounter(runEventsSchema, old.events);
          if (!events.some(e => e.id === command.eventId)) throw new EncounterError("Ereignis gehört nicht zu diesem Run.");
          await tx.encounterRun.update({ where: { id: runId }, data: { events: events.map(e => e.id === command.eventId ? { ...e, done: command.done } : e) } }); break;
        }
        case "COMPLETE": case "CANCEL": {
          if (command.kind === "COMPLETE") active();
          await tx.encounterRun.update({ where: { id: runId }, data: { status: command.kind === "COMPLETE" ? "COMPLETED" : "CANCELLED", endedAt: new Date(), summary: command.summary, activeParticipantId: null } }); break;
        }
      }
      await tx.encounterRunAction.create({ data: { runId, requestId: input.requestId, payloadHash, kind: command.kind, appliedVersion: old.version + 1 } });
      return tx.encounterRun.findUniqueOrThrow({ where: { id: runId }, include: runInclude });
    });
    revalidatePath(`/campaign/${campaignId}/encounters`, "layout");
    return { ok: true, run };
  } catch (error) {
    if (error instanceof EncounterError) return { ok: false, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2028", "P1008", "P2002"].includes(error.code)) return { ok: false, error: "Gleichzeitige Änderung erkannt. Bitte Stand aktualisieren und erneut versuchen." };
    throw error;
  }
}
