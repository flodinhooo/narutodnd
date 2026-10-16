import {beforeAll,beforeEach,afterAll,expect,it,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {createHash,randomUUID} from "node:crypto";
import {mkdtemp,readdir,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const {db,actor,jar,rolls}=vi.hoisted(()=>({db:{client:null as unknown as PrismaClient},actor:{id:"player-session",campaignId:"a",role:"PLAYER"},jar:new Map<string,string>(),rolls:[] as number[]}));
vi.mock("@/lib/prisma",()=>({get prisma(){return db.client;}}));
vi.mock("@/lib/session",()=>({requireCampaign:vi.fn(async(id:string,dm=false)=>{if(id!==actor.campaignId||(dm&&actor.role!=="DM"))throw Error("Unauthorized");return {...actor};})}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(key:string)=>jar.has(key)?{value:jar.get(key)}:undefined,set:(key:string,value:string)=>jar.set(key,value)})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("node:crypto",async original=>({...await original<typeof import("node:crypto")>(),randomInt:vi.fn((min:number)=>rolls.shift()??min)}));
import {characterAction,createCharacterClaim,claimCharacter} from "./character-actions";
import {emptyItem,itemPresets} from "@/lib/player-character";
import {calculateMaxChakra} from "@/lib/rules";
let directory:string,id:string,other:string,foreign:string;
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
const send=(command:unknown,nonce=randomUUID(),char=id)=>characterAction("a",char,nonce,command);
const current=()=>db.client.character.findUniqueOrThrow({where:{id}});
beforeAll(async()=>{
 directory=await mkdtemp(join(tmpdir(),"player-actions-"));db.client=new PrismaClient({datasourceUrl:`file:${join(directory,"test.sqlite").replaceAll("\\","/")}`});
 for(const dir of (await readdir("prisma/migrations")).filter(x=>/^\d/.test(x)).sort())for(const sql of (await readFile(join("prisma/migrations",dir,"migration.sql"),"utf8")).replace(/^\s*--.*$/gm,"").split(";").map(x=>x.trim()).filter(Boolean))await db.client.$executeRawUnsafe(sql);
 for(const campaignId of ["a","b"])await db.client.campaign.create({data:{id:campaignId,name:campaignId,dmCodeHash:`dm-${campaignId}`,playerCodeHash:`p-${campaignId}`}});
 for(const [jutsuId,cost,dmOnly] of [["learned",30,false],["unknown",1,false],["secret",1,true]] as const)await db.client.jutsu.create({data:{id:jutsuId,slug:jutsuId,name:jutsuId,rank:"D",chakraCost:cost,dmOnly,description:"Wirkung",range:"Self",duration:"Instantaneous",actionType:"Action"}});
},60000);
beforeEach(async()=>{
 actor.id="player-session";actor.campaignId="a";actor.role="PLAYER";jar.clear();rolls.length=0;
 id=(await db.client.character.create({data:{campaignId:"a",name:"Player",portraitOwnerKey:hash(actor.id),maxHp:20,currentHp:20,currentChakra:100,str:14,dex:16,jutsuLinks:{create:[{jutsuId:"learned"},{jutsuId:"secret"}]}}})).id;
 other=(await db.client.character.create({data:{campaignId:"a",name:"Other",portraitOwnerKey:hash("other")}})).id;
 foreign=(await db.client.character.create({data:{campaignId:"b",name:"Foreign",portraitOwnerKey:hash(actor.id)}})).id;
});
afterAll(async()=>{await db.client.$disconnect();await rm(directory,{recursive:true,force:true});});

it("spends the server's learned-Jutsu cost exactly once and never permits negative chakra",async()=>{
 const nonce=randomUUID();expect(await send({kind:"CAST",jutsuId:"learned",chakraCost:0},nonce)).toMatchObject({ok:true});
 expect((await current()).currentChakra).toBe(70);
 expect(await send({kind:"CAST",jutsuId:"learned",chakraCost:999},nonce)).toMatchObject({ok:true});
 expect((await current()).currentChakra).toBe(70);
 await send({kind:"CAST",jutsuId:"learned"});await send({kind:"CAST",jutsuId:"learned"});
 expect(await send({kind:"CAST",jutsuId:"learned"})).toMatchObject({ok:false});expect((await current()).currentChakra).toBe(10);
 expect(await db.client.characterActivity.count({where:{characterId:id}})).toBe(3);
});
it("rejects foreign characters, another player, NPCs, unknown and secret Jutsu",async()=>{
 for(const char of [other,foreign])expect(await send({kind:"REST",rest:"LONG"},randomUUID(),char)).toMatchObject({ok:false});
 for(const jutsuId of ["unknown","secret"])expect(await send({kind:"CAST",jutsuId})).toMatchObject({ok:false});
 await db.client.npc.create({data:{campaignId:"a",name:"NPC",characterId:id}});
 expect(await send({kind:"REST",rest:"LONG"})).toMatchObject({ok:false});
});
it("does not double-spend on concurrent submissions with the same request ID",async()=>{
 const nonce=randomUUID();await Promise.all([send({kind:"CAST",jutsuId:"learned"},nonce),send({kind:"CAST",jutsuId:"learned"},nonce)]);
 expect(await send({kind:"CAST",jutsuId:"learned"},nonce)).toMatchObject({ok:true});
 expect((await current()).currentChakra).toBe(70);
 expect(await db.client.characterActivity.count({where:{characterId:id,requestId:nonce}})).toBe(1);
});
it("retains ownership after a new login on the same device",async()=>{
 expect(await send({kind:"CAST",jutsuId:"learned"})).toMatchObject({ok:true});
 expect(jar.has("character_controller")).toBe(true);
 actor.id="new-session";expect(await send({kind:"CAST",jutsuId:"learned"})).toMatchObject({ok:true});
 jar.clear();expect(await send({kind:"CAST",jutsuId:"learned"})).toMatchObject({ok:false});
});
it("enforces rest limits, resets resources and does not replay a rest after spending chakra",async()=>{
 await db.client.character.update({where:{id},data:{currentHp:1,currentChakra:0,severelyWounded:true,limitBreakUsed:true}});
 for(let i=0;i<2;i++)expect(await send({kind:"REST",rest:"SHORT"})).toMatchObject({ok:true});
 expect(await send({kind:"REST",rest:"SHORT"})).toMatchObject({ok:false});
 const nonce=randomUUID();expect(await send({kind:"REST",rest:"LONG"},nonce)).toMatchObject({ok:true});
 const c=await current();expect(c).toMatchObject({currentHp:20,shortRestsSinceLongRest:0,limitBreakUsed:false,severelyWounded:false});
 expect(c.currentChakra).toBe(calculateMaxChakra(c.level,c.con,c.wis,c.reservoir));
 await send({kind:"CAST",jutsuId:"learned"});await send({kind:"REST",rest:"LONG"},nonce);
 expect((await current()).currentChakra).toBe(c.currentChakra-30);
});
it("supports custom inventory, rejects forged versions and confines changes to the owner",async()=>{
 const nonce=randomUUID();const item={...emptyItem,name:"Mein Brief",description:"Eigener Gegenstand",quantity:2};
 expect(await send({kind:"SAVE_ITEM",item},nonce)).toMatchObject({ok:true});await send({kind:"SAVE_ITEM",item},nonce);
 const saved=await db.client.inventoryItem.findFirstOrThrow({where:{characterId:id}});expect(await db.client.inventoryItem.count({where:{characterId:id}})).toBe(1);
 expect(await send({kind:"SAVE_ITEM",item:{...saved,quantity:1}})).toMatchObject({ok:true});
 expect(await send({kind:"SAVE_ITEM",item:{...saved,quantity:0}})).toMatchObject({ok:false});
 expect(await send({kind:"SAVE_ITEM",item:{...item,quantity:-1}})).toMatchObject({ok:false});
 const stranger=await db.client.inventoryItem.create({data:{characterId:other,name:"Other item"}});
 expect(await send({kind:"REMOVE_ITEM",itemId:stranger.id,version:1})).toMatchObject({ok:false});
 expect(await send({kind:"REMOVE_ITEM",itemId:saved.id,version:2})).toMatchObject({ok:true});
});
it("rolls equipped weapons, consumes thrown quantity once and records a stable damage result",async()=>{
 await send({kind:"SAVE_ITEM",item:{...itemPresets[0],quantity:2}});
 const weapon=await db.client.inventoryItem.findFirstOrThrow({where:{characterId:id}});
 rolls.push(5,20);const nonce=randomUUID();
 expect(await send({kind:"ATTACK",itemId:weapon.id,mode:"ADVANTAGE",throwWeapon:true},nonce)).toMatchObject({ok:true});
 await send({kind:"ATTACK",itemId:weapon.id,mode:"ADVANTAGE",throwWeapon:true},nonce);
 expect((await db.client.inventoryItem.findUniqueOrThrow({where:{id:weapon.id}})).quantity).toBe(1);
 const attack=await db.client.characterActivity.findUniqueOrThrow({where:{characterId_requestId:{characterId:id,requestId:nonce}}});
 expect(attack.result).toMatchObject({kept:20,total:25,modifier:3,critical:true,damageDice:"1d4"});
 rolls.push(4,4);const first=await send({kind:"DAMAGE",attackId:attack.id});expect(first).toMatchObject({ok:true,message:expect.stringContaining("11 Stich-Schaden")});
 expect(await send({kind:"DAMAGE",attackId:attack.id})).toEqual(first);
 expect(await db.client.characterActivity.count({where:{characterId:id,requestId:`damage:${attack.id}`}})).toBe(1);
});
it("supports unarmed attacks and rejects empty or unequipped weapons",async()=>{
 rolls.push(12);expect(await send({kind:"ATTACK",itemId:null,mode:"NORMAL",throwWeapon:false})).toMatchObject({ok:true});
 const event=await db.client.characterActivity.findFirstOrThrow({where:{characterId:id}});expect(event.result).toMatchObject({total:16,damageDice:"1",modifier:2});
 const weapon=await db.client.inventoryItem.create({data:{characterId:id,name:"Empty",category:"WEAPON",damageDice:"1d4",quantity:0,equipped:true}});
 expect(await send({kind:"ATTACK",itemId:weapon.id,mode:"NORMAL",throwWeapon:false})).toMatchObject({ok:false});
});
it("lets only the DM issue single-use ownership transfers and invalidates the old owner",async()=>{
 expect(await createCharacterClaim("a",id)).toMatchObject({ok:false});actor.role="DM";
 const response=await createCharacterClaim("a",id);expect(response).toMatchObject({ok:true});
 if(!response.ok||!response.claimCode)throw Error("No claim code");
 actor.role="PLAYER";actor.id="new-owner";
 expect(await claimCharacter("a",id,response.claimCode)).toMatchObject({ok:true});
 expect(await claimCharacter("a",id,response.claimCode)).toMatchObject({ok:false});
 expect(await send({kind:"CAST",jutsuId:"learned"})).toMatchObject({ok:true});
 jar.clear();actor.id="player-session";expect(await send({kind:"CAST",jutsuId:"learned"})).toMatchObject({ok:false});
});
