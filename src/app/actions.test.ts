import {beforeEach,expect,it,vi} from "vitest";
const {prisma,requireCampaign}=vi.hoisted(()=>({requireCampaign:vi.fn(),prisma:{chakraNature:{findUniqueOrThrow:vi.fn()},jutsu:{findMany:vi.fn()},character:{create:vi.fn()},$transaction:vi.fn()}}));
vi.mock("@/lib/prisma",()=>({prisma}));
vi.mock("@/lib/session",()=>({requireCampaign}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
vi.mock("@/lib/rules",async()=>await import("../lib/rules"));
import {createCharacter} from "./actions";
const form=()=>{const fd=new FormData();for(const [k,v] of Object.entries({name:"Shinobi",level:"1",mode:"MANUAL",hitDie:"d8",hitDieAbilityBonus:"CON",str:"10",dex:"10",con:"13",int:"10",wis:"10",cha:"10",nature:"FIRE",maxHp:"9999",finalCon:"20",acOverride:"99"}))fd.set(k,v);return fd;};
beforeEach(()=>{vi.clearAllMocks();prisma.chakraNature.findUniqueOrThrow.mockResolvedValue({id:"fire"});prisma.jutsu.findMany.mockResolvedValue([]);prisma.character.create.mockResolvedValue({id:"new"});prisma.$transaction.mockImplementation(fn=>fn(prisma));});
it("persists server-derived scores and HP ignoring forged values",async()=>{await createCharacter("campaign",form());expect(requireCampaign).toHaveBeenCalledWith("campaign");expect(prisma.character.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({con:14,maxHp:10,currentHp:10,currentChakra:175,hitDie:"d8",hitDieAbilityBonus:"CON",acOverride:null})}));});
it.each(["d6","d12","", "d10"])("rejects forged die/bonus %s before persistence",async die=>{const fd=form();fd.set("hitDie",die);await expect(createCharacter("campaign",fd)).rejects.toThrow();expect(prisma.character.create).not.toHaveBeenCalled();});
it("rejects multiple submitted bonuses",async()=>{const fd=form();fd.append("hitDieAbilityBonus","DEX");await expect(createCharacter("campaign",fd)).rejects.toThrow();});
it("requires campaign access",async()=>{requireCampaign.mockRejectedValueOnce(new Error("Unauthorized"));await expect(createCharacter("campaign",form())).rejects.toThrow("Unauthorized");expect(prisma.character.create).not.toHaveBeenCalled();});

it("accepts d10 without bonus and persists no bonus",async()=>{const fd=form();fd.set("hitDie","d10");fd.delete("hitDieAbilityBonus");await createCharacter("campaign",fd);expect(prisma.character.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({con:13,maxHp:11,hitDie:"d10",hitDieAbilityBonus:null})}));});
it("rejects missing d8 bonus",async()=>{const fd=form();fd.delete("hitDieAbilityBonus");await expect(createCharacter("campaign",fd)).rejects.toThrow();expect(prisma.character.create).not.toHaveBeenCalled();});
it.each(["POINT_BUY","STANDARD_ARRAY","invalid"])("enforces score mode %s on the server",async mode=>{const fd=form();fd.set("mode",mode);fd.set("str","16");await expect(createCharacter("campaign",fd)).rejects.toThrow();expect(prisma.character.create).not.toHaveBeenCalled();});

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
 const fd=form();fd.set("level","2");await expect(createCharacter("campaign",fd)).rejects.toThrow("level 2");
 fd.set("hpRollMode2","MANUAL");fd.set("hpRawRoll2","9");await expect(createCharacter("campaign",fd)).rejects.toThrow();expect(prisma.character.create).not.toHaveBeenCalled();
});
