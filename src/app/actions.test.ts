import {beforeEach,expect,it,vi} from "vitest";
import {Prisma} from "@prisma/client";
import {basicNatureKeys} from "../../seeding/chakra-natures";
import {creationFailureMessage, natureUnavailableMessage, jutsuUnavailableMessage} from "../lib/character-creation";
const {prisma,requireCampaign}=vi.hoisted(()=>({requireCampaign:vi.fn(),prisma:{chakraNature:{findUnique:vi.fn()},jutsu:{findMany:vi.fn()},character:{create:vi.fn()},characterJutsu:{createMany:vi.fn()},$transaction:vi.fn()}}));
vi.mock("@/lib/prisma",()=>({prisma}));
vi.mock("@/lib/session",()=>({requireCampaign}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
vi.mock("@/lib/rules",async()=>await import("../lib/rules"));
import {createCharacter} from "./actions";
const form=()=>{const fd=new FormData();for(const [k,v] of Object.entries({name:"Shinobi",level:"1",mode:"MANUAL",hitDie:"d8",hitDieAbilityBonus:"CON",str:"10",dex:"10",con:"13",int:"10",wis:"10",cha:"10",nature:"FIRE",maxHp:"9999",finalCon:"20",acOverride:"99"}))fd.set(k,v);return fd;};
beforeEach(()=>{vi.clearAllMocks();prisma.chakraNature.findUnique.mockResolvedValue({id:"fire",key:"FIRE",playerSelectable:true});prisma.jutsu.findMany.mockResolvedValue([]);prisma.character.create.mockResolvedValue({id:"new"});prisma.$transaction.mockImplementation(fn=>fn(prisma));});
it("persists server-derived scores and HP ignoring forged values",async()=>{await createCharacter("campaign",form());expect(requireCampaign).toHaveBeenCalledWith("campaign");expect(prisma.character.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({con:14,maxHp:10,currentHp:10,currentChakra:175,hitDie:"d8",hitDieAbilityBonus:"CON",acOverride:null})}));});
it.each(["d6","d12","", "d10"])("rejects forged die/bonus %s before persistence",async die=>{const fd=form();fd.set("hitDie",die);await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false});expect(prisma.character.create).not.toHaveBeenCalled();});
it("rejects multiple submitted bonuses",async()=>{const fd=form();fd.append("hitDieAbilityBonus","DEX");await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false});});
it("requires campaign access",async()=>{requireCampaign.mockRejectedValueOnce(new Error("Unauthorized"));await expect(createCharacter("campaign",form())).resolves.toMatchObject({ok:false,code:"ACCESS"});expect(prisma.character.create).not.toHaveBeenCalled();});

it("accepts d10 without bonus and persists no bonus",async()=>{const fd=form();fd.set("hitDie","d10");fd.delete("hitDieAbilityBonus");await createCharacter("campaign",fd);expect(prisma.character.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({con:13,maxHp:11,hitDie:"d10",hitDieAbilityBonus:null})}));});
it("rejects missing d8 bonus",async()=>{const fd=form();fd.delete("hitDieAbilityBonus");await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false});expect(prisma.character.create).not.toHaveBeenCalled();});
it.each(["POINT_BUY","STANDARD_ARRAY","invalid"])("enforces score mode %s on the server",async mode=>{const fd=form();fd.set("mode",mode);fd.set("str","16");await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false});expect(prisma.character.create).not.toHaveBeenCalled();});

it("creates higher-level characters from one manual roll per level",async()=>{
 const fd=form();fd.set("level","3");fd.set("hpRollMode2","MANUAL");fd.set("hpRawRoll2","1");fd.set("hpRollMode3","MANUAL");fd.set("hpRawRoll3","8");
 await createCharacter("campaign",fd);
 expect(prisma.character.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({level:3,maxHp:26,currentHp:26,hpLevels:{create:[{level:2,hitDie:"d8",rawRoll:1,effectiveRoll:4},{level:3,hitDie:"d8",rawRoll:8,effectiveRoll:8}]}})}));
});
it("rolls automatically on confirmed creation without trusting client raw results",async()=>{
 const fd=form();fd.set("level","2");fd.set("hpRollMode2","AUTO");fd.set("hpRawRoll2","999");await createCharacter("campaign",fd);
 const data=prisma.character.create.mock.calls[0][0].data;
 expect(data.hpLevels.create).toHaveLength(1);const roll=data.hpLevels.create[0];
 expect(roll.rawRoll).toBeGreaterThanOrEqual(1);expect(roll.rawRoll).toBeLessThanOrEqual(8);expect(roll.effectiveRoll).toBe(Math.max(4,roll.rawRoll));expect(data.maxHp).toBe(12+roll.effectiveRoll);
});
it("rejects higher-level creation with missing or invalid HP rolls",async()=>{
 const fd=form();fd.set("level","2");await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false,code:"HP"});
 fd.set("hpRollMode2","MANUAL");fd.set("hpRawRoll2","9");await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false});expect(prisma.character.create).not.toHaveBeenCalled();
});

