import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {PrismaClient, type Prisma} from "@prisma/client";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve, sep} from "node:path";
import {calculateMaxHp, getEffectiveHpRoll} from "../lib/rules";
import {basicNatureKeys, chakraNatureNames, chakraNatureSeed} from "../../seeding/chakra-natures";
import {HomebrewElementalJutsu} from "../../seeding/jutsu-homebrew-elemental.generated";
import {natureUnavailableMessage, jutsuUnavailableMessage} from "../lib/character-creation";

const {requireCampaign, getSession, revalidatePath, database} = vi.hoisted(() => ({requireCampaign:vi.fn(),getSession:vi.fn(),revalidatePath:vi.fn(),database:{client:null as unknown as PrismaClient}}));
vi.mock("@/lib/session", () => ({requireCampaign,getSession}));
vi.mock("next/cache", () => ({revalidatePath}));
vi.mock("@/lib/prisma", () => ({get prisma(){return database.client;}}));
import {confirmHpLevelUp, previewAutomaticHpRoll} from "./hp-actions";
import {updateCharacter} from "./dm-actions";
import {createCharacter} from "./actions";
import NewCharacter from "./campaign/[campaignId]/characters/new/page";

let directory: string;
let campaignId: string;
let legacySnapshot: unknown;
let specialAssignments: unknown;
let globalFire: string, mixedSpecial: string, foreignJutsu: string, sRankJutsu: string;
const form = (data: Record<string,string>) => {const fd=new FormData();for(const [key,value] of Object.entries(data))fd.set(key,value);return fd;};
const levelForm = (level: number, rawRoll="6") => form({level:String(level),mode:"MANUAL",rawRoll});
const makeCharacter = (extra: Partial<Prisma.CharacterUncheckedCreateInput> = {}) => database.client.character.create({data:{campaignId,name:"Test Shinobi",con:14,maxHp:12,currentHp:4,...extra}});
const readCharacter = (id: string) => database.client.character.findUniqueOrThrow({where:{id},include:{hpLevels:{orderBy:{level:"asc"}}}});

beforeAll(async () => {
 directory=await mkdtemp(join(tmpdir(),"narutodnd-hp-tests-"));
 database.client=new PrismaClient({datasourceUrl:`file:${join(directory,"test.sqlite").replaceAll("\\","/")}`});
 const root=join(process.cwd(),"prisma","migrations");
 for(const name of (await readdir(root)).filter(n=>/^\d/.test(n)).sort()){
  if(name==="20261001130000_hp_level_history"){
   await database.client.$executeRawUnsafe(`INSERT INTO "Campaign" (id,name,dmCodeHash,playerCodeHash,updatedAt) VALUES ('legacy-campaign','Legacy','dm-legacy','player-legacy',1700000000000)`);
   for(const [id,con,maxHp,currentHp] of [["legacy",9,40,32],["legacy-negative",1,8,3]] as const)
    await database.client.$executeRawUnsafe(`INSERT INTO "Character" (id,campaignId,name,level,con,maxHp,currentHp,updatedAt) VALUES (?,?,?,?,?,?,?,?)`,id,"legacy-campaign",id,5,con,maxHp,currentHp,1700000000000);
   legacySnapshot=await database.client.$queryRawUnsafe('SELECT id,level,con,maxHp,currentHp FROM Character ORDER BY id');
  }
  if(name==="20261001140000_creator_nature_visibility"){
   for(const key of Object.keys(chakraNatureNames)){
    const seed=chakraNatureSeed(key);
    await database.client.$executeRawUnsafe('INSERT INTO ChakraNature (id,key,displayName,description) VALUES (?,?,?,?)',`nature-${key}`,key,seed.displayName,seed.description);
   }
   await database.client.$executeRawUnsafe("INSERT INTO CharacterChakraNature (characterId,chakraNatureId,isPrimary) VALUES ('legacy','nature-IRON_RELEASE',1)");
   specialAssignments=await database.client.$queryRawUnsafe('SELECT * FROM CharacterChakraNature');
  }
  const sql=(await readFile(join(root,name,"migration.sql"),"utf8")).replace(/^\s*--.*$/gm,"");
  for(const statement of sql.split(";").map(s=>s.trim()).filter(Boolean)) await database.client.$executeRawUnsafe(statement);
 }
 const campaign=await database.client.campaign.create({data:{name:"HP Tests",dmCodeHash:"test-dm",playerCodeHash:"test-player"}});
 campaignId=campaign.id;
 const record=HomebrewElementalJutsu.find(r=>r.natures.length===1&&r.natures[0]==="FIRE"&&r.rank!=="S"&&(r.requiredNatures??[]).every(key=>key==="FIRE"));
 if(!record)throw new Error("Seed must contain an eligible basic Fire jutsu");
 const data={name:record.name,germanName:record.germanName,slug:record.slug,description:record.description||record.rawMarkdown,rank:record.rank??"E",chakraCost:record.chakraCost??0,range:record.range||"Self",duration:record.duration||"Instantaneous",actionType:record.actionType||"Action",requiredNatureKeys:JSON.stringify(record.requiredNatures??[])};
 const fireLink={create:{chakraNatureId:"nature-FIRE"}};
 globalFire=(await database.client.jutsu.create({data:{...data,natures:fireLink}})).id;
 mixedSpecial=(await database.client.jutsu.create({data:{...data,slug:"mixed-special",natures:{create:[{chakraNatureId:"nature-FIRE"},{chakraNatureId:"nature-IRON_RELEASE"}]}}})).id;
 const other=await database.client.campaign.create({data:{name:"Other",dmCodeHash:"other-dm",playerCodeHash:"other-player"}});
 foreignJutsu=(await database.client.jutsu.create({data:{...data,campaignId:other.id,origin:"DM_CUSTOM",natures:fireLink}})).id;
 sRankJutsu=(await database.client.jutsu.create({data:{...data,slug:"s-rank",rank:"S",natures:fireLink}})).id;
},30000);
beforeEach(()=>{vi.clearAllMocks();requireCampaign.mockResolvedValue({id:"test-session",campaignId,role:"DM"});getSession.mockResolvedValue({id:"test-session",campaignId,role:"PLAYER"});});
afterAll(async()=>{
 await database.client?.$disconnect();
 if(directory){
  const target=resolve(directory);
  if(!target.startsWith(resolve(tmpdir())+sep)||!basename(target).startsWith("narutodnd-hp-tests-"))throw new Error("Unexpected test cleanup target");
  await rm(target,{recursive:true,force:true});
 }
});

