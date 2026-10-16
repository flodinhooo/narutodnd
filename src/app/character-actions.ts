"use server";
import {createHash,randomBytes,randomInt} from "node:crypto";
import {z} from "zod";
import {Prisma} from "@prisma/client";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {requireCampaign} from "@/lib/session";
import {controllerKey,controlsCharacter} from "@/lib/character-control";
import {calculateMaxChakra,shortRestState,longRestState} from "@/lib/rules";
import {inventorySchema,attackValues,rollDamage,attackResultSchema,type CharacterResult,type PlayerResponse} from "@/lib/player-character";
import {jutsuTitle} from "@/lib/jutsu-content";

const commandSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("REST"),rest:z.enum(["SHORT","LONG"])}),
 z.object({kind:z.literal("CAST"),jutsuId:z.string().min(1).max(100)}),
 z.object({kind:z.literal("SAVE_ITEM"),item:inventorySchema}),
 z.object({kind:z.literal("REMOVE_ITEM"),itemId:z.string().min(1).max(100),version:z.number().int().positive()}),
 z.object({kind:z.literal("ATTACK"),itemId:z.string().max(100).nullable(),mode:z.enum(["NORMAL","ADVANTAGE","DISADVANTAGE"]),throwWeapon:z.boolean()}),
 z.object({kind:z.literal("DAMAGE"),attackId:z.string().min(1).max(100)}),
]);
class PlayerError extends Error {
 constructor(message:string,public retryable=false){super(message);}
}
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const refresh=(campaignId:string)=>revalidatePath(`/campaign/${campaignId}`,"layout");

