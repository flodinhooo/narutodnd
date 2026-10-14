"use server";
import { createEncounterRun } from "@/lib/encounter-run-start";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { encounterSchema, encounterPlanSchema, encounterVersion, validateEncounter, formText, formJson, EncounterError } from "@/lib/encounters";
import { snapshotPlan } from "@/lib/encounter-snapshots";
import type { Prisma } from "@prisma/client";

const refresh = (campaignId: string) => revalidatePath(`/campaign/${campaignId}/encounters`, "layout");
async function load(tx: Prisma.TransactionClient, campaignId: string, id: string) {
  const e = await tx.encounter.findFirst({ where: { id, campaignId }, include: { participants: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, location: true } });
  if (!e) throw new EncounterError("Begegnung nicht verfügbar.");
  return e;
}
async function lock(tx: Prisma.TransactionClient, campaignId: string, id: string, version: number) {
  const changed = await tx.encounter.updateMany({ where: { id, campaignId, version }, data: { version: { increment: 1 } } });
  if (changed.count !== 1) throw new EncounterError("Begegnung wurde inzwischen geändert. Bitte neu laden.");
}
export async function saveEncounter(campaignId: string, id: string | null, fd: FormData) {
  await requireCampaign(campaignId, true);
  const data = validateEncounter(encounterSchema, { name: formText(fd, "name"), description: formText(fd, "description"), type: formText(fd, "type"), difficulty: formText(fd, "difficulty"), locationId: formText(fd, "locationId") || null, dmNotes: formText(fd, "dmNotes"), status: formText(fd, "status"), events: formJson(fd, "events") });
  const version = id ? encounterVersion(formText(fd, "version")) : null;
  const result = await prisma.$transaction(async tx => {
    if (data.locationId && !await tx.location.findFirst({ where: { id: data.locationId, campaignId } })) throw new EncounterError("Ort gehört nicht zu dieser Kampagne.");
    const old = id ? await load(tx, campaignId, id) : null;
    if (data.status === "READY" && ["COMBAT", "MIXED"].includes(data.type) && !old?.participants.length) throw new EncounterError("Für einen Kampf zuerst Teilnehmer im Entwurf hinzufügen.");
    if (!id) return (await tx.encounter.create({ data: { ...data, campaignId } })).id;
    await lock(tx, campaignId, id, version!);
    await tx.encounter.update({ where: { id, campaignId }, data });
    return id;
  });
  refresh(campaignId);
  return result;
}
export async function saveEncounterParticipant(campaignId: string, encounterId: string, planId: string | null, expectedVersion: number, fd: FormData) {
  await requireCampaign(campaignId, true);
  const overrideKeys = ["name", "maxHp", "maxChakra", "ac", "initiativeBonus"];
  const overrides = Object.fromEntries(overrideKeys.map(key => [key, formText(fd, `override_${key}`)]).filter(([, value]) => value !== "").map(([key, value]) => [key, key === "name" ? value : Number(value)]));
  const input = validateEncounter(encounterPlanSchema, { source: formText(fd, "source"), sourceId: formText(fd, "sourceId"), quantity: Number(formText(fd, "quantity")), side: formText(fd, "side"), notes: formText(fd, "notes"), overrides });
  const version = encounterVersion(expectedVersion);
  await prisma.$transaction(async tx => {
    const e = await load(tx, campaignId, encounterId);
    if (e.status === "ARCHIVED") throw new EncounterError("Archivierte Vorlage zuerst wiederherstellen.");
    const old = planId ? e.participants.find(p => p.id === planId) : null;
    if (planId && !old) throw new EncounterError("Teilnehmer gehört nicht zu dieser Begegnung.");
    if (input.source !== "ENEMY" && e.participants.some(p => p.id !== planId && (input.source === "NPC" ? p.npcId === input.sourceId : p.characterId === input.sourceId))) throw new EncounterError("Diese Person ist bereits beteiligt.");
    if (e.participants.filter(p => p.id !== planId).reduce((sum, p) => sum + p.quantity, 0) + input.quantity > 100) throw new EncounterError("Maximal 100 Teilnehmer pro Run.");
    const data = { encounterId, enemyTemplateId: input.source === "ENEMY" ? input.sourceId : null, characterId: input.source === "CHARACTER" ? input.sourceId : null, npcId: input.source === "NPC" ? input.sourceId : null, quantity: input.quantity, side: input.side, notes: input.notes, overrides: input.overrides };
    await snapshotPlan(tx, campaignId, { ...data, id: planId ?? "validation", createdAt: new Date() });
    await lock(tx, campaignId, encounterId, version);
    if (planId) await tx.encounterParticipantPlan.update({ where: { id: planId, encounterId }, data });
    else await tx.encounterParticipantPlan.create({ data });
  });
  refresh(campaignId);
}
export async function removeEncounterParticipant(campaignId: string, encounterId: string, planId: string, expectedVersion: number) {
  await requireCampaign(campaignId, true);
  await prisma.$transaction(async tx => {
    const e = await load(tx, campaignId, encounterId);
    if (e.status === "ARCHIVED") throw new EncounterError("Archivierte Vorlage zuerst wiederherstellen.");
    if (!e.participants.some(p => p.id === planId)) throw new EncounterError("Teilnehmer gehört nicht zu dieser Begegnung.");
    if (e.status === "READY" && ["COMBAT", "MIXED"].includes(e.type) && e.participants.length === 1) throw new EncounterError("Vor dem Entfernen des letzten Teilnehmers zurück auf Entwurf setzen.");
    await lock(tx, campaignId, encounterId, encounterVersion(expectedVersion));
    await tx.encounterParticipantPlan.delete({ where: { id: planId, encounterId } });
  });
  refresh(campaignId);
}
export async function deleteEncounter(campaignId: string, id: string, expectedVersion: number, fd: FormData) {
  await requireCampaign(campaignId, true);
  await prisma.$transaction(async tx => {
    const e = await load(tx, campaignId, id);
    if (e.status !== "ARCHIVED" || formText(fd, "confirmation") !== e.name) throw new EncounterError("Zuerst archivieren und den Namen zum Löschen bestätigen.");
    if (await tx.encounterRun.count({ where: { encounterId: id } })) throw new EncounterError("Vorlagen mit Run-Historie bleiben erhalten. Archivierung verwenden.");
    await lock(tx, campaignId, id, encounterVersion(expectedVersion));
    await tx.encounter.delete({ where: { id, campaignId } });
  });
  refresh(campaignId);
}
export async function startEncounterRun(campaignId: string, encounterId: string, expectedVersion: number, requestId: string) {
  await requireCampaign(campaignId, true);
  const version = encounterVersion(expectedVersion);
  validateEncounter(z.uuid(), requestId);
  const runId = await prisma.$transaction(tx => createEncounterRun(tx, campaignId, encounterId, version, requestId), { timeout: 30000 });
  refresh(campaignId);
  return runId;
}