it.each(basicNatureKeys)("allows basic nature %s",async key=>{
 const fd=form();fd.set("nature",key);prisma.chakraNature.findUnique.mockResolvedValueOnce({id:key,key,playerSelectable:true});
 await expect(createCharacter("campaign",fd)).resolves.toEqual({ok:true,destination:"/campaign/campaign"});expect(prisma.character.create).toHaveBeenCalled();
});
it.each(["NIKKOTON","IRON_RELEASE"])("returns a safe error for special nature %s",async key=>{
 const fd=form();fd.set("nature",key);prisma.chakraNature.findUnique.mockResolvedValueOnce({id:key,key,playerSelectable:false});
 await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false,code:"NATURE",message:natureUnavailableMessage});expect(prisma.character.create).not.toHaveBeenCalled();
});
it("rejects manipulated nature IDs and unknown natures without a Prisma exception",async()=>{
 const fd=form();fd.set("chakraNatureId","unknown");prisma.chakraNature.findUnique.mockResolvedValueOnce(null);
 await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false,code:"NATURE"});expect(prisma.character.create).not.toHaveBeenCalled();
});
it.each(["Very Low","Average","INVALID","SPECIAL"])("validates reservoir %s before persistence",async value=>{
 const fd=form();fd.set("reservoir",value);await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false,code:"CHAKRA"});expect(prisma.character.create).not.toHaveBeenCalled();
});
it("persists canonical reservoir and chosen control/regeneration values",async()=>{
 const fd=form();fd.set("reservoir","VERY_LOW");fd.set("regen","EXPERT");fd.set("control","MASTER");await createCharacter("campaign",fd);
 expect(prisma.character.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({reservoir:"VERY_LOW",regenRank:"EXPERT",controlRank:"MASTER"})}));
});
it.each([{skill:"bogus"},{savingThrow:"bogus"},{skill:["Stealth","Stealth"]},{savingThrow:["STR","STR"]}])("rejects invalid or duplicate skills/saves %j",async values=>{
 const fd=form();for(const [key,value] of Object.entries(values))for(const item of Array.isArray(value)?value:[value])fd.append(key,item);
 await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false});expect(prisma.character.create).not.toHaveBeenCalled();
});
it.each(["name","nature","hitDie","level","mode","con"])("controls missing required field %s",async key=>{
 const fd=form();fd.delete(key);await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false});expect(prisma.character.create).not.toHaveBeenCalled();
});
it("localizes the missing talent bonus",async()=>{
 const fd=form();fd.delete("hitDieAbilityBonus");await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false,message:"Wähle ein Attribut für deinen +1-Talentbonus."});
});
it("accepts allowed nature/jutsu but rejects missing and duplicate jutsu",async()=>{
 const fd=form();fd.append("jutsu","fire-jutsu");prisma.jutsu.findMany.mockResolvedValueOnce([{id:"fire-jutsu",rank:"D",campaignId:null,requiredNatureKeys:null,natures:[{nature:{key:"FIRE",playerSelectable:true}}]}]);
 await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:true});expect(prisma.characterJutsu.createMany).toHaveBeenCalled();
 vi.clearAllMocks();await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false,code:"JUTSU",message:jutsuUnavailableMessage});expect(prisma.character.create).not.toHaveBeenCalled();
 fd.append("jutsu","fire-jutsu");await expect(createCharacter("campaign",fd)).resolves.toMatchObject({ok:false,code:"JUTSU"});
});
it("converts expected Prisma constraints into structured failures",async()=>{
 prisma.character.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("internal constraint data",{code:"P2002",clientVersion:"6.16.2"}));
 const result=await createCharacter("campaign",form());expect(result).toMatchObject({ok:false,code:"CONFLICT"});expect(JSON.stringify(result)).not.toContain("internal constraint data");
});
it("logs unexpected Prisma failures but never exposes internals",async()=>{
 const log=vi.spyOn(console,"error").mockImplementation(()=>{});
 try {
  prisma.character.create.mockRejectedValueOnce(new Prisma.PrismaClientValidationError("internal stack and database details",{clientVersion:"6.16.2"}));
  await expect(createCharacter("campaign",form())).resolves.toEqual({ok:false,code:"INTERNAL",message:creationFailureMessage});expect(log).toHaveBeenCalledOnce();
 }finally{log.mockRestore();}
});
