"use server";
import { redirect } from "next/navigation";
import { Reservoir, RegenRank, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateMaxChakra, calculateMaxHp, getCreationAbilityScores, getEffectiveHpRoll, validateCharacterLevel, validStartingSkills, skills, type AbilityScores } from "@/lib/rules";
import {creationFailureMessage, creationRuleMessage, isStartingJutsuAllowed, jutsuUnavailableMessage, natureUnavailableMessage, type CharacterCreationResult} from "@/lib/character-creation";
import {rollHitDie} from "@/lib/hp-roll";
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
class CreationValidationError extends Error {
 constructor(public code: string, message: string, public field?: string) {super(message);}
}
const creationText = (fd: FormData, key: string, fallback = "") => {
 const values = fd.getAll(key);
 if (values.length > 1 || (values[0] != null && typeof values[0] !== "string")) throw new CreationValidationError("INVALID_FORM", creationFailureMessage, key);
 return values[0] == null ? fallback : String(values[0]);
};
export async function createCharacter(campaignId: string, fd: FormData): Promise<CharacterCreationResult> {
 try {
  try {await requireCampaign(campaignId);} catch (error) {
   if (error instanceof Error && error.message === "Unauthorized") throw new CreationValidationError("ACCESS", "Dein Kampagnenzugang ist abgelaufen. Bitte melde dich erneut an.");
   throw error;
  }
  const keys = ["str", "dex", "con", "int", "wis", "cha"];
  const level = Number(creationText(fd, "level"));
  try {validateCharacterLevel(level);} catch {throw new CreationValidationError("LEVEL", "Die Stufe muss eine ganze Zahl zwischen 1 und 20 sein.", "level");}
  const hitDie = creationText(fd, "hitDie");
  const bonuses = fd.getAll("hitDieAbilityBonus");
  if (bonuses.length > 1) throw new CreationValidationError("ABILITY", "Wähle genau ein Attribut für deinen +1-Talentbonus.", "attributes");
  const hitDieAbilityBonus = bonuses[0] ?? null;
  let scores: AbilityScores;
  try {scores = getCreationAbilityScores(creationText(fd, "mode"), Object.fromEntries(keys.map(key => [key, Number(creationText(fd, key, "NaN"))])) as AbilityScores, hitDie, hitDieAbilityBonus);}
  catch (error) {if (error instanceof CreationValidationError) throw error;throw new CreationValidationError("ABILITY", creationRuleMessage(error), "attributes");}
  const {con, wis} = scores;
  const hpLevels = Array.from({length: level - 1}, (_, index) => {
   const hpLevel = index + 2;
   const mode = creationText(fd, `hpRollMode${hpLevel}`);
   if (mode !== "AUTO" && mode !== "MANUAL") throw new CreationValidationError("HP", `Bitte bestimme den HP-Wurf für Level ${hpLevel}.`, "combat");
   const rawRoll = mode === "AUTO" ? rollHitDie(hitDie) : Number(creationText(fd, `hpRawRoll${hpLevel}`));
   let effectiveRoll: number;
   try {effectiveRoll = getEffectiveHpRoll(hitDie, rawRoll);} catch {throw new CreationValidationError("HP", `Der HP-Wurf für Level ${hpLevel} muss eine ganze Zahl zwischen 1 und ${hitDie === "d8" ? 8 : 10} sein.`, "combat");}
   return {level: hpLevel, hitDie, rawRoll, effectiveRoll};
  });
  const name = creationText(fd, "name").trim();
  if (!name || name.length > 100) throw new CreationValidationError("NAME", "Gib einen Namen mit höchstens 100 Zeichen ein.", "name");
  const reservoir = creationText(fd, "reservoir", "AVERAGE");
  if (!Object.values(Reservoir).some(value => value === reservoir) || reservoir === "SPECIAL") throw new CreationValidationError("CHAKRA", "Wähle ein gültiges Chakra-Reservoir.", "chakra");
  const regenRank = creationText(fd, "regen", "TRAINED"), controlRank = creationText(fd, "control", "TRAINED");
  if (![regenRank, controlRank].every(rank => Object.values(RegenRank).some(value => value === rank))) throw new CreationValidationError("CHAKRA", "Wähle gültige Werte für Chakra-Regeneration und Chakra-Kontrolle.", "chakra");
  const speed = Number(creationText(fd, "speed", "30"));
  if (!Number.isInteger(speed) || speed < 0 || speed > 2147483647) throw new CreationValidationError("SPEED", "Die Bewegung muss eine nicht negative ganze Zahl sein.", "combat");
  const jutsu = fd.getAll("jutsu").map(String), savingThrows = fd.getAll("savingThrow").map(String), startingSkills = fd.getAll("skill").map(String);
  if (!validStartingSkills(startingSkills) || startingSkills.some(skill => !Object.hasOwn(skills, skill))) throw new CreationValidationError("SKILLS", "Wähle höchstens drei unterschiedliche gültige Fertigkeiten.", "skills");
  if (new Set(savingThrows).size !== savingThrows.length || !savingThrows.every(value => keys.some(key => key.toUpperCase() === value))) throw new CreationValidationError("SAVES", "Bitte überprüfe deine Rettungswurf-Auswahl.", "skills");
  if (jutsu.length > 2 || new Set(jutsu).size !== jutsu.length) throw new CreationValidationError("JUTSU", jutsuUnavailableMessage, "jutsu");
  const natureKey = creationText(fd, "nature"), natureId = creationText(fd, "chakraNatureId");
  if (!natureKey && !natureId) throw new CreationValidationError("NATURE", "Wähle eine primäre Chakra-Natur.", "nature");
  const maxHp = calculateMaxHp(level, con, hitDie, hpLevels);
  const max = calculateMaxChakra(level, con, wis, reservoir as Reservoir);
  const background=creationText(fd,"background"),alignment=creationText(fd,"alignment"),description=creationText(fd,"description");
  await prisma.$transaction(async tx => {
   const chakraNature = await tx.chakraNature.findUnique({where: natureId ? {id: natureId} : {key: natureKey}});
   if (!chakraNature?.playerSelectable || (natureKey && chakraNature.key !== natureKey)) throw new CreationValidationError("NATURE", natureUnavailableMessage, "nature");
   const selected = await tx.jutsu.findMany({where: {id: {in: jutsu}, rank: {not: "S"}, OR: [{campaignId: null}, {campaignId}]}, include: {natures: {include: {nature: true}}}});
   if (selected.length !== jutsu.length || selected.some(item => !isStartingJutsuAllowed(item, campaignId, chakraNature.key))) throw new CreationValidationError("JUTSU", jutsuUnavailableMessage, "jutsu");
   const character = await tx.character.create({data: {
    campaignId, name, level, background, alignment, description, speed, ...scores,
    hpLevels: {create: hpLevels}, hitDie, hitDieAbilityBonus: hitDieAbilityBonus as string | null,
    maxHp, currentHp: maxHp, acOverride: null, currentChakra: max, reservoir: reservoir as Reservoir,
    regenRank: regenRank as RegenRank, controlRank: controlRank as RegenRank,
    natureLinks: {create: {chakraNatureId: chakraNature.id, isPrimary: true}}, dmData: {create: {}},
    savingThrows: {create: savingThrows.map(ability => ({ability}))},
    skills: {create: startingSkills.map(skill => ({skill, proficiency: "PROFICIENT"}))},
   }});
   if (jutsu.length) await tx.characterJutsu.createMany({data: jutsu.map(jutsuId => ({characterId: character.id, jutsuId}))});
  });
  return {ok: true, destination: `/campaign/${campaignId}`};
 } catch (error) {
  if (error instanceof CreationValidationError) return {ok: false, code: error.code, message: error.message, field: error.field};
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2025", "P2034"].includes(error.code)) return {ok: false, code: "CONFLICT", message: "Deine Auswahl konnte nicht gespeichert werden. Bitte ?berpr?fe sie und versuche es erneut."};
  console.error("Character creation failed", {campaignId, error});
  return {ok: false, code: "INTERNAL", message: creationFailureMessage};
 }
}
