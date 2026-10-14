"use server";
import { EncounterError } from "@/lib/action-error";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { npcSchema, organizationSchema, parsePeopleForm, relationshipTypes } from "@/lib/campaign-people";
import { calculateMaxChakra, calculateMaxHp } from "@/lib/rules";
import type { Prisma } from "@prisma/client";

function refresh(campaignId: string) { revalidatePath(`/campaign/${campaignId}`, "layout"); }
async function location(tx: Prisma.TransactionClient, campaignId: string, id: string | null) {
  if (id && !await tx.location.findFirst({ where: { id, campaignId } })) throw new EncounterError("Ort gehört nicht zu dieser Kampagne.");
}
async function npc(tx: Prisma.TransactionClient, campaignId: string, id: string) {
  const value = await tx.npc.findFirst({ where: { id, campaignId } });
  if (!value) throw new EncounterError("NPC nicht gefunden.");
  return value;
}
async function organization(tx: Prisma.TransactionClient, campaignId: string, id: string) {
  const value = await tx.organization.findFirst({ where: { id, campaignId } });
  if (!value) throw new EncounterError("Organisation nicht gefunden.");
  return value;
}

export async function saveNpc(campaignId: string, id: string | null, fd: FormData) {
  await requireCampaign(campaignId, true);
  const data = parsePeopleForm(npcSchema, fd);
  const result = await prisma.$transaction(async tx => {
    await location(tx, campaignId, data.locationId);
    if (!id) return tx.npc.create({ data: { ...data, campaignId } });
    const old = await npc(tx, campaignId, id);
    if (old.characterId) await tx.character.update({ where: { id: old.characterId, campaignId }, data: { name: data.name } });
    return tx.npc.update({ where: { id, campaignId }, data });
  });
  refresh(campaignId);
  return result.id;
}

export async function archiveNpc(campaignId: string, id: string, archived: boolean) {
  await requireCampaign(campaignId, true);
  if (typeof archived !== "boolean") throw new EncounterError("Ungültiger Archivstatus.");
  await prisma.$transaction(async tx => { await npc(tx, campaignId, id); await tx.npc.update({ where: { id, campaignId }, data: { archived } }); });
  refresh(campaignId);
}

export async function deleteNpc(campaignId: string, id: string, fd: FormData) {
  await requireCampaign(campaignId, true);
  await prisma.$transaction(async tx => {
    const old = await npc(tx, campaignId, id);
    if (!old.archived || fd.get("confirmation") !== old.name) throw new EncounterError("Zuerst archivieren und zum Löschen den Namen bestätigen.");
    // Linked combat sheets are preserved; require unlinking explicitly before deletion.
    if (old.characterId) throw new EncounterError("NPC mit Charakterbogen kann nur archiviert werden.");
    await tx.npc.delete({ where: { id, campaignId } });
  });
  refresh(campaignId);
}

export async function enableNpcCombat(campaignId: string, id: string, fd: FormData) {
  await requireCampaign(campaignId, true);
  const existingId = String(fd.get("characterId") ?? "");
  await prisma.$transaction(async tx => {
    const old = await npc(tx, campaignId, id);
    if (old.characterId) return; // Repeated activation never creates another sheet.
    if (existingId) {
      const c = await tx.character.findFirst({ where: { id: existingId, campaignId, npc: null } });
      if (!c) throw new EncounterError("Charakter nicht verfügbar.");
      if (await tx.organizationMember.count({ where: { characterId: c.id } }) || await tx.characterRelationship.count({ where: { OR: [{sourceCharacterId:c.id},{targetCharacterId:c.id}] } })) throw new EncounterError("Charakter besitzt bereits Mitgliedschaften oder Beziehungen. Zuerst diese Einträge entfernen und danach über das NPC-Profil neu zuordnen.");
      const [characterPortraits, npcPortraits] = await Promise.all([
        tx.portrait.count({ where: { characterId: c.id, campaignId } }), tx.portrait.count({ where: { npcId: id, campaignId } }),
      ]);
      if (characterPortraits + npcPortraits > 10) throw new EncounterError("Vor dem Verknüpfen die Portraits auf insgesamt zehn Varianten reduzieren.");
      if (await tx.portrait.findFirst({ where: { npcId: id, isDefault: true } })) await tx.portrait.updateMany({ where: { characterId: c.id }, data: { isDefault: false, version: { increment: 1 } } });
      await tx.portrait.updateMany({ where: { characterId: c.id, campaignId }, data: { characterId: null, npcId: id, version: { increment: 1 } } });
      await tx.character.update({ where: { id: c.id, campaignId }, data: { name: old.name, portraitOwnerKey: null } });
      await tx.npc.update({ where: { id, campaignId }, data: { characterId: c.id } });
      return;
    }
    const maxHp = calculateMaxHp(1, 10, "d10");
    const c = await tx.character.create({ data: {
      campaignId, name: old.name, maxHp, currentHp: maxHp,
      currentChakra: calculateMaxChakra(1, 10, 10, "AVERAGE"), dmData: { create: {} },
    } });
    await tx.npc.update({ where: { id, campaignId }, data: { characterId: c.id } });
  });
  refresh(campaignId);
}

