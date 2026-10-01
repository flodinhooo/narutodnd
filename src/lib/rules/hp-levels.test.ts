import {describe, expect, it} from "vitest";
import {calculateHpContribution, calculateMaxHp, effectiveMaxHp, getEffectiveHpRoll, preserveHpDamage} from "./index";
import {getCharacterHpChange} from "../character-hp";
import {rollHitDie, signAutoHpRoll, verifyAutoHpRoll} from "../hp-roll";

const rolls = [5, 2, 8].map((rawRoll, index) => ({level: index + 2, hitDie: "d8", rawRoll, effectiveRoll: getEffectiveHpRoll("d8", rawRoll)}));
describe("persistent HP rules", () => {
 it.each([[1,4],[2,4],[3,4],[4,4],[5,5],[8,8]])("d8 raw %i -> effective %i", (raw, effective) => expect(getEffectiveHpRoll("d8", raw)).toBe(effective));
 it.each([[1,5],[4,5],[5,5],[6,6],[10,10]])("d10 raw %i -> effective %i", (raw, effective) => expect(getEffectiveHpRoll("d10", raw)).toBe(effective));
 it.each([0,9,-1,2.5,NaN,Infinity,"2",null])("rejects invalid d8 roll %s", raw => expect(() => getEffectiveHpRoll("d8", raw)).toThrow());
 it.each([0,11,-1,1.5,"bad"])("rejects invalid d10 roll %s", raw => expect(() => getEffectiveHpRoll("d10", raw)).toThrow());
 it("rejects unsupported dice", () => expect(() => getEffectiveHpRoll("d12", 5)).toThrow());
 it("adds current positive and negative CON modifiers", () => {expect(calculateHpContribution("d8", 2, 14)).toBe(6);expect(calculateHpContribution("d10", 1, 8)).toBe(4);expect(calculateHpContribution("d8",1,1)).toBe(-1);});
 it("keeps level one maximized without a roll", () => {expect(calculateMaxHp(1,14,"d8")).toBe(10);expect(calculateMaxHp(1,14,"d10")).toBe(12);});
 it("calculates level four from persisted rolls", () => expect(calculateMaxHp(4,14,"d8",rolls)).toBe(33));
 it("applies CON retrospectively to every level", () => {expect(calculateMaxHp(4,12,"d8",rolls)).toBe(29);expect(calculateMaxHp(4,14,"d8",rolls)).toBe(33);expect(calculateMaxHp(4,8,"d8",rolls)).toBe(21);});
 it("ignores future rolls when level decreases", () => expect(calculateMaxHp(2,14,"d8",rolls)).toBe(17));
 it("requires every missing level and rejects duplicate or forged history", () => {
  expect(() => calculateMaxHp(4,14,"d8",rolls.slice(1))).toThrow("level 2");
  expect(() => calculateMaxHp(4,14,"d8",[...rolls,rolls[0]])).toThrow("Duplicate");
  expect(() => calculateMaxHp(4,14,"d8",[{...rolls[0],effectiveRoll:8},...rolls.slice(1)])).toThrow("effective");
 });
 it.each([0,21,1.5,NaN])("rejects invalid level %s", level => expect(() => calculateMaxHp(level,14)).toThrow());
 it("preserves the legacy baseline without fabricated rolls", () => {
  const legacy={hpLegacyLevel:5,hpLegacyBase:35};
  expect(calculateMaxHp(5,12,"d10",[],legacy)).toBe(40);
  expect(calculateMaxHp(5,14,"d10",[],legacy)).toBe(45);
  expect(calculateMaxHp(6,14,"d10",[{level:6,hitDie:"d10",rawRoll:1,effectiveRoll:5}],legacy)).toBe(52);
  expect(calculateMaxHp(3,12,"d10",[],legacy)).toBe(38);
 });
 it("adds the same gain to current HP and preserves damage", () => expect(preserveHpDamage(32,40,48)).toBe(40));
 it("clamps current HP when the maximum shrinks", () => {expect(preserveHpDamage(1,40,30)).toBe(0);expect(preserveHpDamage(40,40,30)).toBe(30);});
 it("keeps the override offset on CON changes and can explicitly clear it", () => {
  const old={level:4,con:12,hitDie:"d8",hpLevels:rolls,maxHp:39,currentHp:31,hpOverrideOffset:10};
  expect(getCharacterHpChange(old,{level:4,con:14,hpLevels:rolls})).toEqual({maxHp:43,currentHp:35,hpOverrideOffset:10});
  expect(getCharacterHpChange(old,{level:4,con:14,hpLevels:rolls},"")).toEqual({maxHp:33,currentHp:25,hpOverrideOffset:null});
  expect(effectiveMaxHp(20,-30)).toBe(1);
 });
 it.each(["d8","d10"])("automatic rolls stay in %s range", hitDie => {for(let i=0;i<100;i++){const raw=rollHitDie(hitDie);expect(Number.isInteger(raw)).toBe(true);expect(raw).toBeGreaterThanOrEqual(1);expect(raw).toBeLessThanOrEqual(hitDie==="d8"?8:10);}});
 it("signs the raw result and binds it to session, character and level", () => {
  const expected={campaignId:"a",characterId:"b",level:2,hitDie:"d8"};
  const token=signAutoHpRoll({...expected,rawRoll:2},"secret-session");
  expect(verifyAutoHpRoll(token,expected,"secret-session")).toBe(2);
  expect(() => verifyAutoHpRoll(token,expected,"other-session")).toThrow();
  expect(() => verifyAutoHpRoll(token,{...expected,level:3},"secret-session")).toThrow();
  expect(() => verifyAutoHpRoll(token,{...expected,characterId:"c"},"secret-session")).toThrow();
  expect(() => verifyAutoHpRoll(`x${token}`,expected,"secret-session")).toThrow();
 });
});
