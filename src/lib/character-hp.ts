import {calculateMaxHp, effectiveMaxHp, preserveHpDamage, type HpLevelRoll, type HpLegacyBaseline} from "./rules";

type CharacterHp = HpLegacyBaseline & {
 level: number; con: number; hitDie: string; hpLevels: readonly HpLevelRoll[];
 maxHp: number; currentHp: number; hpOverrideOffset?: number | null;
};
export const getDerivedCharacterHp = (character: Pick<CharacterHp, "level" | "con" | "hitDie" | "hpLevels" | "hpLegacyLevel" | "hpLegacyBase">) =>
 calculateMaxHp(character.level, character.con, character.hitDie, character.hpLevels, character);

export function getCharacterHpChange(old: CharacterHp, next: Pick<CharacterHp, "level" | "con" | "hpLevels">, requestedMaxHp?: FormDataEntryValue | null) {
 const derived = getDerivedCharacterHp({...old, ...next});
 let hpOverrideOffset = old.hpOverrideOffset ?? null;
 if (requestedMaxHp === "") hpOverrideOffset = null;
 else if (requestedMaxHp != null) {
  const requested = Number(requestedMaxHp);
  if (!Number.isInteger(requested) || requested < 1) throw new Error("Invalid maximum HP");
  // Resubmitting the unchanged displayed maximum must not cancel a CON/level increase.
  if (requested !== old.maxHp) hpOverrideOffset = requested - derived;
 }
 const maxHp = effectiveMaxHp(derived, hpOverrideOffset);
 return {maxHp, currentHp: preserveHpDamage(old.currentHp, old.maxHp, maxHp), hpOverrideOffset};
}
