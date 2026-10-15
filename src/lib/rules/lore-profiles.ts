import type { z } from "zod";
import type { loreCombatSchema } from "../lore-bundle";
import { calculateMaxHp, calculateMaxChakra, getHitDieMaximum, effectiveAc, calculateInitiativeBonus, calculateShortRestChakraRecovery, getAbilityModifier, getProficiencyBonus } from "./index";
export function loreCombatValues(c: z.infer<typeof loreCombatSchema>) {
  const roll = Math.ceil((getHitDieMaximum(c.hitDie) + 1) / 2);
  const hpLevels = Array.from({ length: c.level - 1 }, (_, i) => ({ level: i + 2, hitDie: c.hitDie, rawRoll: roll, effectiveRoll: roll }));
  const derivedHp = calculateMaxHp(c.level, c.con, c.hitDie, hpLevels), maxHp = c.hpOverride ?? derivedHp, maxChakra = calculateMaxChakra(c.level, c.con, c.wis, c.reservoir, c.customReservoirMultiplier);
  const modifier = getAbilityModifier(c.dex);
  const attacks = [{ name: "Kunai (DM-Entwurf)", bonus: modifier + getProficiencyBonus(c.level), damageDice: `1d4${modifier >= 0 ? "+" : ""}${modifier}`, damageType: "Piercing", range: "5 ft / geworfen 20–60 ft", description: "Vorgeschlagene Shinobi-Standardwaffe; Ausrüstung und Einsatz durch den DM bestätigen." }];
  return { hpLevels, derivedHp, maxHp, maxChakra, attacks, ac: effectiveAc(c.dex, c.acOverride), initiative: calculateInitiativeBonus(c.dex), regeneration: calculateShortRestChakraRecovery(maxChakra, c.regenRank) };
}
