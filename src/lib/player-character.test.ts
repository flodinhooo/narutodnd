import {expect,it} from "vitest";
import {rollDamage,inventorySchema,emptyItem,itemPresets,attackValues} from "./player-character";
it("doubles only dice on critical hits and clamps negative unarmed damage",()=>{
 expect(rollDamage("2d6+1",3,true,()=>6)).toMatchObject({rolls:[6,6,6,6],total:28});
 expect(rollDamage("1",-3,true,()=>6).total).toBe(0);
});
it("bounds custom dice, inventory counts and weights",()=>{
 for(const damageDice of ["1000d1000","1d1","-5","1d4 + document.cookie"])expect(inventorySchema.safeParse({...itemPresets[0],damageDice}).success).toBe(false);
 expect(inventorySchema.safeParse({...emptyItem,name:"Seil",quantity:-1}).success).toBe(false);
 expect(inventorySchema.safeParse({...emptyItem,name:"Seil",weight:Infinity}).success).toBe(false);
});
it("calculates weapon bonuses from ability and proficiency",()=>{
 expect(attackValues({level:1,str:14,dex:16,con:10,int:10,wis:10,cha:10},"DEX",true)).toEqual({modifier:3,bonus:5});
});