export async function characterAction(campaignId:string,characterId:string,requestId:string,submitted:unknown):Promise<PlayerResponse>{
 try{
  const actor=await requireCampaign(campaignId);
  const command=commandSchema.parse(submitted);
  z.string().regex(/^[a-zA-Z0-9:-]{8,120}$/).parse(requestId);
  const key=actor.role==="PLAYER"?await controllerKey(true):null;
  const nonce=command.kind==="DAMAGE"?`damage:${command.attackId}`:requestId;
  const fingerprint=digest(JSON.stringify(command));
  const result=await prisma.$transaction(async tx=>{
   let c=await tx.character.findFirst({where:{id:characterId,campaignId},include:{npc:{select:{id:true}}}});
   if(!c||!controlsCharacter(c,actor,key))throw new PlayerError("Du kannst nur deinen eigenen Charakter steuern. Bitte die Spielleitung um einen Übernahmecode.");
   const prior=await tx.characterActivity.findUnique({where:{characterId_requestId:{characterId,requestId:nonce}}});
   if(prior){if(prior.fingerprint!==fingerprint)throw new PlayerError("Diese Anfrage gehört zu einer anderen Aktion.");return prior.result as CharacterResult;}
   const locked=await tx.character.updateMany({where:{id:characterId,activityVersion:c.activityVersion},data:{activityVersion:{increment:1},...(actor.role==="PLAYER"?{portraitOwnerKey:key}:{})}});
   if(locked.count!==1)throw new PlayerError("Der Charakter wurde gerade geändert. Bitte erneut versuchen.",true);
   c=await tx.character.findFirstOrThrow({where:{id:characterId,campaignId},include:{npc:{select:{id:true}}}});
   let result:CharacterResult;
   if(command.kind==="REST"){
    const max=calculateMaxChakra(c.level,c.con,c.wis,c.reservoir,c.customReservoirMultiplier??1);
    if(command.rest==="SHORT"&&c.shortRestsSinceLongRest>=2)throw new PlayerError("Die zwei kurzen Rasten sind aufgebraucht. Zuerst eine lange Rast durchführen.");
    const state=command.rest==="SHORT"?shortRestState(c.currentHp,c.maxHp,c.currentChakra,max,c.regenRank,c.shortRestsSinceLongRest):longRestState(c.maxHp,max);
    await tx.character.update({where:{id:characterId},data:state});
    result={kind:"REST",message:`${command.rest==="SHORT"?"Kurze":"Lange"} Rast: ${state.currentHp} TP, ${state.currentChakra} Chakra.`};
   }else if(command.kind==="CAST"){
    if(c.currentHp<=0)throw new PlayerError("Mit 0 TP kannst du kein Jutsu einsetzen.");
    const learned=await tx.characterJutsu.findFirst({where:{characterId,jutsuId:command.jutsuId,jutsu:{AND:[{OR:[{campaignId:null},{campaignId}]},...(actor.role==="PLAYER"?[{dmOnly:false,reviewNeeded:false}]:[])]}},include:{jutsu:true}});
    if(!learned)throw new PlayerError("Dieses Jutsu ist für deinen Charakter nicht erlernt oder nicht verfügbar.");
    const cost=learned.jutsu.chakraCost;
    if(!Number.isInteger(cost)||cost<0)throw new PlayerError("Die Chakrakosten dieser Technik müssen geprüft werden.");
    const spent=await tx.character.updateMany({where:{id:characterId,currentChakra:{gte:cost}},data:{currentChakra:{decrement:cost}}});
    if(!spent.count)throw new PlayerError("Nicht genug Chakra für dieses Jutsu.");
    result={kind:"CAST",message:`${jutsuTitle(learned.jutsu)} eingesetzt: ${cost} Chakra verbraucht.`};
   }else if(command.kind==="SAVE_ITEM"){
    const {id,version,...input}=command.item;
    const data=input.category==="WEAPON"?input:{...input,damageDice:null,damageType:null,throwable:false};
    if(id){const changed=await tx.inventoryItem.updateMany({where:{id,characterId,version},data:{...data,version:{increment:1}}});if(!changed.count)throw new PlayerError("Der Gegenstand wurde geändert oder gehört nicht zu dir. Bitte den Bogen neu laden.");}
    else {if(await tx.inventoryItem.count({where:{characterId}})>=250)throw new PlayerError("Das Inventar kann höchstens 250 unterschiedliche Gegenstände enthalten.");await tx.inventoryItem.create({data:{...data,characterId}});}
    result={kind:"INVENTORY",message:`${input.name} ${id?"aktualisiert":"hinzugefügt"}.`};
   }else if(command.kind==="REMOVE_ITEM"){
    const removed=await tx.inventoryItem.deleteMany({where:{id:command.itemId,characterId,version:command.version}});
    if(!removed.count)throw new PlayerError("Der Gegenstand wurde geändert oder gehört nicht zu dir.");
    result={kind:"INVENTORY",message:"Gegenstand aus dem Inventar entfernt."};
   }else if(command.kind==="ATTACK"){
    if(c.currentHp<=0)throw new PlayerError("Mit 0 TP kannst du nicht angreifen.");
    const weapon=command.itemId?await tx.inventoryItem.findFirst({where:{id:command.itemId,characterId,category:"WEAPON",equipped:true,quantity:{gt:0}}}):null;
    if(command.itemId&&!weapon)throw new PlayerError("Diese Waffe ist nicht ausgerüstet, aufgebraucht oder gehört nicht zu dir.");
    if(command.throwWeapon&&(!weapon||!weapon.throwable))throw new PlayerError("Diese Waffe ist nicht als Wurfwaffe eingerichtet.");
    const {modifier,bonus}=attackValues(c,weapon?.attackAbility||"STR",weapon?.proficient??true);
    const rolls=[randomInt(1,21)];if(command.mode!=="NORMAL")rolls.push(randomInt(1,21));
    const kept=command.mode==="ADVANTAGE"?Math.max(...rolls):command.mode==="DISADVANTAGE"?Math.min(...rolls):rolls[0];
    const name=weapon?.name||"Unbewaffneter Schlag";
    if(command.throwWeapon)await tx.inventoryItem.update({where:{id:weapon!.id},data:{quantity:{decrement:1},version:{increment:1}}});
    result={kind:"ATTACK",name,rolls,kept,total:kept+bonus,bonus,modifier,damageDice:weapon?.damageDice||"1",damageType:weapon?.damageType||"Wucht",critical:kept===20,message:`${name}${command.throwWeapon?" (Wurf, 1 Stück verbraucht)":""}: ${rolls.join(" / ")} auf W20 ${bonus>=0?"+":""}${bonus} = ${kept+bonus}${kept===20?" · Kritischer Treffer":kept===1?" · Kritischer Fehlschlag":""}.`};
   }else{
    const event=await tx.characterActivity.findFirst({where:{id:command.attackId,characterId}});
    const attack=attackResultSchema.safeParse(event?.result);
    if(!attack.success||attack.data.kept===1)throw new PlayerError("Für diesen Angriff kann kein Schaden gewürfelt werden.");
    const damage=rollDamage(attack.data.damageDice,attack.data.modifier,attack.data.critical,sides=>randomInt(1,sides+1));
    result={kind:"DAMAGE",message:`${attack.data.name}: ${damage.total} ${attack.data.damageType}-Schaden${damage.critical?" (kritisch, doppelte Würfel)":""}. Würfel: ${damage.rolls.join(" + ")||"fester Schaden"}; Attribut ${damage.modifier>=0?"+":""}${damage.modifier}. Schaden am Ziel bitte selbst eintragen.`};
   }
   await tx.characterActivity.create({data:{characterId,requestId:nonce,fingerprint,result:result as Prisma.InputJsonValue}});
   return result;
  },{timeout:15000});
  refresh(campaignId);return {ok:true,message:result.message};
 }catch(error){
  if(error instanceof PlayerError)return {ok:false,message:error.message,retryable:error.retryable};
  if(error instanceof z.ZodError)return {ok:false,message:error.issues[0]?.code==="custom"?error.issues[0].message:"Bitte Eingaben und Würfelformeln prüfen."};
  if(error instanceof Error&&error.message==="Unauthorized")return {ok:false,message:"Dein Kampagnenzugang ist abgelaufen. Bitte erneut anmelden."};
  if(error instanceof Prisma.PrismaClientKnownRequestError&&["P2002","P2034","P2028"].includes(error.code))return {ok:false,message:"Die Aktion wird bereits verarbeitet oder der Bogen wurde geändert. Bitte erneut versuchen.",retryable:true};
  console.error("Character action failed",{campaignId,characterId,error});
  return {ok:false,message:"Die Aktion konnte nicht bestätigt werden. Bitte erneut versuchen.",retryable:true};
 }
}

