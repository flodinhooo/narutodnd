"use server";
import { redirect } from "next/navigation";
import { Reservoir } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateMaxChakra, calculateMaxHp, getCreationAbilityScores, type AbilityScores } from "@/lib/rules";
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
  const level = Number(fd.get("level") || 1);
  const hitDie = fd.get("hitDie");
  const bonuses = fd.getAll("hitDieAbilityBonus");
  if (bonuses.length > 1) throw new Error("Choose exactly one ability bonus");
  const hitDieAbilityBonus = bonuses[0] ?? null;
  const scores = getCreationAbilityScores(String(fd.get("mode") || ""), Object.fromEntries(keys.map(key => [key, fd.has(key) ? Number(fd.get(key)) : NaN])) as AbilityScores, hitDie, hitDieAbilityBonus);
  const {con, wis} = scores;
  const nature = String(fd.get("nature")); const reservoir = String(fd.get("reservoir") || "AVERAGE") as keyof typeof Reservoir;
  const max = calculateMaxChakra(level, con, wis, reservoir, Number(fd.get("custom") || 1));
  const jutsu = fd.getAll("jutsu").map(String); const savingThrows = fd.getAll("savingThrow").map(String); const startingSkills = fd.getAll("skill").map(String); const chakraNature = await prisma.chakraNature.findUniqueOrThrow({ where: { key: nature } });
  if(startingSkills.length>3||new Set(startingSkills).size!==startingSkills.length)throw new Error("Choose up to 3 unique starting skills");
  if(!savingThrows.every(x=>keys.map(k=>k.toUpperCase()).includes(x)))throw new Error("Invalid saving throw");
  const name=String(fd.get("name")||"").trim(); if(!name||name.length>100)throw new Error("Character name is required");
  if(!Number.isInteger(level)||level<1||level>20)throw new Error("Level must be between 1 and 20");
  const speed=Number(fd.get("speed")||30), maxHp=calculateMaxHp(level,con,hitDie as "d8"|"d10"); if(!Number.isInteger(speed)||speed<0)throw new Error("Invalid combat values");
  const selected=await prisma.jutsu.findMany({where:{id:{in:jutsu},rank:{not:"S"}},include:{natures:true}}); if(selected.length!==new Set(jutsu).size||jutsu.length>2||selected.some(x=>!x.natures.some(n=>n.chakraNatureId===chakraNature.id)))throw new Error("Invalid starting Jutsu selection");
  await prisma.$transaction(async tx => { const character = await tx.character.create({ data: { campaignId, name, level, background:String(fd.get("background")||""),alignment:String(fd.get("alignment")||""),description:String(fd.get("description")||""),speed,hitDie:String(hitDie),hitDieAbilityBonus:hitDieAbilityBonus as string|null,maxHp,currentHp:maxHp,acOverride:null, currentChakra: max, reservoir, ...scores, natureLinks: { create: { chakraNatureId: chakraNature.id, isPrimary: true } }, dmData: { create: {} }, savingThrows: { create: savingThrows.map(ability => ({ ability })) }, skills: { create: startingSkills.map(skill => ({ skill, proficiency: "PROFICIENT" })) } } }); if (jutsu.length) await tx.characterJutsu.createMany({ data: jutsu.map(jutsuId => ({ characterId: character.id, jutsuId })) }); });
  redirect(`/campaign/${campaignId}`);
}