export async function saveOrganization(campaignId: string, id: string | null, fd: FormData) {
  await requireCampaign(campaignId, true);
  const data = parsePeopleForm(organizationSchema, fd);
  const result = await prisma.$transaction(async tx => {
    await location(tx, campaignId, data.locationId);
    if (!id) return tx.organization.create({ data: { ...data, campaignId } });
    await organization(tx, campaignId, id);
    return tx.organization.update({ where: { id, campaignId }, data });
  });
  refresh(campaignId);
  return result.id;
}

export async function archiveOrganization(campaignId: string, id: string, archived: boolean) {
  await requireCampaign(campaignId, true);
  if (typeof archived !== "boolean") throw new EncounterError("Ungültiger Archivstatus.");
  await prisma.$transaction(async tx => { await organization(tx, campaignId, id); await tx.organization.update({ where: { id, campaignId }, data: { archived } }); });
  refresh(campaignId);
}

// A person is addressed through the NPC identity when one exists, so promotion
// never loses memberships or relationships and cannot introduce duplicate people.
async function person(tx: Prisma.TransactionClient, campaignId: string, value: string) {
  const [kind, id, extra] = value.split(":");
  if (!id || extra) throw new EncounterError("Ungültige Person.");
  if (kind === "npc") {
    const n = await npc(tx, campaignId, id);
    if (n.archived) throw new EncounterError("NPC ist archiviert.");
    return { npcId: id, characterId: null };
  }
  if (kind === "character" && await tx.character.findFirst({ where: { id, campaignId, npc: null } })) return { npcId: null, characterId: id };
  throw new EncounterError("Person gehört nicht zu dieser Kampagne.");
}

export async function setOrganizationMember(campaignId: string, organizationId: string, fd: FormData) {
  await requireCampaign(campaignId, true);
  const role = String(fd.get("role") ?? "").trim();
  if (role.length > 200) throw new EncounterError("Rolle ist zu lang.");
  await prisma.$transaction(async tx => {
    const org = await organization(tx, campaignId, organizationId);
    if (org.archived) throw new EncounterError("Organisation ist archiviert.");
    const p = await person(tx, campaignId, String(fd.get("person") ?? ""));
    const data = { ...p, role, isLeader: fd.get("isLeader") === "on" };
    if (p.npcId) await tx.organizationMember.upsert({ where: { organizationId_npcId: { organizationId, npcId: p.npcId } }, create: { organizationId, ...data }, update: data });
    else await tx.organizationMember.upsert({ where: { organizationId_characterId: { organizationId, characterId: p.characterId! } }, create: { organizationId, ...data }, update: data });
  });
  refresh(campaignId);
}

export async function removeOrganizationMember(campaignId: string, organizationId: string, memberId: string) {
  await requireCampaign(campaignId, true);
  await prisma.$transaction(async tx => { await organization(tx, campaignId, organizationId); await tx.organizationMember.deleteMany({ where: { id: memberId, organizationId } }); });
  refresh(campaignId);
}

export async function saveRelationship(campaignId: string, fd: FormData) {
  await requireCampaign(campaignId, true);
  const type = String(fd.get("type") ?? ""), description = String(fd.get("description") ?? "").trim(), dmSecrets = String(fd.get("dmSecrets") ?? "").trim();
  if (!Object.hasOwn(relationshipTypes, type) || description.length > 10000 || dmSecrets.length > 10000) throw new EncounterError("Ungültige Beziehung.");
  const source = String(fd.get("source") ?? ""), target = String(fd.get("target") ?? "");
  if (source === target) throw new EncounterError("Eine Beziehung benötigt zwei unterschiedliche Personen.");
  await prisma.$transaction(async tx => {
    const a = await person(tx, campaignId, source), b = await person(tx, campaignId, target);
    const endpoints = { campaignId, sourceNpcId: a.npcId, sourceCharacterId: a.characterId, targetNpcId: b.npcId, targetCharacterId: b.characterId, type };
    const existing = await tx.characterRelationship.findFirst({ where: endpoints });
    const data = { ...endpoints, description, dmSecrets, playerVisible: fd.get("playerVisible") === "on" };
    if (existing) await tx.characterRelationship.update({ where: { id: existing.id, campaignId }, data });
    else await tx.characterRelationship.create({ data });
  });
  refresh(campaignId);
}

export async function deleteRelationship(campaignId: string, id: string) {
  await requireCampaign(campaignId, true);
  await prisma.characterRelationship.deleteMany({ where: { id, campaignId } });
  refresh(campaignId);
}
