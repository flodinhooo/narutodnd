"use server";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {requireCampaign} from "@/lib/session";
import {calculateHpContribution, calculateMaxChakra, getEffectiveHpRoll, getHitDieMinimum, preserveChakra, validateCharacterLevel} from "@/lib/rules";
import {getCharacterHpChange} from "@/lib/character-hp";
import {rollHitDie, signAutoHpRoll, verifyAutoHpRoll} from "@/lib/hp-roll";

export async function previewAutomaticHpRoll(campaignId: string, characterId: string, level: number) {
 const session = await requireCampaign(campaignId, true);
 const c = await prisma.character.findFirst({where: {id: characterId, campaignId}, include: {hpLevels: true}});
 if (!c) throw new Error("Character not found");
 validateCharacterLevel(level);
 if (level !== c.level + 1) throw new Error("Confirm one level at a time");
 if (level <= (c.hpLegacyLevel ?? 1) || c.hpLevels.some(roll => roll.level === level)) throw new Error("This level already has HP history; reuse it");
 const rawRoll = rollHitDie(c.hitDie);
 return {
  rawRoll, effectiveRoll: getEffectiveHpRoll(c.hitDie, rawRoll), minimum: getHitDieMinimum(c.hitDie),
  hpIncrease: calculateHpContribution(c.hitDie, rawRoll, c.con),
  token: signAutoHpRoll({campaignId, characterId, level, hitDie: c.hitDie, rawRoll}, session.id),
 };
}

export async function confirmHpLevelUp(campaignId: string, characterId: string, fd: FormData) {
 const session = await requireCampaign(campaignId, true);
 const requestedLevel = Number(fd.get("level"));
 validateCharacterLevel(requestedLevel);
 const outcome = await prisma.$transaction(async tx => {
  const c = await tx.character.findFirst({where: {id: characterId, campaignId}, include: {hpLevels: true}});
  if (!c) throw new Error("Character not found");
  if (requestedLevel !== c.level + 1) throw new Error("Confirm one level at a time; this level may already be confirmed");
  let roll = c.hpLevels.find(item => item.level === requestedLevel);
  const usesLegacy = requestedLevel <= (c.hpLegacyLevel ?? 1);
  if (!roll && !usesLegacy) {
   const mode = fd.get("mode");
   if (mode !== "AUTO" && mode !== "MANUAL") throw new Error("Choose automatic or manual roll");
   const rawRoll = mode === "AUTO"
    ? verifyAutoHpRoll(String(fd.get("token") ?? ""), {campaignId, characterId, level: requestedLevel, hitDie: c.hitDie}, session.id)
    : Number(fd.get("rawRoll"));
   const effectiveRoll = getEffectiveHpRoll(c.hitDie, rawRoll);
   roll = await tx.characterHpLevel.create({data: {characterId, level: requestedLevel, hitDie: c.hitDie, rawRoll, effectiveRoll}});
  }
  const hpLevels = roll && !c.hpLevels.some(item => item.level === requestedLevel) ? [...c.hpLevels, roll] : c.hpLevels;
  const hp = getCharacterHpChange(c, {level: requestedLevel, con: c.con, hpLevels});
  const oldChakra = calculateMaxChakra(c.level, c.con, c.wis, c.reservoir, c.customReservoirMultiplier ?? 1);
  const nextChakra = calculateMaxChakra(requestedLevel, c.con, c.wis, c.reservoir, c.customReservoirMultiplier ?? 1);
  const result = await tx.character.updateMany({
   where: {id: c.id, campaignId, level: c.level, con: c.con, maxHp: c.maxHp, currentHp: c.currentHp, updatedAt: c.updatedAt},
   data: {level: requestedLevel, ...hp, currentChakra: preserveChakra(c.currentChakra, oldChakra, nextChakra)},
  });
  if (result.count !== 1) throw new Error("Character changed; reload before confirming");
  return {level: requestedLevel, maxHp: hp.maxHp, currentHp: hp.currentHp};
 });
 revalidatePath(`/campaign/${campaignId}/characters/${characterId}`);
 return outcome;
}
