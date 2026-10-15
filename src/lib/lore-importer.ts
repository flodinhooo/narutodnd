import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { loreBundleSchema, loreEntityId, loreProvenance } from "./lore-bundle";
import { loreSelectionSchema, type LoreSelection } from "./lore-selection";
import { loreCombatValues } from "./rules/lore-profiles";
import { shioLocations, SHIO_ATLAS_KEY } from "../../seeding/world-atlas";
import { importMissionBlueprint } from "./mission-blueprint-import";

export async function importLoreBundle(db: PrismaClient, campaignId: string, input: unknown, apply = false) {
  const b = loreBundleSchema.parse(input);
  return importSelectedLore(db, campaignId, b, { npcs: b.npcs.map(n => n.key), organizations: b.organizations.map(n => n.key), relationships: b.relationships.map(n => n.key), combat: [], missions: [], approveDrafts: false, approveCombat: false, includeJutsu: false }, apply);
}
export async function importSelectedLore(db: PrismaClient, campaignId: string, input: unknown, selection: LoreSelection, apply = false, expectedFingerprint?: string) {
  const bundle = loreBundleSchema.parse(input), selected = loreSelectionSchema.parse(selection);
  const choose = <T extends { key: string }>(items: T[], keys: string[]) => { if (keys.some(k => !items.some(i => i.key === k))) throw new Error("Unbekannte Paketauswahl."); return items.filter(i => keys.includes(i.key)); };
  const npcs = choose(bundle.npcs, selected.npcs), organizations = choose(bundle.organizations, selected.organizations), relationships = choose(bundle.relationships, selected.relationships), missions = choose(bundle.missions, selected.missions), combat = choose(bundle.npcs, selected.combat);
  if (!selected.approveDrafts && [...npcs, ...organizations, ...relationships, ...missions].some(n => n.status === "DRAFT")) throw new Error("Homebrew-Entwürfe ausdrücklich auswählen und bestätigen.");
  if (combat.length && !selected.approveCombat) throw new Error("Kampfprofile sind DM-Entwürfe und müssen bestätigt werden.");
  return db.$transaction(async tx => {
    const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true } }); if (!campaign) throw new Error("Kampagne nicht gefunden.");
    const [oldNpcs, oldCharacters, oldOrganizations, oldRelationships, oldMissions, locations, bindings, natures, jutsu] = await Promise.all([
      tx.npc.findMany({ where: { campaignId } }), tx.character.findMany({ where: { campaignId } }), tx.organization.findMany({ where: { campaignId }, include: { members: true } }), tx.characterRelationship.findMany({ where: { campaignId } }), tx.mission.findMany({ where: { campaignId } }), tx.location.findMany({ where: { campaignId } }), tx.atlasLocationSeed.findMany({ where: { campaignId } }), tx.chakraNature.findMany(), tx.jutsu.findMany({ where: { campaignId: null } }),
    ]);
    const id = (kind: string, key: string) => loreEntityId(campaignId, bundle.key, kind, key);
    const result = { campaign: campaign.name, createNpcs: 0, createOrganizations: 0, createMemberships: 0, createRelationships: 0, createCharacters: 0, createMissions: 0, preserved: 0, conflicts: [] as string[], entries: [] as { kind: string; key: string; name: string; action: string; existingDescription?: string; incomingDescription?: string }[], fingerprint: "" };
    const npcExists = (key: string) => oldNpcs.find(n => n.id === id("npc", key));
    const npcReady = (key: string) => Boolean(npcExists(key) || npcs.some(n => n.key === key));
    const locationId = (key?: string) => {
      if (!key) return undefined;
      const bound = bindings.find(b => b.seedKey === `${SHIO_ATLAS_KEY}:location:${key}`)?.locationId;
      if (bound && locations.some(l => l.id === bound)) return bound;
      const name = shioLocations.find(l => l.key === key)?.name;
      const matches = locations.filter(l => l.name === name);
      if (matches.length === 1) return matches[0].id;
      result.conflicts.push(`Ort ${key}: fehlt oder ist mehrdeutig. Zuerst Atlas importieren bzw. Ort abgleichen.`); return undefined;
    };
    for (const n of npcs) {
      const old = npcExists(n.key); locationId(n.locationKey);
      result.entries.push({ kind: "NPC", key: n.key, name: n.name, action: old ? "Erhalten" : "Neu", existingDescription: old?.description, incomingDescription: n.description });
      if (old) result.preserved++;
      else if (oldNpcs.some(v => v.name.toLocaleLowerCase() === n.name.toLocaleLowerCase()) || oldCharacters.some(v => v.name.toLocaleLowerCase() === n.name.toLocaleLowerCase())) result.conflicts.push(`NPC ${n.name}: vorhandenen Namen manuell abgleichen.`);
      else result.createNpcs++;
    }
    for (const o of organizations) {
      const old = oldOrganizations.find(v => v.id === id("organization", o.key)); locationId(o.locationKey);
      result.entries.push({ kind: "Organisation", key: o.key, name: o.name, action: old ? "Erhalten" : "Neu" });
      if (old) result.preserved++; else if (oldOrganizations.some(v => v.name.toLocaleLowerCase() === o.name.toLocaleLowerCase())) result.conflicts.push(`Organisation ${o.name}: vorhandenen Namen manuell abgleichen.`); else result.createOrganizations++;
      for (const m of o.members) { if (!npcReady(m.npcKey)) result.conflicts.push(`${o.name}: Mitglied ${m.npcKey} zuerst auswählen.`); else if (old?.members.some(v => v.npcId === id("npc", m.npcKey))) result.preserved++; else result.createMemberships++; }
    }
    for (const r of relationships) {
      if (!npcReady(r.sourceKey) || !npcReady(r.targetKey)) result.conflicts.push(`Beziehung ${r.key}: beide NPCs zuerst auswählen.`);
      if (oldRelationships.some(v => v.id === id("relationship", r.key))) result.preserved++; else result.createRelationships++;
    }
    for (const n of combat) {
      if (!n.combat || !npcReady(n.key)) { result.conflicts.push(`${n.name}: Kampfprofil oder NPC-Auswahl fehlt.`); continue; }
      if (npcExists(n.key)?.characterId) { result.preserved++; continue; }
      for (const key of n.combat.natureKeys) if (!natures.some(v => v.key === key)) result.conflicts.push(`${n.name}: Chakra-Natur ${key} fehlt.`);
      if (selected.includeJutsu) for (const slug of n.combat.jutsuSlugs) {
        const matches = jutsu.filter(j => j.slug === slug);
        if (matches.length !== 1) result.conflicts.push(`${n.name}: Jutsu ${slug} fehlt oder ist mehrdeutig.`);
        else { let required: unknown; try { required = JSON.parse(matches[0].requiredNatureKeys || "[]"); } catch { required = null; }
          if (!Array.isArray(required) || required.some(key => !n.combat!.natureKeys.includes(key))) result.conflicts.push(`${n.name}: Naturvoraussetzung für ${slug} fehlt.`);
          if (matches[0].category?.includes("HIDEN") && !n.clan) result.conflicts.push(`${n.name}: Clan-Voraussetzung für ${slug} nicht belegt.`);
        }
      }
      result.createCharacters++;
    }
    for (const m of missions) {
      locationId(m.locationKey);
      for (const n of m.blueprint.npcs) if (!npcReady(n.key)) result.conflicts.push(`${m.blueprint.title}: NPC ${n.key} zuerst auswählen.`);
      for (const e of m.blueprint.encounters) for (const g of e.enemies) if (!await tx.enemyTemplate.findFirst({ where: { seedKey: g.seedKey, campaignId: null, archived: false } })) result.conflicts.push(`${m.blueprint.title}: Bestiary ${g.seedKey} fehlt.`);
      if (oldMissions.some(v => v.id === id("mission", m.key))) result.preserved++; else result.createMissions++;
    }
    const snapshot = { bundle, selected, npcs: oldNpcs, characters: oldCharacters, organizations: oldOrganizations, relationships: oldRelationships, missions: oldMissions, locations, bindings, natures, jutsu };
    result.fingerprint = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    if (!apply) return result;
    if (expectedFingerprint && result.fingerprint !== expectedFingerprint) throw new Error("Vorschau ist veraltet. Neu prüfen; Änderungen wurden nicht angewendet.");
    if (result.conflicts.length) throw new Error("Importkonflikte: zuerst Vorschau prüfen.");
    for (const n of npcs) if (!npcExists(n.key)) await tx.npc.create({ data: { id: id("npc", n.key), campaignId, name: n.name, category: n.category, attitude: "UNKNOWN", age: n.age, gender: n.gender, ninjaRank: n.ninjaRank, occupation: n.occupation, village: n.village, clan: n.clan, description: (n.status === "DRAFT" ? "[DM-Entwurf] " : "") + n.description, background: n.background, personality: n.personality, locationId: locationId(n.locationKey), dmSecrets: loreProvenance(bundle, { ...n, notes: `${n.notes}\nMotivation: ${n.motivation}\nInteraktion: ${n.interaction}` }), playerVisible: false } });
    for (const o of organizations) {
      const organizationId = id("organization", o.key);
      if (!oldOrganizations.some(v => v.id === organizationId)) await tx.organization.create({ data: { id: organizationId, campaignId, name: o.name, type: o.type, attitude: "UNKNOWN", locationId: locationId(o.locationKey), description: o.status === "DRAFT" ? "[DM-Entwurf] Vorgeschlagene Organisation." : "", dmSecrets: loreProvenance(bundle, o), playerVisible: false } });
      for (const m of o.members) await tx.organizationMember.upsert({ where: { organizationId_npcId: { organizationId, npcId: id("npc", m.npcKey) } }, create: { organizationId, npcId: id("npc", m.npcKey), role: m.role, isLeader: m.isLeader }, update: {} });
    }
    for (const r of relationships) if (!oldRelationships.some(v => v.id === id("relationship", r.key))) await tx.characterRelationship.create({ data: { id: id("relationship", r.key), campaignId, sourceNpcId: id("npc", r.sourceKey), targetNpcId: id("npc", r.targetKey), type: r.type, description: (r.status === "DRAFT" ? "[DM-Entwurf] " : "") + r.description, dmSecrets: loreProvenance(bundle, r), playerVisible: false } });
    for (const n of combat) {
      if (npcExists(n.key)?.characterId) continue; const c = n.combat!;
      const { hpLevels, derivedHp, maxHp, maxChakra, attacks } = loreCombatValues(c);
      const character = await tx.character.create({ data: { id: id("character", n.key), campaignId, name: n.name, level: c.level, str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha, speed: c.speed, hitDie: c.hitDie, hitDieAbilityBonus: c.hitDie === "d8" ? "WIS" : null, maxHp, currentHp: maxHp, hpOverrideOffset: c.hpOverride ? maxHp - derivedHp : null, acOverride: c.acOverride, reservoir: c.reservoir, customReservoirMultiplier: c.customReservoirMultiplier, controlRank: c.controlRank, regenRank: c.regenRank, currentChakra: maxChakra, description: `[DM-Entwurf] ${n.description}`, hpLevels: { create: hpLevels }, skills: { create: c.skills }, savingThrows: { create: c.savingThrows.map(ability => ({ ability })) }, combatProfile: { attacks, abilities: [{ name: "DM-Entwurf", description: c.features || "Keine weiteren Faehigkeiten." }] }, dmData: { create: { notes: "Kampfprofil als DM-Entwurf importiert; Sonderwerte sind separat gespeichert.", secretInformation: c.assumptions } } } });
      await tx.npc.update({ where: { id: id("npc", n.key) }, data: { characterId: character.id } });
      for (const [index, key] of c.natureKeys.entries()) await tx.characterChakraNature.create({ data: { characterId: character.id, chakraNatureId: natures.find(v => v.key === key)!.id, isPrimary: index === 0, source: "DM_LORE_DRAFT" } });
      if (selected.includeJutsu) for (const slug of c.jutsuSlugs) await tx.characterJutsu.create({ data: { characterId: character.id, jutsuId: jutsu.find(v => v.slug === slug)!.id, source: "DM_LORE_DRAFT" } });
    }
    for (const m of missions) if (!oldMissions.some(v => v.id === id("mission", m.key))) {
      await importMissionBlueprint(tx, campaignId, null, m.blueprint, { missionId: id("mission", m.key), locationId: locationId(m.locationKey), npcIds: Object.fromEntries(m.blueprint.npcs.map(n => [n.key, id("npc", n.key)])) });
    }
    for (const m of missions) for (const next of m.followUpKeys) {
      const sourceId = id("mission", m.key), targetId = id("mission", next), consequenceId = id("consequence", `${m.key}:${next}`);
      if (await tx.mission.findFirst({ where: { id: targetId, campaignId } }) && !await tx.missionConsequence.findUnique({ where: { id: consequenceId } })) await tx.missionConsequence.create({ data: { id: consequenceId, missionId: sourceId, title: "Folgeauftrag anbieten", kind: "UNLOCK_MISSION", targetMissionId: targetId, description: "[DM-Entwurf] Nur nach ausdrücklicher Bestätigung durch die Spielleitung." } });
    }
    return result;
  }, { timeout: 60000 });
}
