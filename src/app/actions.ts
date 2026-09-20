"use server";
import { redirect } from "next/navigation";
import { Reservoir } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateMaxChakra, pointBuyTotal, validStandardArray } from "@/lib/rules";
import { accessCodeLookup, hashCode, makeCode, requireCampaign, resolveCampaignAccess, setCreationHandoff, setSession } from "@/lib/session";

export async function createCampaign(fd: FormData) {
  const name = String(fd.get("name") || "").trim();
  if (!name) throw new Error("Campaign name is required");
  const dm = makeCode("DM"); const player = makeCode("P");
  const campaign = await prisma.campaign.create({ data: { name, description: String(fd.get("description") || ""), dmCodeHash: hashCode(dm), playerCodeHash: hashCode(player), dmCodeLookup: accessCodeLookup(dm), playerCodeLookup: accessCodeLookup(player) } });
  await setCreationHandoff(campaign.id,dm,player); redirect(`/campaign/${campaign.id}/access`);
}
export async function continueAsDm(campaignId:string){const handoff=await import("@/lib/session").then(x=>x.getCreationHandoff());if(!handoff||handoff.campaignId!==campaignId)throw new Error("Creation credentials expired");const campaign=await prisma.campaign.findUniqueOrThrow({where:{id:campaignId}});if(hashCode(handoff.dmCode)!==campaign.dmCodeHash)throw new Error("Creation credentials invalid");await setSession(campaignId,"DM");redirect(`/campaign/${campaignId}`);}
export async function enterCampaign(fd: FormData) {
  const code = String(fd.get("code") || "").trim();
  if (!code) throw new Error("Ungültiger Zugangscode.");
  const lookup = accessCodeLookup(code);
  const campaign = await prisma.campaign.findFirst({ where: { OR: [{ dmCodeLookup: lookup }, { playerCodeLookup: lookup }] } });
  const role = campaign ? resolveCampaignAccess(code, campaign) : null;
  if (!campaign || !role) throw new Error("Ungültiger Zugangscode.");
  await setSession(campaign.id, role); redirect(`/campaign/${campaign.id}`);
}
export async function createCharacter(campaignId: string, fd: FormData) {
  await requireCampaign(campaignId);
  const keys = ["str", "dex", "con", "int", "wis", "cha"];
  const level = Number(fd.get("level") || 1); const con = Number(fd.get("con") || 10); const wis = Number(fd.get("wis") || 10);
  const mode=String(fd.get("mode")||"MANUAL"); const abilityScores=keys.map(key=>Number(fd.get(key)||10));
  if(mode==="STANDARD ARRAY"&&!validStandardArray(abilityScores))throw new Error("Standard Array must use 15, 14, 13, 12, 10, and 8 exactly once");
  if(mode==="POINT BUY"&&(abilityScores.some(score=>score<8||score>15)||pointBuyTotal(abilityScores)>27))throw new Error("Point Buy scores must cost no more than 27 points and stay between 8 and 15");
  const nature = String(fd.get("nature")); const reservoir = String(fd.get("reservoir") || "AVERAGE") as keyof typeof Reservoir;
  const max = calculateMaxChakra(level, con, wis, reservoir, Number(fd.get("custom") || 1));
  const jutsu = fd.getAll("jutsu").map(String); const savingThrows = fd.getAll("savingThrow").map(String); const startingSkills = fd.getAll("skill").map(String); const chakraNature = await prisma.chakraNature.findUniqueOrThrow({ where: { key: nature } });
  if(startingSkills.length>3)throw new Error("Choose up to 3 starting skills");
  const maxHp=Number(fd.get("maxHp")||10); await prisma.$transaction(async tx => { const character = await tx.character.create({ data: { campaignId, name: String(fd.get("name")), level, background:String(fd.get("background")||""),alignment:String(fd.get("alignment")||""),description:String(fd.get("description")||""),speed:Number(fd.get("speed")||30),maxHp,currentHp:maxHp,acOverride:fd.get("acOverride")?Number(fd.get("acOverride")):null, currentChakra: maxHp?max: max, reservoir, ...Object.fromEntries(keys.map(key => [key, Number(fd.get(key) || 10)])), natureLinks: { create: { chakraNatureId: chakraNature.id, isPrimary: true } }, dmData: { create: {} }, savingThrows: { create: savingThrows.map(ability => ({ ability })) }, skills: { create: startingSkills.map(skill => ({ skill, proficiency: "PROFICIENT" })) } } }); if (jutsu.length) await tx.characterJutsu.createMany({ data: jutsu.map(jutsuId => ({ characterId: character.id, jutsuId })) }); });
  redirect(`/campaign/${campaignId}`);
}

