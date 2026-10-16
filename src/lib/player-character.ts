import {z} from "zod";
import {getAbilityModifier, getProficiencyBonus} from "./rules";

export const itemCategories = {EQUIPMENT:"Ausrüstung",WEAPON:"Waffen",CONSUMABLE:"Verbrauchbares",TREASURE:"Wertsachen",OTHER:"Sonstiges"};
export const dicePattern = /^(?:[1-9]\d?|(?:[1-9]|1\d|20)d(?:[2-9]|[1-9]\d|100)(?:[+-]\d{1,2})?)$/i;
export const inventorySchema = z.object({
 id:z.string().max(100).optional(), version:z.number().int().min(1).optional(),
 name:z.string().trim().min(1).max(120), category:z.enum(["EQUIPMENT","WEAPON","CONSUMABLE","TREASURE","OTHER"]),
 description:z.string().trim().max(2000).default(""), quantity:z.number().int().min(0).max(100000), weight:z.number().finite().min(0).max(10000),
 equipped:z.boolean(), damageDice:z.string().trim().max(20).nullable().default(null), damageType:z.string().trim().max(50).nullable().default(null),
 attackAbility:z.enum(["STR","DEX","CON","INT","WIS","CHA"]).default("DEX"), proficient:z.boolean().default(true),
 range:z.string().trim().max(100).default(""), throwable:z.boolean().default(false),
}).superRefine((value,ctx)=>{
 if(value.id && !value.version)ctx.addIssue({code:"custom",message:"Version fehlt."});
 if(value.category === "WEAPON" && (!value.damageDice || !dicePattern.test(value.damageDice)))ctx.addIssue({code:"custom",message:"Schaden als Würfelformel angeben, z. B. 1d4 oder 2d6+1."});
});
export type InventoryInput = z.infer<typeof inventorySchema>;
export const emptyItem: InventoryInput = {name:"",category:"EQUIPMENT",description:"",quantity:1,weight:0,equipped:false,damageDice:null,damageType:null,attackAbility:"DEX",proficient:true,range:"",throwable:false};
export const itemPresets: InventoryInput[] = [
 {...emptyItem,name:"Kunai",category:"WEAPON",description:"Editierbare Waffenvorlage; Werte mit der Spielleitung abstimmen.",damageDice:"1d4",damageType:"Stich",equipped:true,throwable:true,range:"Nahkampf / Wurf: 6 m, maximal 18 m"},
 {...emptyItem,name:"Shuriken",category:"WEAPON",description:"Editierbare Waffenvorlage; Werte mit der Spielleitung abstimmen.",damageDice:"1d4",damageType:"Stich",equipped:true,throwable:true,range:"Wurf: 6 m, maximal 18 m"},
 {...emptyItem,name:"Katana",category:"WEAPON",description:"Editierbare Waffenvorlage; Werte mit der Spielleitung abstimmen.",damageDice:"1d8",damageType:"Hieb",attackAbility:"STR",equipped:true,range:"Nahkampf: 1,5 m"},
 {...emptyItem,name:"Seil",quantity:1}, {...emptyItem,name:"Rationen",category:"CONSUMABLE",quantity:5}, {...emptyItem,name:"Ryo",category:"TREASURE",quantity:0},
];
export const rollModes = {NORMAL:"Normal",ADVANTAGE:"Vorteil",DISADVANTAGE:"Nachteil"};
export type RollMode = keyof typeof rollModes;
export function attackValues(character: {level:number;str:number;dex:number;con:number;int:number;wis:number;cha:number}, ability:string, proficient:boolean) {
 const key = ability.toLowerCase() as "str"|"dex"|"con"|"int"|"wis"|"cha";
 const modifier = getAbilityModifier(character[key]);
 return {modifier,bonus:modifier+(proficient?getProficiencyBonus(character.level):0)};
}
export function rollDamage(formula:string, modifier:number, critical:boolean, roll:(sides:number)=>number) {
 if(!dicePattern.test(formula))throw Error("Ungültige Schadensformel.");
 const dice=formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
 const rolls:number[]=[];
 if(dice)for(let i=0;i<Number(dice[1])*(critical?2:1);i++)rolls.push(roll(Number(dice[2])));
 const flat=dice?Number(dice[3]||0):Number(formula);
 return {rolls,total:Math.max(0,rolls.reduce((a,b)=>a+b,0)+flat+modifier),modifier,formula,critical};
}
export const attackResultSchema=z.object({kind:z.literal("ATTACK"),message:z.string(),name:z.string(),rolls:z.array(z.number()),kept:z.number(),total:z.number(),bonus:z.number(),modifier:z.number(),damageDice:z.string(),damageType:z.string(),critical:z.boolean()});
export type AttackResult = z.infer<typeof attackResultSchema>;
export const characterResultSchema=z.union([attackResultSchema,z.object({kind:z.string(),message:z.string()})]);
export type CharacterResult = {kind:string;message:string} | AttackResult;
export type PlayerResponse = {ok:true;message:string;claimCode?:string} | {ok:false;message:string;retryable?:boolean};
export type InventoryView = InventoryInput & {id:string;version:number};
export type ActivityView = {id:string;createdAt:string;result:CharacterResult};
