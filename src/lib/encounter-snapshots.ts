import type { EncounterParticipantPlan, Prisma } from "@prisma/client";
import { enemyBlueprint } from "./rules/enemies";
import { enemyInclude } from "./enemy-library";
import { abilities, calculateMaxChakra, clamp, effectiveAc, effectiveInitiative, preserveChakra, preserveHpDamage, skills, skillModifier, savingThrowModifier } from "./rules";
import { combatSnapshotSchema, EncounterError, planOverridesSchema, validateEncounter, type CombatSnapshot } from "./encounters";

const characterInclude = { natureLinks: { include: { nature: true } }, jutsuLinks: { include: { jutsu: true } }, skills: true, savingThrows: true } as const;
type CombatCharacter = Prisma.CharacterGetPayload<{ include: typeof characterInclude }>;
function characterSnapshot(c: CombatCharacter): CombatSnapshot {
  if (c.jutsuLinks.some(l => l.jutsu.campaignId !== null && l.jutsu.campaignId !== c.campaignId)) throw new EncounterError("Charakter enthält eine kampagnenfremde Jutsu-Verknüpfung.");
  const score = (key: string) => c[key.toLowerCase() as "str" | "dex" | "con" | "int" | "wis" | "cha"];
  return validateEncounter(combatSnapshotSchema, {
    schemaVersion: 1, name: c.name, description: c.description, level: c.level, speed: c.speed,
    maxHp: c.maxHp, maxChakra: calculateMaxChakra(c.level, c.con, c.wis, c.reservoir, c.customReservoirMultiplier ?? 1),
    ac: effectiveAc(c.dex, c.acOverride), initiative: effectiveInitiative(c.dex, c.initiativeOverride),
    attributes: { str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha },
    attacks: [], abilities: [],
    skills: Object.entries(skills).map(([skill, ability]) => ({ skill, bonus: skillModifier(score(ability), c.level, c.skills.find(s => s.skill === skill)?.proficiency ?? "NONE") })),
    savingThrows: abilities.map(ability => ({ ability, bonus: savingThrowModifier(score(ability), c.level, c.savingThrows.some(s => s.ability === ability) ? "PROFICIENT" : "NONE") })),
    natures: c.natureLinks.map(l => ({ id: l.nature.id, key: l.nature.key, name: l.nature.displayName })),
    jutsu: c.jutsuLinks.map(l => l.jutsu), reservoir: c.reservoir, controlRank: c.controlRank, regenRank: c.regenRank, resistances: "", tactics: "",
  });
}

export async function snapshotPlan(tx: Prisma.TransactionClient, campaignId: string, plan: EncounterParticipantPlan) {
  let snapshot: CombatSnapshot, sourceKind: "ENEMY" | "CHARACTER" | "NPC", sourceId: string;
  let character: CombatCharacter | null = null;
  if (plan.enemyTemplateId) {
    sourceKind = "ENEMY"; sourceId = plan.enemyTemplateId;
    const e = await tx.enemyTemplate.findFirst({ where: { id: sourceId, archived: false, OR: [{ campaignId: null }, { campaignId }] }, include: enemyInclude });
    if (!e) throw new EncounterError("Gegnervorlage fehlt, ist archiviert oder gehört zu einer anderen Kampagne.");
    const blueprint = enemyBlueprint(e);
    snapshot = validateEncounter(combatSnapshotSchema, { ...blueprint, attributes: { str: e.str, dex: e.dex, con: e.con, int: e.int, wis: e.wis, cha: e.cha } });
  } else if (plan.npcId) {
    sourceKind = "NPC"; sourceId = plan.npcId;
    const n = await tx.npc.findFirst({ where: { id: sourceId, campaignId, archived: false }, include: { character: { include: characterInclude } } });
    if (!n) throw new EncounterError("NPC fehlt, ist archiviert oder gehört zu einer anderen Kampagne.");
    character = n.character;
    if (character && character.campaignId !== campaignId) throw new EncounterError("Ungültige Charakterverknüpfung.");
    snapshot = character ? { ...characterSnapshot(character), name: n.name } : {
      schemaVersion: 1, name: n.name, description: n.description, level: 1, speed: 30, maxHp: null, maxChakra: null, ac: null, initiative: 0, attributes: null,
      attacks: [], abilities: [], skills: [], savingThrows: [], jutsu: [], natures: [], reservoir: null, controlRank: null, regenRank: null, resistances: "", tactics: "",
    };
  } else {
    sourceKind = "CHARACTER"; sourceId = plan.characterId ?? "";
    character = await tx.character.findFirst({ where: { id: sourceId, campaignId, npc: null }, include: characterInclude });
    if (!character) throw new EncounterError("Spielercharakter fehlt oder ist bereits eine NPC-Identität.");
    snapshot = characterSnapshot(character);
  }
  const overrides = validateEncounter(planOverridesSchema, plan.overrides);
  const oldMaxHp = snapshot.maxHp, oldMaxChakra = snapshot.maxChakra;
  if (overrides.maxChakra !== undefined && oldMaxChakra === null) throw new EncounterError("Chakra-Override ist für Teilnehmer ohne Chakra nicht erlaubt.");
  snapshot = { ...snapshot, name: overrides.name ?? snapshot.name, maxHp: overrides.maxHp ?? snapshot.maxHp, ac: overrides.ac ?? snapshot.ac, initiative: overrides.initiativeBonus ?? snapshot.initiative, maxChakra: overrides.maxChakra ?? snapshot.maxChakra };
  if (snapshot.maxHp !== null && snapshot.ac === null) snapshot.ac = 10;
  snapshot = validateEncounter(combatSnapshotSchema, snapshot);
  const currentHp = snapshot.maxHp === null ? null : character && oldMaxHp !== null ? preserveHpDamage(character.currentHp, oldMaxHp, snapshot.maxHp) : snapshot.maxHp;
  const currentChakra = snapshot.maxChakra === null ? null : character && oldMaxChakra !== null ? clamp(preserveChakra(character.currentChakra, oldMaxChakra, snapshot.maxChakra), 0, snapshot.maxChakra) : snapshot.maxChakra;
  return {
    sourcePlanId: plan.id, sourceKind, sourceId, side: plan.side, name: snapshot.name, snapshot,
    maxHp: snapshot.maxHp, currentHp, maxChakra: snapshot.maxChakra, currentChakra, ac: snapshot.ac,
    initiativeBonus: snapshot.initiative, notes: plan.notes, unconscious: currentHp === 0, severelyWounded: character?.severelyWounded ?? false,
  };
}