describe("safe character creation with actual seed values and SQLite",()=>{
 const creatorForm=()=>form({name:"Creator regression",level:"1",hitDie:"d8",hitDieAbilityBonus:"CON",mode:"MANUAL",str:"10",dex:"10",con:"13",int:"10",wis:"10",cha:"10",speed:"30",reservoir:"AVERAGE",nature:"FIRE"});
 it("migration exposes only five basics and preserves existing special assignments",async()=>{
  const selectable=await database.client.chakraNature.findMany({where:{playerSelectable:true}});expect(selectable.map(n=>n.key).sort()).toEqual([...basicNatureKeys].sort());
  expect(await database.client.$queryRawUnsafe('SELECT * FROM CharacterChakraNature WHERE characterId=\'legacy\'')).toEqual(specialAssignments);
  expect((await database.client.chakraNature.create({data:{key:"FUTURE_SPECIAL",displayName:"Future",description:"Special"}})).playerSelectable).toBe(false);
 });
 it("the real Creator loader hides special natures, foreign jutsu and S ranks",async()=>{
  const page=await NewCharacter({params:Promise.resolve({campaignId})});
  expect(page.props.natures.map((n:{key:string})=>n.key).sort()).toEqual([...basicNatureKeys].sort());
  expect(page.props.jutsu.map((j:{id:string})=>j.id)).toContain(globalFire);
  for(const id of [mixedSpecial,foreignJutsu,sRankJutsu])expect(page.props.jutsu.map((j:{id:string})=>j.id)).not.toContain(id);
 });
 it.each(["NIKKOTON","IRON_RELEASE"])("controlled rejection of %s creates no character",async key=>{
  const nature=await database.client.chakraNature.findUniqueOrThrow({where:{key}});const count=await database.client.character.count();
  const fd=creatorForm();fd.set("nature",nature.key);await expect(createCharacter(campaignId,fd)).resolves.toMatchObject({ok:false,code:"NATURE",message:natureUnavailableMessage});
  fd.delete("nature");fd.set("chakraNatureId",nature.id);await expect(createCharacter(campaignId,fd)).resolves.toMatchObject({ok:false,code:"NATURE"});
  expect(await database.client.character.count()).toBe(count);
 });
 it("rejects unknown or contradictory manipulated nature IDs",async()=>{
  const count=await database.client.character.count(),fd=creatorForm();fd.set("chakraNatureId","nonexistent");
  await expect(createCharacter(campaignId,fd)).resolves.toMatchObject({ok:false,code:"NATURE"});
  fd.set("chakraNatureId","nature-WATER");await expect(createCharacter(campaignId,fd)).resolves.toMatchObject({ok:false,code:"NATURE"});expect(await database.client.character.count()).toBe(count);
 });
 it.each(basicNatureKeys)("creates a valid character with basic nature %s",async key=>{
  const fd=creatorForm();fd.set("nature",key);await expect(createCharacter(campaignId,fd)).resolves.toEqual({ok:true,destination:`/campaign/${campaignId}`});
  const c=await database.client.character.findFirstOrThrow({where:{campaignId,name:"Creator regression",natureLinks:{some:{nature:{key}}}},include:{natureLinks:true}});expect(c.con).toBe(14);expect(c.maxHp).toBe(10);expect(c.natureLinks).toHaveLength(1);
 });
 it("creates an allowed starting jutsu from real seed data",async()=>{
  const fd=creatorForm();fd.set("jutsu",globalFire);const before=await database.client.characterJutsu.count();
  await expect(createCharacter(campaignId,fd)).resolves.toMatchObject({ok:true});expect(await database.client.characterJutsu.count()).toBe(before+1);
 });
 it.each(["unknown","special","foreign","s-rank"])("rejects %s jutsu atomically",async kind=>{
  const fd=creatorForm();fd.set("jutsu",kind==="special"?mixedSpecial:kind==="foreign"?foreignJutsu:kind==="s-rank"?sRankJutsu:"not-a-jutsu");const before=await database.client.character.count();
  await expect(createCharacter(campaignId,fd)).resolves.toMatchObject({ok:false,code:"JUTSU",message:jutsuUnavailableMessage});expect(await database.client.character.count()).toBe(before);
 });
 it("rejects the original display-label enum crash before Prisma persistence",async()=>{
  const fd=creatorForm();fd.set("reservoir","Very Low");const before=await database.client.character.count();await expect(createCharacter(campaignId,fd)).resolves.toMatchObject({ok:false,code:"CHAKRA"});expect(await database.client.character.count()).toBe(before);
 });
});