export async function createCharacterClaim(campaignId:string,characterId:string):Promise<PlayerResponse>{
 try{
  await requireCampaign(campaignId,true);
  const code=randomBytes(12).toString("hex").toUpperCase();
  const updated=await prisma.character.updateMany({where:{id:characterId,campaignId,npc:null},data:{controlClaimHash:digest(code)}});
  if(!updated.count)return {ok:false,message:"Nur Spielercharaktere können übergeben werden."};
  return {ok:true,message:"Übernahmecode erstellt. Nur dem zugehörigen Spieler geben.",claimCode:code};
 }catch{return {ok:false,message:"Übernahmecode konnte nicht erstellt werden. DM-Zugang erforderlich."};}
}

export async function claimCharacter(campaignId:string,characterId:string,code:string):Promise<PlayerResponse>{
 try{
  const actor=await requireCampaign(campaignId);
  if(actor.role!=="PLAYER")return {ok:false,message:"Bitte mit dem Spielerzugang anmelden."};
  const trimmed=code.trim().toUpperCase();
  if(!/^[A-F0-9]{24}$/.test(trimmed))return {ok:false,message:"Ungültiger Übernahmecode."};
  const key=await controllerKey(true);
  const updated=await prisma.character.updateMany({where:{id:characterId,campaignId,npc:null,controlClaimHash:digest(trimmed)},data:{portraitOwnerKey:key,controlClaimHash:null,activityVersion:{increment:1}}});
  if(!updated.count)return {ok:false,message:"Der Übernahmecode ist ungültig oder wurde bereits verwendet."};
  refresh(campaignId);return {ok:true,message:"Du kannst diesen Charakter jetzt steuern."};
 }catch{return {ok:false,message:"Charakter konnte nicht übernommen werden. Bitte Kampagnenzugang prüfen."};}
}
