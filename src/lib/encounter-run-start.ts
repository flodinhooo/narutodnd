import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { EncounterError, encounterSchema, validateEncounter } from "./encounters";
import { snapshotPlan } from "./encounter-snapshots";

async function load(tx: Prisma.TransactionClient, campaignId: string, id: string) {
  const e = await tx.encounter.findFirst({ where: { id, campaignId }, include: { participants: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, location: true } });
  if (!e) throw new EncounterError("Begegnung nicht verfügbar.");
  return e;
}

export async function createEncounterRun(tx: Prisma.TransactionClient, campaignId: string, encounterId: string, version: number, requestId: string) {
  const startHash = createHash("sha256").update(JSON.stringify({ encounterId, version })).digest("hex");
    const prior = await tx.encounterRun.findUnique({ where: { campaignId_startRequestId: { campaignId, startRequestId: requestId } } });
    if (prior) { if (prior.startHash !== startHash) throw new EncounterError("Request-ID wurde bereits für einen anderen Start verwendet."); return prior.id; }
    const e = await load(tx, campaignId, encounterId);
    if (e.status !== "READY" || e.version !== version) throw new EncounterError("Vorlage ist nicht bereit oder wurde inzwischen geändert. Bitte neu laden.");
    if (e.participants.reduce((sum, p) => sum + p.quantity, 0) > 100) throw new EncounterError("Maximal 100 Teilnehmer pro Run.");
    const participants: Prisma.EncounterRunParticipantUncheckedCreateWithoutRunInput[] = [];
    for (const p of e.participants) {
      const base = await snapshotPlan(tx, campaignId, p);
      for (let i = 0; i < p.quantity; i++) participants.push({ ...base, name: p.quantity > 1 ? `${base.name} ${i + 1}` : base.name, ordinal: participants.length });
    }
    if (["COMBAT", "MIXED"].includes(e.type) && !participants.some(p => p.maxHp != null)) throw new EncounterError("Ein Kampf benötigt mindestens einen Teilnehmer mit Kampfwerten.");
    const events = validateEncounter(encounterSchema.shape.events, e.events).map(event => ({ ...event, done: false }));
    return (await tx.encounterRun.create({ data: {
      campaignId, encounterId, templateVersion: e.version, startRequestId: requestId, startHash, name: e.name, description: e.description, type: e.type, difficulty: e.difficulty,
      dmNotes: e.dmNotes, locationName: e.location?.name ?? "", events, participants: { create: participants },
    } })).id;
}
