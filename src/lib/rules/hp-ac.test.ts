import { describe, expect, it } from "vitest";
import { calculateBaseArmorClass, calculateInitiativeBonus, calculateMaxHp, effectiveAc, effectiveInitiative, getAbilityModifier, preserveHpDamage } from "./index";

describe("final shinobi HP and AC rules", () => {
  it.each([[8,-1],[10,0],[12,1],[14,2],[16,3],[18,4],[20,5]])("ability modifier %i", (score, modifier) => expect(getAbilityModifier(score)).toBe(modifier));
  it.each([[1,10,10],[1,14,12],[5,14,44],[10,14,84],[20,14,164],[10,16,94]])("max HP", (level, con, hp) => expect(calculateMaxHp(level, con)).toBe(hp));
  it.each([[8,11],[10,12],[12,13],[14,14],[16,15],[18,16],[20,17]])("base AC", (dex, ac) => expect(calculateBaseArmorClass(dex)).toBe(ac));
  it.each([[8,-1],[10,0],[12,1],[14,2],[16,3],[18,4],[20,5]])("initiative bonus", (dex, bonus) => { expect(calculateInitiativeBonus(dex)).toBe(bonus); expect(effectiveInitiative(dex)).toBe(bonus); expect(effectiveInitiative(dex, 5)).toBe(5); });
  it("uses and removes DM AC overrides", () => { expect(effectiveAc(16)).toBe(15); expect(effectiveAc(16, 18)).toBe(18); expect(effectiveAc(16, null)).toBe(15); });
  it("preserves damage when max HP changes and clamps at zero", () => { expect(preserveHpDamage(80, 84, 94)).toBe(90); expect(preserveHpDamage(2, 10, 5)).toBe(0); });
});
