import { matchLoreJutsu, privateJutsuData } from "./lore-jutsu";
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
  const privateJutsu = choose(bundle.jutsu, selected.jutsu);
  const npcs = choose(bundle.npcs, selected.npcs), organizations = choose(bundle.organizations, selected.organizations), relationships = choose(bundle.relationships, selected.relationships), missions = choose(bundle.missions, selected.missions), combat = choose(bundle.npcs, selected.combat);
  if (!selected.approveDrafts && [...npcs, ...organizations, ...relationships, ...missions, ...privateJutsu].some(n => n.status === "DRAFT")) throw new Error("Homebrew-Entwürfe ausdrücklich auswählen und bestätigen.");
  if (combat.length && !selected.approveCombat) throw new Error("Kampfprofile sind DM-Entwürfe und müssen bestätigt werden.");
  return db.$transaction(async tx => {
    const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true } }); if (!campaign) throw new Error("Kampagne nicht gefunden.");
    const [oldNpcs, oldCharacters, oldOrganizations, oldRelationships, oldMissions, locations, bindings, natures, jutsu] = await Promise.all([
      tx.npc.findMany({ where: { campaignId } }), tx.character.findMany({ where: { campaignId }, include: { natureLinks: true, jutsuLinks: true } }), tx.organization.findMany({ where: { campaignId }, include: { members: true } }), tx.characterRelationship.findMany({ where: { campaignId } }), tx.mission.findMany({ where: { campaignId } }), tx.location.findMany({ where: { campaignId } }), tx.atlasLocationSeed.findMany({ where: { campaignId } }), tx.chakraNature.findMany(), tx.jutsu.findMany({ where: { OR: [{ campaignId: null }, { campaignId }] }, include: { prerequisites: true } }),
    ]);
    const canonicalId = (kind: string, key: string) => loreEntityId(campaignId, bundle.key, kind, key);
    const resolvedIds = new Map<string, string>(), identityConflicts: string[] = [];
    for (const [kind, entries, existing] of [["npc", bundle.npcs, oldNpcs], ["organization", bundle.organizations, oldOrganizations]] as const) {
      for (const entry of entries) {
        const ids = [canonicalId(kind, entry.key), ...entry.identities.map(ref => loreEntityId(campaignId, ref.bundleKey, kind, ref.key))];
        if (kind === "npc" && entry.legacySeedKey) ids.push("genin_" + createHash("sha256").update(JSON.stringify([campaignId, entry.legacySeedKey])).digest("hex"));
        const matches = existing.filter(item => ids.includes(item.id));
        if (matches.length > 1) identityConflicts.push(`${entry.name}: mehrere stabile Identitäten vorhanden; manuell zusammenführen.`);
        resolvedIds.set(`${kind}:${entry.key}`, matches[0]?.id ?? ids[1] ?? ids[0]);
      }
      const targets = entries.map(e => resolvedIds.get(`${kind}:${e.key}`));
      if (new Set(targets).size !== targets.length) identityConflicts.push("Mehrere Einträge verweisen auf dieselbe Identität.");
    }
    const id = (kind: string, key: string) => resolvedIds.get(`${kind}:${key}`) ?? canonicalId(kind, key);
    const result = { campaign: campaign.name, createNpcs: 0, createOrganizations: 0, createMemberships: 0, createRelationships: 0, createCharacters: 0, createMissions: 0, createJutsu: 0, createJutsuAssignments: 0, preserved: 0, conflicts: identityConflicts, entries: [] as { kind: string; key: string; name: string; action: string; existingDescription?: string; incomingDescription?: string }[], fingerprint: "" };
    const npcExists = (key: string) => oldNpcs.find(n => n.id === id("npc", key));
    const relationshipExists = (r: typeof relationships[number]) => oldRelationships.some(v => v.id === id("relationship", r.key) || (v.sourceNpcId === id("npc", r.sourceKey) && v.targetNpcId === id("npc", r.targetKey) && v.type === r.type));
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
    const plannedJutsu = new Map<string, { id: string; entry: typeof privateJutsu[number]; existing: boolean }>();
    for (const entry of privateJutsu) {
      const matches = jutsu.filter(j => j.id === id("jutsu", entry.key) || matchLoreJutsu(entry, [j]).length > 0);
      if (matches.length > 1) result.conflicts.push(`${entry.name}: mehrdeutige Jutsu-Aliase.`);
      const old = matches[0];
      if (old && old.rank !== entry.rank) result.conflicts.push(`${entry.name}: Rang widerspricht bestehendem Jutsu.`);
      for (const nature of entry.natureKeys) if (!natures.some(n => n.key === nature)) result.conflicts.push(`${entry.name}: Chakra-Natur ${nature} fehlt.`);
      plannedJutsu.set(entry.slug, { id: old?.id ?? id("jutsu", entry.key), entry, existing: Boolean(old) });
      result.entries.push({ kind: "Jutsu", key: entry.key, name: entry.name, action: old ? "Erhalten" : "Neu (DM-privat)", incomingDescription: `${entry.description}\n${entry.assumptions}` });
      if (old) result.preserved++; else result.createJutsu++;
    }
    if (new Set([...plannedJutsu.values()].map(p => p.id)).size !== plannedJutsu.size) result.conflicts.push("Mehrere Jutsu-Einträge verweisen auf dieselbe Technik.");
    const resolveJutsu = (slug: string) => {
      const plan = plannedJutsu.get(slug);
      const matches = jutsu.filter(j => j.slug === slug);
      return plan ? { id: plan.id, plan, old: jutsu.find(j => j.id === plan.id) } : matches.length === 1 ? { id: matches[0].id, old: matches[0], plan: undefined } : undefined;
    };
    for (const plan of plannedJutsu.values()) for (const slug of plan.entry.prerequisiteSlugs) if (!resolveJutsu(slug)) result.conflicts.push(`${plan.entry.name}: Voraussetzung ${slug} fehlt oder ist mehrdeutig.`);
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
      if (o.type === "TEAM" && !o.reservedPlayerTeam && old) {
        const expected = new Set(o.members.map(m => id("npc", m.npcKey)));
        if (old.members.some(m => !m.npcId || !expected.has(m.npcId) || m.isLeader !== o.members.find(e => id("npc", e.npcKey) === m.npcId)?.isLeader)) result.conflicts.push(`${o.name}: bestehende Teamkonstellation weicht ab; manuell abgleichen.`);
      }
      for (const m of o.members) { if (!npcReady(m.npcKey)) result.conflicts.push(`${o.name}: Mitglied ${m.npcKey} zuerst auswählen.`); else if (old?.members.some(v => v.npcId === id("npc", m.npcKey))) result.preserved++; else result.createMemberships++; }
    }
    for (const r of relationships) {
      if (!npcReady(r.sourceKey) || !npcReady(r.targetKey)) result.conflicts.push(`Beziehung ${r.key}: beide NPCs zuerst auswählen.`);
      if (relationshipExists(r)) result.preserved++; else result.createRelationships++;
    }
    for (const n of combat) {
      if (!n.combat || !npcReady(n.key)) { result.conflicts.push(`${n.name}: Kampfprofil oder NPC-Auswahl fehlt.`); continue; }
      const existingCharacter = oldCharacters.find(c => c.id === npcExists(n.key)?.characterId);
      if (existingCharacter) result.preserved++;
      const activeNatures = existingCharacter ? existingCharacter.natureLinks.map(l => natures.find(n => n.id === l.chakraNatureId)?.key) : n.combat.natureKeys;
      for (const key of n.combat.natureKeys) if (!natures.some(v => v.key === key)) result.conflicts.push(`${n.name}: Chakra-Natur ${key} fehlt.`);
      if (selected.includeJutsu) for (const slug of n.combat.jutsuSlugs) {
        const resolved = resolveJutsu(slug);
        if (!resolved) { result.conflicts.push(`${n.name}: Jutsu ${slug} fehlt oder ist mehrdeutig.`); continue; }
        const entry = resolved.plan?.entry ?? bundle.jutsu.find(e => e.slug === slug);
        let required: unknown;
        try { const existing: unknown = resolved.old ? JSON.parse(resolved.old.requiredNatureKeys || "[]") : []; required = Array.isArray(existing) ? [...new Set([...existing, ...(entry?.natureKeys ?? [])])] : null; } catch { required = null; }
        if (!Array.isArray(required) || required.some(key => !activeNatures.includes(key))) result.conflicts.push(`${n.name}: Naturvoraussetzung für ${slug} fehlt.`);
        if (entry) {
          if (!entry.allowedNpcKeys.includes(n.key)) result.conflicts.push(`${n.name}: individuelle Freischaltung für ${slug} fehlt.`);
          if (entry.requiredClan && (npcExists(n.key)?.clan ?? n.clan) !== entry.requiredClan) result.conflicts.push(`${n.name}: Clan-Voraussetzung für ${slug} fehlt.`);
          for (const prerequisite of entry.prerequisiteSlugs) if (!n.combat.jutsuSlugs.includes(prerequisite) && !existingCharacter?.jutsuLinks.some(l => l.jutsuId === resolveJutsu(prerequisite)?.id)) result.conflicts.push(`${n.name}: Voraussetzung ${prerequisite} nicht gelernt.`);
        } else if (resolved.old?.category?.includes("HIDEN") && (!n.clan || !resolved.old.traditionProvenance?.toLowerCase().includes(n.clan.toLowerCase()))) result.conflicts.push(`${n.name}: Clan-Voraussetzung für ${slug} nicht belegt.`);
        for (const prerequisite of resolved.old?.prerequisites ?? []) if (!n.combat.jutsuSlugs.some(slug => resolveJutsu(slug)?.id === prerequisite.prerequisiteJutsuId) && !existingCharacter?.jutsuLinks.some(l => l.jutsuId === prerequisite.prerequisiteJutsuId)) result.conflicts.push(`${n.name}: bestehende Jutsu-Voraussetzung nicht gelernt.`);
        if (!existingCharacter?.jutsuLinks.some(l => l.jutsuId === resolved.id)) result.createJutsuAssignments++;
      }
      if (!existingCharacter) result.createCharacters++;
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
    for (const plan of plannedJutsu.values()) if (!plan.existing) {
      await tx.jutsu.create({ data: { ...privateJutsuData(plan.entry, campaignId), id: plan.id } });
      for (const key of plan.entry.natureKeys) await tx.jutsuChakraNature.create({ data: { jutsuId: plan.id, chakraNatureId: natures.find(n => n.key === key)!.id } });
    }
    for (const plan of plannedJutsu.values()) if (!plan.existing) for (const slug of plan.entry.prerequisiteSlugs) await tx.jutsuPrerequisite.create({ data: { jutsuId: plan.id, prerequisiteJutsuId: resolveJutsu(slug)!.id } });
    for (const n of npcs) if (!npcExists(n.key)) await tx.npc.create({ data: { id: id("npc", n.key), campaignId, name: n.name, category: n.category, attitude: "UNKNOWN", age: n.age, gender: n.gender, ninjaRank: n.ninjaRank, occupation: n.occupation, village: n.village, clan: n.clan, description: (n.status === "DRAFT" ? "[DM-Entwurf] " : "") + n.description, background: n.background, personality: n.personality, locationId: locationId(n.locationKey), dmSecrets: loreProvenance(bundle, { ...n, notes: `${n.notes}\nMotivation: ${n.motivation}\nInteraktion: ${n.interaction}` }), playerVisible: false } });
    for (const o of organizations) {
      const organizationId = id("organization", o.key);
      if (!oldOrganizations.some(v => v.id === organizationId)) await tx.organization.create({ data: { id: organizationId, campaignId, name: o.name, type: o.type, attitude: "UNKNOWN", locationId: locationId(o.locationKey), description: o.description || (o.status === "DRAFT" ? "[DM-Entwurf] Vorgeschlagene Organisation." : ""), notes: o.reservedPlayerTeam ? "PLAYER TEAM – Reserved / Awaiting Character Creation" : "", dmSecrets: loreProvenance(bundle, o), playerVisible: false } });
      const existingOrg = oldOrganizations.find(v => v.id === organizationId);
      if (existingOrg && !existingOrg.description && o.description) await tx.organization.update({ where: { id: organizationId }, data: { description: o.description } });
      if (existingOrg && !existingOrg.notes && o.reservedPlayerTeam) await tx.organization.update({ where: { id: organizationId }, data: { notes: "PLAYER TEAM – Reserved / Awaiting Character Creation" } });
      for (const m of o.members) await tx.organizationMember.upsert({ where: { organizationId_npcId: { organizationId, npcId: id("npc", m.npcKey) } }, create: { organizationId, npcId: id("npc", m.npcKey), role: m.role, isLeader: m.isLeader }, update: {} });
    }
    for (const r of relationships) if (!relationshipExists(r)) await tx.characterRelationship.create({ data: { id: id("relationship", r.key), campaignId, sourceNpcId: id("npc", r.sourceKey), targetNpcId: id("npc", r.targetKey), type: r.type, description: (r.status === "DRAFT" ? "[DM-Entwurf] " : "") + r.description, dmSecrets: loreProvenance(bundle, r), playerVisible: false } });
    for (const n of combat) {
      const existingCharacterId = npcExists(n.key)?.characterId;
      if (existingCharacterId) {
        if (selected.includeJutsu) for (const slug of n.combat!.jutsuSlugs) {
          const jutsuId = resolveJutsu(slug)!.id;
          if (!oldCharacters.find(c => c.id === existingCharacterId)?.jutsuLinks.some(l => l.jutsuId === jutsuId)) await tx.characterJutsu.create({ data: { characterId: existingCharacterId, jutsuId, source: "DM_LORE_DRAFT" } });
        }
        continue;
      }
      const c = n.combat!;
      const { hpLevels, derivedHp, maxHp, maxChakra, attacks } = loreCombatValues(c);
      const character = await tx.character.create({ data: { id: id("character", n.key), campaignId, name: n.name, level: c.level, str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha, speed: c.speed, hitDie: c.hitDie, hitDieAbilityBonus: c.hitDie === "d8" ? c.hitDieAbilityBonus ?? null : null, maxHp, currentHp: maxHp, hpOverrideOffset: c.hpOverride ? maxHp - derivedHp : null, acOverride: c.acOverride, reservoir: c.reservoir, customReservoirMultiplier: c.customReservoirMultiplier, controlRank: c.controlRank, regenRank: c.regenRank, currentChakra: maxChakra, description: `[DM-Entwurf] ${n.description}`, hpLevels: { create: hpLevels }, skills: { create: c.skills }, savingThrows: { create: c.savingThrows.map(ability => ({ ability })) }, combatProfile: { attacks, abilities: [{ name: "DM-Entwurf", description: c.features || "Keine weiteren Faehigkeiten." }] }, dmData: { create: { notes: "Kampfprofil als DM-Entwurf importiert; Sonderwerte sind separat gespeichert.", secretInformation: c.assumptions } } } });
      await tx.npc.update({ where: { id: id("npc", n.key) }, data: { characterId: character.id } });
      for (const [index, key] of c.natureKeys.entries()) await tx.characterChakraNature.create({ data: { characterId: character.id, chakraNatureId: natures.find(v => v.key === key)!.id, isPrimary: index === 0, source: "DM_LORE_DRAFT" } });
      if (selected.includeJutsu) for (const slug of c.jutsuSlugs) await tx.characterJutsu.create({ data: { characterId: character.id, jutsuId: resolveJutsu(slug)!.id, source: "DM_LORE_DRAFT" } });
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