describe("HP history migrations and real server actions",()=>{
 it("preserves all legacy HP and creates no invented rolls",async()=>{
  expect(await database.client.$queryRawUnsafe('SELECT id,level,con,maxHp,currentHp FROM Character WHERE id LIKE \'legacy%\' ORDER BY id')).toEqual(legacySnapshot);
  for(const id of ["legacy","legacy-negative"]){const c=await readCharacter(id);expect(c.hpLevels).toEqual([]);expect(calculateMaxHp(c.level,c.con,c.hitDie,c.hpLevels,c)).toBe(c.maxHp);}
  expect(await database.client.campaign.findUnique({where:{id:"legacy-campaign"}})).not.toBeNull();
 });
 it("persists raw and effective rolls while ignoring forged client contributions",async()=>{
  const c=await makeCharacter({hitDie:"d8",maxHp:10,currentHp:2});
  const fd=levelForm(2,"2");fd.set("effectiveRoll","8");fd.set("hpIncrease","9999");
  await confirmHpLevelUp(campaignId,c.id,fd);
  const next=await readCharacter(c.id);expect(next.hpLevels).toEqual([expect.objectContaining({level:2,hitDie:"d8",rawRoll:2,effectiveRoll:4})]);
  expect(next.maxHp).toBe(16);expect(next.currentHp).toBe(8);expect(next.maxHp-next.currentHp).toBe(8);
  expect(requireCampaign).toHaveBeenCalledWith(campaignId,true);
 });
 it("implements 32/40 +8 -> 40/48",async()=>{
  const c=await makeCharacter({level:4,maxHp:40,currentHp:32,hpLevels:{create:[6,6,10].map((rawRoll,i)=>({level:i+2,hitDie:"d10",rawRoll,effectiveRoll:rawRoll}))}});
  await confirmHpLevelUp(campaignId,c.id,levelForm(5));const next=await readCharacter(c.id);expect([next.currentHp,next.maxHp]).toEqual([40,48]);
 });
 it("automatically previews once and confirms that exact raw result",async()=>{
  const c=await makeCharacter();const preview=await previewAutomaticHpRoll(campaignId,c.id,2);
  expect(preview.rawRoll).toBeGreaterThanOrEqual(1);expect(preview.rawRoll).toBeLessThanOrEqual(10);
  expect((await readCharacter(c.id)).hpLevels).toEqual([]);
  await confirmHpLevelUp(campaignId,c.id,form({level:"2",mode:"AUTO",token:preview.token,rawRoll:"10"}));
  const next=await readCharacter(c.id);expect(next.hpLevels[0].rawRoll).toBe(preview.rawRoll);expect(next.hpLevels[0].effectiveRoll).toBe(preview.effectiveRoll);
 });
 it("rejects forged automatic tokens and cross-character previews",async()=>{
  const a=await makeCharacter(), b=await makeCharacter();const preview=await previewAutomaticHpRoll(campaignId,a.id,2);
  await expect(confirmHpLevelUp(campaignId,b.id,form({level:"2",mode:"AUTO",token:preview.token}))).rejects.toThrow();
  await expect(confirmHpLevelUp(campaignId,a.id,form({level:"2",mode:"AUTO",token:"forged",rawRoll:"10"}))).rejects.toThrow();
  expect((await readCharacter(a.id)).hpLevels).toEqual([]);
 });
 it.each(["0","11","-1","2.5","no","", "Infinity"])("rejects invalid manual d10 raw %s",async raw=>{
  const c=await makeCharacter();await expect(confirmHpLevelUp(campaignId,c.id,levelForm(2,raw))).rejects.toThrow();expect((await readCharacter(c.id)).level).toBe(1);
 });
 it.each(["0","9"])("rejects invalid manual d8 raw %s",async raw=>{const c=await makeCharacter({hitDie:"d8",maxHp:10,currentHp:2});await expect(confirmHpLevelUp(campaignId,c.id,levelForm(2,raw))).rejects.toThrow();});
 it("rejects duplicate confirmations and database inserts",async()=>{
  const c=await makeCharacter();await confirmHpLevelUp(campaignId,c.id,levelForm(2));
  await expect(confirmHpLevelUp(campaignId,c.id,levelForm(2,"10"))).rejects.toThrow();
  await expect(database.client.characterHpLevel.create({data:{characterId:c.id,level:2,hitDie:"d10",rawRoll:10,effectiveRoll:10}})).rejects.toThrow();
  expect((await readCharacter(c.id)).hpLevels).toHaveLength(1);
 });
 it("prevents concurrent confirmations from creating two rolls or gaining HP twice",async()=>{
  const c=await makeCharacter();const results=await Promise.allSettled([confirmHpLevelUp(campaignId,c.id,levelForm(2)),confirmHpLevelUp(campaignId,c.id,levelForm(2))]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);const next=await readCharacter(c.id);expect(next.hpLevels).toHaveLength(1);expect(next.maxHp).toBe(20);expect(next.currentHp).toBe(12);
 });
 it("retains history on level reduction and reuses it without reroll",async()=>{
  const c=await makeCharacter();await confirmHpLevelUp(campaignId,c.id,levelForm(2,"1"));
  await updateCharacter(campaignId,c.id,form({level:"1"}));expect((await readCharacter(c.id)).hpLevels).toHaveLength(1);
  await expect(previewAutomaticHpRoll(campaignId,c.id,2)).rejects.toThrow("reuse");
  await confirmHpLevelUp(campaignId,c.id,form({level:"2",mode:"AUTO",token:"forged"}));
  const next=await readCharacter(c.id);expect(next.hpLevels[0].rawRoll).toBe(1);expect(next.maxHp).toBe(19);expect(next.currentHp).toBe(11);
 });
 it("requires a separate confirmed roll for each missing level",async()=>{
  const c=await makeCharacter();await expect(updateCharacter(campaignId,c.id,form({level:"4",maxHp:"999"}))).rejects.toThrow("level 2");
  await expect(confirmHpLevelUp(campaignId,c.id,levelForm(4))).rejects.toThrow("one level");
  for(const level of [2,3,4])await confirmHpLevelUp(campaignId,c.id,levelForm(level));
  const next=await readCharacter(c.id);expect(next.level).toBe(4);expect(next.hpLevels.map(r=>r.level)).toEqual([2,3,4]);
 });
 it("applies CON increases retrospectively and preserves damage on decreases",async()=>{
  const c=await makeCharacter({level:5,con:12,maxHp:39,currentHp:29,hpLevels:{create:[6,6,6,6].map((rawRoll,i)=>({level:i+2,hitDie:"d10",rawRoll,effectiveRoll:rawRoll}))}});
  await updateCharacter(campaignId,c.id,form({con:"14"}));let next=await readCharacter(c.id);expect([next.currentHp,next.maxHp]).toEqual([34,44]);
  await updateCharacter(campaignId,c.id,form({con:"8"}));next=await readCharacter(c.id);expect([next.currentHp,next.maxHp]).toEqual([19,29]);
  await database.client.character.update({where:{id:c.id},data:{currentHp:1}});await updateCharacter(campaignId,c.id,form({con:"1"}));next=await readCharacter(c.id);expect(next.currentHp).toBe(0);expect(next.maxHp).toBe(9);
 });
 it("keeps DM overrides through level ups and CON changes; clearing restores derived HP",async()=>{
  const c=await makeCharacter();await updateCharacter(campaignId,c.id,form({maxHp:"22"}));let next=await readCharacter(c.id);expect(next.hpOverrideOffset).toBe(10);
  await confirmHpLevelUp(campaignId,c.id,levelForm(2));next=await readCharacter(c.id);expect([next.currentHp,next.maxHp]).toEqual([22,30]);
  await updateCharacter(campaignId,c.id,form({con:"16",maxHp:"30"}));next=await readCharacter(c.id);expect([next.currentHp,next.maxHp,next.hpOverrideOffset]).toEqual([24,32,10]);
  await updateCharacter(campaignId,c.id,form({maxHp:""}));next=await readCharacter(c.id);expect([next.currentHp,next.maxHp,next.hpOverrideOffset]).toEqual([14,22,null]);
 });
 it("keeps unrelated fields when submitting a chakra-only form",async()=>{
  const c=await makeCharacter({acOverride:18,speed:35});await updateCharacter(campaignId,c.id,form({currentChakra:"50"}));
  const next=await readCharacter(c.id);expect(next).toMatchObject({name:c.name,str:c.str,con:c.con,maxHp:12,currentHp:4,acOverride:18,speed:35,currentChakra:50});
 });
 it("blocks player actions and cross-campaign character access",async()=>{
  const c=await makeCharacter();requireCampaign.mockRejectedValueOnce(new Error("Unauthorized"));await expect(confirmHpLevelUp(campaignId,c.id,levelForm(2))).rejects.toThrow("Unauthorized");
  requireCampaign.mockRejectedValueOnce(new Error("Unauthorized"));await expect(previewAutomaticHpRoll(campaignId,c.id,2)).rejects.toThrow("Unauthorized");
  requireCampaign.mockRejectedValueOnce(new Error("Unauthorized"));await expect(updateCharacter(campaignId,c.id,form({maxHp:"99"}))).rejects.toThrow("Unauthorized");
  await expect(confirmHpLevelUp("legacy-campaign",c.id,levelForm(2))).rejects.toThrow("not found");expect((await readCharacter(c.id)).hpLevels).toEqual([]);
 });
 it("adds only future rolls to a legacy baseline, including after lowering and restoring",async()=>{
  const c=await makeCharacter({level:5,con:12,maxHp:40,currentHp:32,hpLegacyLevel:5,hpLegacyBase:35});
  await confirmHpLevelUp(campaignId,c.id,levelForm(6,"1"));let next=await readCharacter(c.id);expect(next.hpLevels.map(r=>r.level)).toEqual([6]);expect([next.currentHp,next.maxHp]).toEqual([38,46]);
  await updateCharacter(campaignId,c.id,form({level:"3"}));next=await readCharacter(c.id);expect(next.hpLevels).toHaveLength(1);expect(next.maxHp).toBe(38);
  for(const level of [4,5,6])await confirmHpLevelUp(campaignId,c.id,form({level:String(level)}));next=await readCharacter(c.id);expect(next.hpLevels).toHaveLength(1);expect([next.currentHp,next.maxHp]).toEqual([38,46]);
 });
 it("roll insertion is rolled back if the character update fails",async()=>{
  const c=await makeCharacter();
  await database.client.$executeRawUnsafe("CREATE TRIGGER test_failure BEFORE UPDATE ON Character BEGIN SELECT RAISE(ABORT,'simulated update failure'); END");
  try {await expect(confirmHpLevelUp(campaignId,c.id,levelForm(2))).rejects.toThrow();expect((await readCharacter(c.id)).hpLevels).toEqual([]);}
  finally {await database.client.$executeRawUnsafe("DROP TRIGGER test_failure");}
 });
 it("enforces raw/effective ranges at database level",async()=>{
  const c=await makeCharacter();await expect(database.client.characterHpLevel.create({data:{characterId:c.id,level:2,hitDie:"d8",rawRoll:2,effectiveRoll:8}})).rejects.toThrow();
  expect(getEffectiveHpRoll("d8",2)).toBe(4);
 });
});
