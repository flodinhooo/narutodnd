import { calculateMaxChakra, effectiveAc, effectiveInitiative, skills, skillModifier, savingThrowModifier, type Ability } from "./index";
import type { EnemyTemplate, Prisma } from "@prisma/client";
import { enemySkillsSchema, enemySavesSchema } from "../enemy-templates";

type EnemyResources = Pick<EnemyTemplate, "hasChakra" | "level" | "con" | "wis" | "reservoir" | "customReservoirMultiplier" | "maxChakraOverride">;
export function enemyMaxChakra(enemy: EnemyResources) {
  return enemy.hasChakra ? enemy.maxChakraOverride ?? calculateMaxChakra(enemy.level, enemy.con, enemy.wis, enemy.reservoir, enemy.customReservoirMultiplier ?? 1) : null;
}
export function enemyCombatValues(enemy: EnemyTemplate) {
  const proficiencies = enemySkillsSchema.parse(enemy.skills), saves = enemySavesSchema.parse(enemy.savingThrows);
  const score = (ability: Ability) => enemy[ability.toLowerCase() as "str" | "dex" | "con" | "int" | "wis" | "cha"];
  return {
    ac: effectiveAc(enemy.dex, enemy.acOverride), initiative: effectiveInitiative(enemy.dex, enemy.initiativeOverride),
    maxChakra: enemyMaxChakra(enemy),
    skills: proficiencies.map(p => ({ ...p, bonus: skillModifier(score(skills[p.skill]), enemy.level, p.proficiency) })),
    savingThrows: saves.map(ability => ({ ability, bonus: savingThrowModifier(score(ability), enemy.level, "PROFICIENT") })),
  };
}

export type EnemyTemplateWithLinks = Prisma.EnemyTemplateGetPayload<{ include: { natureLinks: { include: { nature: true } }; jutsuLinks: { include: { jutsu: true } } } }>;

// Value object contract for later encounter participants: no current resources,
// conditions or rolls live on a template. The caller must allocate a participant
// ID and persist this detached snapshot when an encounter is implemented.
export function enemyBlueprint(enemy: EnemyTemplateWithLinks) {
  return structuredClone({
    schemaVersion: 1, templateId: enemy.id, templateVersion: enemy.version,
    name: enemy.name, description: enemy.description, category: enemy.category, ninjaRank: enemy.ninjaRank,
    difficulty: enemy.difficulty, level: enemy.level, maxHp: enemy.maxHp, speed: enemy.speed,
    str: enemy.str, dex: enemy.dex, con: enemy.con, int: enemy.int, wis: enemy.wis, cha: enemy.cha,
    ...enemyCombatValues(enemy), hasChakra: enemy.hasChakra, reservoir: enemy.hasChakra ? enemy.reservoir : null,
    controlRank: enemy.hasChakra ? enemy.controlRank : null, regenRank: enemy.hasChakra ? enemy.regenRank : null,
    attacks: enemy.attacks, abilities: enemy.abilities, resistances: enemy.resistances,
    tactics: enemy.tactics, rewards: enemy.rewards, experience: enemy.experience,
    natures: enemy.natureLinks.map(l => ({ id: l.nature.id, key: l.nature.key, name: l.nature.displayName })),
    jutsu: enemy.jutsuLinks.map(l => ({ ...l.jutsu, createdAt: undefined, updatedAt: undefined })),
  });
}
