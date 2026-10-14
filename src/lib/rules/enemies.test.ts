import { expect, it } from "vitest";
import { enemyCombatValues, enemyMaxChakra } from "./enemies";
import { calculateMaxChakra } from "./index";
import { enemyTemplateSeeds } from "../../../seeding/enemy-templates";
import type { EnemyTemplate } from "@prisma/client";

const template = (extra: Partial<EnemyTemplate> = {}): EnemyTemplate => ({
  ...enemyTemplateSeeds[6].data, id: "template", campaignId: "campaign", seedKey: null, sourceTemplateId: null,
  archived: false, version: 1, createdAt: new Date(), updatedAt: new Date(), ...extra,
});
it("uses no chakra resource for a nonchakra combatant even if legacy reservoir fields are present", () => {
  expect(enemyMaxChakra(template({ hasChakra: false, reservoir: "MONSTER" }))).toBeNull();
});
it("uses the character chakra formula and respects an explicit override", () => {
  const e = template({ hasChakra: true, level: 7, con: 16, wis: 14, reservoir: "HIGH" });
  expect(enemyMaxChakra(e)).toBe(calculateMaxChakra(7, 16, 14, "HIGH"));
  expect(enemyMaxChakra({ ...e, maxChakraOverride: 81 })).toBe(81);
  expect(enemyMaxChakra({ ...e, reservoir: "SPECIAL", customReservoirMultiplier: 2 })).toBe(calculateMaxChakra(7, 16, 14, "SPECIAL", 2));
});
it("derives AC and initiative while preserving zero or negative explicit overrides", () => {
  expect(enemyCombatValues(template({ dex: 16, acOverride: null, initiativeOverride: null }))).toMatchObject({ ac: 15, initiative: 3 });
  expect(enemyCombatValues(template({ dex: 16, acOverride: 0, initiativeOverride: -2 }))).toMatchObject({ ac: 0, initiative: -2 });
});
it("reuses proficiency, saving throw and expertise rules", () => {
  const e = template({ level: 5, dex: 16, skills: [{ skill: "Stealth", proficiency: "EXPERTISE" }], savingThrows: ["DEX"] });
  expect(enemyCombatValues(e)).toMatchObject({ skills: [{ skill: "Stealth", proficiency: "EXPERTISE", bonus: 9 }], savingThrows: [{ ability: "DEX", bonus: 6 }] });
});
