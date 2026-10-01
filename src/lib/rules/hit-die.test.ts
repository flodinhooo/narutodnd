import {describe, expect, it} from "vitest";
import {abilities, validateHitDieChoice, getFinalAbilityScores, getCreationAbilityScores, calculateMaxHp, calculateMaxChakra, calculateBaseArmorClass, calculateInitiativeBonus, getAbilityModifier, skillModifier, savingThrowModifier, standardArray, pointBuyTotal, type AbilityScores} from "./index";
const base: AbilityScores = {str:15,dex:13,con:13,int:12,wis:13,cha:8};
describe("hit die creation", () => {
 it.each(abilities)("applies exactly +1 %s", bonus => {validateHitDieChoice("d8",bonus);const final=getFinalAbilityScores(base,"d8",bonus);for(const a of abilities){const k=a.toLowerCase() as keyof AbilityScores;expect(final[k]).toBe(base[k]+(a===bonus?1:0));}expect(base.str).toBe(15);});
 it("accepts d10 and removes d8 bonus",()=>{validateHitDieChoice("d10",null);expect(getFinalAbilityScores(base,"d10","DEX")).toEqual(base);});
 it.each(["d6","d12","",null,"D8"])("rejects invalid die %s",die=>expect(()=>validateHitDieChoice(die,null)).toThrow());
 it.each([null,"", "DEX,CON",["STR","DEX"],"dex"])("requires exactly one valid d8 bonus %s",bonus=>expect(()=>validateHitDieChoice("d8",bonus)).toThrow());
 it("rejects d10 bonus",()=>expect(()=>getCreationAbilityScores("MANUAL",base,"d10","DEX")).toThrow());
 it("validates base array before bonus",()=>{const array={str:15,dex:14,con:13,int:12,wis:10,cha:8};expect(getCreationAbilityScores("STANDARD_ARRAY",array,"d8","STR").str).toBe(16);expect(Object.values(array)).toEqual(standardArray);});
 it("uses only base point buy costs",()=>{const points={str:15,dex:15,con:15,int:8,wis:8,cha:8};expect(pointBuyTotal(Object.values(points))).toBe(27);expect(getCreationAbilityScores("POINT_BUY",points,"d8","STR").str).toBe(16);expect(()=>getCreationAbilityScores("POINT_BUY",{...points,int:9},"d10",null)).toThrow();expect(()=>getCreationAbilityScores("POINT_BUY",{...points,str:16},"d10",null)).toThrow();});
 it("preserves manual mode and enforces final limits",()=>{expect(getCreationAbilityScores("MANUAL",base,"d8","STR").str).toBe(16);expect(()=>getCreationAbilityScores("MANUAL",{...base,str:20},"d8","STR")).toThrow();expect(()=>getCreationAbilityScores("BAD",base,"d10",null)).toThrow();});
 it("uses final DEX in all modifiers",()=>{const final=getFinalAbilityScores(base,"d8","DEX");expect(getAbilityModifier(final.dex)).toBe(2);expect(skillModifier(final.dex,1,"PROFICIENT")).toBe(4);expect(savingThrowModifier(final.dex,1,"PROFICIENT")).toBe(4);expect(calculateInitiativeBonus(final.dex)).toBe(2);expect(calculateBaseArmorClass(final.dex)).toBe(14);});
 it.each(["CON","WIS"] as const)("uses final %s for chakra",bonus=>{const final=getFinalAbilityScores(base,"d8",bonus);expect(calculateMaxChakra(5,final.con,final.wis,"AVERAGE")).toBeGreaterThan(calculateMaxChakra(5,base.con,base.wis,"AVERAGE"));});
 it("uses explicit higher-level rolls",()=>{const rolls=Array.from({length:4},(_,i)=>({level:i+2,hitDie:"d8",rawRoll:6,effectiveRoll:6}));expect(calculateMaxHp(5,14,"d8",rolls)).toBe(42);expect(calculateMaxHp(5,14,"d10",rolls)).toBe(44);expect(()=>calculateMaxHp(5,14,"d8")).toThrow();});
 it("uses final CON for level one HP",()=>{const final=getFinalAbilityScores(base,"d8","CON");expect(calculateMaxHp(1,final.con,"d8")).toBe(10);expect(calculateMaxHp(1,base.con,"d8")).toBe(9);expect(calculateMaxHp(1,14,"d10")).toBe(12);});
});
