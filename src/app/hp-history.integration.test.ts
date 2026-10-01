import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {PrismaClient, type Prisma} from "@prisma/client";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve, sep} from "node:path";
import {calculateMaxHp, getEffectiveHpRoll} from "../lib/rules";

const {requireCampaign, revalidatePath, database} = vi.hoisted(() => ({requireCampaign:vi.fn(),revalidatePath:vi.fn(),database:{client:null as unknown as PrismaClient}}));
vi.mock("@/lib/session", () => ({requireCampaign}));
vi.mock("next/cache", () => ({revalidatePath}));
vi.mock("@/lib/prisma", () => ({get prisma(){return database.client;}}));
import {confirmHpLevelUp, previewAutomaticHpRoll} from "./hp-actions";
import {updateCharacter} from "./dm-actions";

let directory: string;
let campaignId: string;
let legacySnapshot: unknown;
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
  const sql=(await readFile(join(root,name,"migration.sql"),"utf8")).replace(/^\s*--.*$/gm,"");
  for(const statement of sql.split(";").map(s=>s.trim()).filter(Boolean)) await database.client.$executeRawUnsafe(statement);
 }
 const campaign=await database.client.campaign.create({data:{name:"HP Tests",dmCodeHash:"test-dm",playerCodeHash:"test-player"}});
 campaignId=campaign.id;
},30000);
beforeEach(()=>{vi.clearAllMocks();requireCampaign.mockResolvedValue({id:"test-session",campaignId,role:"DM"});});
afterAll(async()=>{
 await database.client?.$disconnect();
 if(directory){
  const target=resolve(directory);
  if(!target.startsWith(resolve(tmpdir())+sep)||!basename(target).startsWith("narutodnd-hp-tests-"))throw new Error("Unexpected test cleanup target");
  await rm(target,{recursive:true,force:true});
 }
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
