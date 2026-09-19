export type Ability = "STR"|"DEX"|"CON"|"INT"|"WIS"|"CHA";
export const abilities: Ability[]=["STR","DEX","CON","INT","WIS","CHA"];
export const skills={Acrobatics:"DEX", "Animal Handling":"WIS",Arcana:"INT",Athletics:"STR",Deception:"CHA",History:"INT",Insight:"WIS",Intimidation:"CHA",Investigation:"INT",Medicine:"WIS",Nature:"INT",Perception:"WIS",Performance:"CHA",Persuasion:"CHA",Religion:"INT","Sleight of Hand":"DEX",Stealth:"DEX",Survival:"WIS"} as const;
export const getAbilityModifier=(score:number)=>Math.floor((score-10)/2);
export const getProficiencyBonus=(level:number)=>level<5?2:level<9?3:level<13?4:level<17?5:6;
export const reservoirMultipliers={VERY_LOW:.5,LOW:.75,AVERAGE:1,HIGH:1.2,VERY_HIGH:1.5,EXCEPTIONAL:1.75,MONSTER:2} as const;
export function calculateMaxChakra(level:number,con:number,wis:number,reservoir:keyof typeof reservoirMultipliers|"SPECIAL",custom=1){const base=150+level*(20+getAbilityModifier(con)*2+getAbilityModifier(wis)*2); return Math.round(base*(reservoir==="SPECIAL"?custom:reservoirMultipliers[reservoir])/5)*5}
export function preserveChakra(old:number,oldMax:number,newMax:number){return old>=oldMax?newMax:Math.min(old,newMax)}
export const regenPercent={NOVICE:.1,TRAINED:.15,ADVANCED:.2,EXPERT:.25,MASTER:.35} as const;
export const calculateShortRestChakraRecovery=(max:number,rank:keyof typeof regenPercent)=>Math.round(max*regenPercent[rank]/5)*5;
export function getChakraExhaustionState(current:number,max:number){if(max<=0||current===0)return {key:"CHAKRA_EMPTY",modifier:-3}; const pct=current/max*100;if(pct<=10)return {key:"CRITICALLY_EXHAUSTED",modifier:-2};if(pct<=25)return {key:"EXHAUSTED",modifier:-1};if(pct<=50)return {key:"STRAINED",modifier:0};return {key:"NORMAL",modifier:0}}
export const getDeathSaveMode=(current:number,max:number)=>current===0?"DISADVANTAGE":current/max>.33?"ADVANTAGE":"NORMAL";
export const getLimitBreakHpCost=(rank:string)=>({D:5,C:10,B:20,A:35,S:50}[rank]??0);
export const effectiveAc=(dex:number,override?:number|null)=>override??10+getAbilityModifier(dex);
export const skillModifier=(score:number,level:number,proficiency:"NONE"|"PROFICIENT"|"EXPERTISE")=>getAbilityModifier(score)+(proficiency==="PROFICIENT"?getProficiencyBonus(level):proficiency==="EXPERTISE"?getProficiencyBonus(level)*2:0);
export const savingThrowModifier=skillModifier;
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function shortRestState(hp:number,maxHp:number,current:number,maxChakra:number,rank:keyof typeof regenPercent,rests:number){if(rests>=2)throw new Error("Short Rest limit reached");return {currentHp:maxHp,currentChakra:clamp(current+calculateShortRestChakraRecovery(maxChakra,rank),0,maxChakra),shortRestsSinceLongRest:rests+1,severelyWounded:false}}
export const longRestState=(maxHp:number,maxChakra:number)=>({currentHp:maxHp,currentChakra:maxChakra,shortRestsSinceLongRest:0,limitBreakUsed:false,severelyWounded:false,deathSaveSuccesses:0,deathSaveFailures:0});
export const canRemoveNature=(isPrimary:boolean,total:number)=>!isPrimary&&total>1;
export const limitBreakBonus=(attackType?:string|null,saveAbility?:string|null)=>attackType?"ADVANTAGE":saveAbility?"+2 SAVE DC":null;
export const standardArray=[15,14,13,12,10,8];
export const pointBuyCosts={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9} as const;
export const pointBuyCost=(score:number)=>pointBuyCosts[score as keyof typeof pointBuyCosts]??Infinity;
export const pointBuyTotal=(scores:number[])=>scores.reduce((sum,score)=>sum+pointBuyCost(score),0);
export const validStandardArray=(scores:number[])=>scores.length===6&&[...scores].sort((a,b)=>a-b).join(",")===[...standardArray].sort((a,b)=>a-b).join(",");
export const validPointBuy=(scores:number[])=>scores.length===6&&scores.every(score=>score>=8&&score<=15)&&pointBuyTotal(scores)<=27;
export const validStartingSkills=(skills:string[])=>skills.length<=3&&new Set(skills).size===skills.length;
