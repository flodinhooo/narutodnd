-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Reservoir" AS ENUM ('VERY_LOW', 'LOW', 'AVERAGE', 'HIGH', 'VERY_HIGH', 'EXCEPTIONAL', 'MONSTER', 'SPECIAL');

-- CreateEnum
CREATE TYPE "public"."RegenRank" AS ENUM ('NOVICE', 'TRAINED', 'ADVANCED', 'EXPERT', 'MASTER');

-- CreateEnum
CREATE TYPE "public"."SkillProficiency" AS ENUM ('NONE', 'PROFICIENT', 'EXPERTISE');

-- CreateEnum
CREATE TYPE "public"."JutsuRank" AS ENUM ('E', 'D', 'C', 'B', 'A', 'S');

-- CreateEnum
CREATE TYPE "public"."JutsuLibraryAccess" AS ENUM ('CLOSED', 'OPEN');

-- CreateEnum
CREATE TYPE "public"."JutsuOrigin" AS ENUM ('CANON', 'SHIO_HOMEBREW', 'FOUNDATION', 'DM_CUSTOM');

-- CreateEnum
CREATE TYPE "public"."JutsuPool" AS ENUM ('ELEMENTAL', 'CANON', 'FOUNDATION', 'UZUMAKI', 'CHARACTER_SIGNATURE');

-- CreateEnum
CREATE TYPE "public"."GameSessionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('COUNTRY', 'CITY', 'VILLAGE', 'DISTRICT', 'BUILDING', 'LANDMARK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."EnemyCategory" AS ENUM ('ANIMAL', 'HUMANOID', 'SHINOBI', 'MISSING_NIN', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."EnemyDifficulty" AS ENUM ('TRIVIAL', 'EASY', 'MODERATE', 'HARD', 'DEADLY', 'ELITE');

-- CreateEnum
CREATE TYPE "public"."EnemyNinjaRank" AS ENUM ('ACADEMY', 'GENIN', 'CHUNIN', 'JONIN', 'KAGE');

-- CreateEnum
CREATE TYPE "public"."EncounterType" AS ENUM ('COMBAT', 'SOCIAL', 'EXPLORATION', 'CHASE', 'MIXED');

-- CreateEnum
CREATE TYPE "public"."EncounterStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."EncounterRunStatus" AS ENUM ('PREPARING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."EncounterSide" AS ENUM ('ALLY', 'HOSTILE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "public"."MissionRank" AS ENUM ('D', 'C', 'B', 'A', 'S');

-- CreateEnum
CREATE TYPE "public"."MissionStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ObjectiveStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."ConsequenceKind" AS ENUM ('NPC_ATTITUDE', 'ORGANIZATION_ATTITUDE', 'UNLOCK_MISSION', 'REVEAL_INFORMATION', 'UNLOCK_OBJECTIVE');

-- CreateEnum
CREATE TYPE "public"."AtlasMapType" AS ENUM ('WORLD', 'REGION', 'ISLAND', 'CITY', 'VILLAGE', 'DISTRICT', 'BUILDING', 'DUNGEON', 'CUSTOM');

-- CreateTable
CREATE TABLE "public"."Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dmCodeHash" TEXT NOT NULL,
    "playerCodeHash" TEXT NOT NULL,
    "dmCodeLookup" TEXT,
    "playerCodeLookup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jutsuLibraryAccess" "public"."JutsuLibraryAccess" NOT NULL DEFAULT 'CLOSED',

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChakraNature" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "playerSelectable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChakraNature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Character" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "portraitOwnerKey" TEXT,
    "portraitUrl" TEXT,
    "background" TEXT NOT NULL DEFAULT '',
    "alignment" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "combatProfile" JSONB,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "maxHp" INTEGER NOT NULL DEFAULT 10,
    "currentHp" INTEGER NOT NULL DEFAULT 10,
    "hitDie" TEXT NOT NULL DEFAULT 'd10',
    "hitDieAbilityBonus" TEXT,
    "hpLegacyLevel" INTEGER,
    "hpLegacyBase" INTEGER,
    "hpOverrideOffset" INTEGER,
    "acOverride" INTEGER,
    "initiativeOverride" INTEGER,
    "str" INTEGER NOT NULL DEFAULT 10,
    "dex" INTEGER NOT NULL DEFAULT 10,
    "con" INTEGER NOT NULL DEFAULT 10,
    "int" INTEGER NOT NULL DEFAULT 10,
    "wis" INTEGER NOT NULL DEFAULT 10,
    "cha" INTEGER NOT NULL DEFAULT 10,
    "currentChakra" INTEGER NOT NULL DEFAULT 0,
    "reservoir" "public"."Reservoir" NOT NULL DEFAULT 'AVERAGE',
    "customReservoirMultiplier" DOUBLE PRECISION,
    "regenRank" "public"."RegenRank" NOT NULL DEFAULT 'TRAINED',
    "controlRank" "public"."RegenRank" NOT NULL DEFAULT 'TRAINED',
    "breakthroughPoints" INTEGER NOT NULL DEFAULT 0,
    "shortRestsSinceLongRest" INTEGER NOT NULL DEFAULT 0,
    "limitBreakUsed" BOOLEAN NOT NULL DEFAULT false,
    "deathSaveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "deathSaveFailures" INTEGER NOT NULL DEFAULT 0,
    "severelyWounded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CharacterHpLevel" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "hitDie" TEXT NOT NULL,
    "rawRoll" INTEGER NOT NULL,
    "effectiveRoll" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterHpLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CharacterChakraNature" (
    "characterId" TEXT NOT NULL,
    "chakraNatureId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAtLevel" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'CHARACTER_CREATION',

    CONSTRAINT "CharacterChakraNature_pkey" PRIMARY KEY ("characterId","chakraNatureId")
);

-- CreateTable
CREATE TABLE "public"."Jutsu" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "germanName" TEXT,
    "japaneseName" TEXT,
    "description" TEXT NOT NULL,
    "rank" "public"."JutsuRank" NOT NULL,
    "chakraCost" INTEGER NOT NULL,
    "range" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "attackType" TEXT,
    "damageDice" TEXT,
    "damageType" TEXT,
    "saveAbility" TEXT,
    "requiresConcentration" BOOLEAN NOT NULL DEFAULT false,
    "origin" "public"."JutsuOrigin" NOT NULL DEFAULT 'SHIO_HOMEBREW',
    "pool" "public"."JutsuPool" NOT NULL DEFAULT 'ELEMENTAL',
    "campaignId" TEXT,
    "category" TEXT,
    "dmOnly" BOOLEAN NOT NULL DEFAULT false,
    "progressionType" TEXT,
    "traditionProvenance" TEXT,
    "prerequisiteText" TEXT,
    "requiredNatureKeys" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jutsu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JutsuPrerequisite" (
    "jutsuId" TEXT NOT NULL,
    "prerequisiteJutsuId" TEXT NOT NULL,

    CONSTRAINT "JutsuPrerequisite_pkey" PRIMARY KEY ("jutsuId","prerequisiteJutsuId")
);

-- CreateTable
CREATE TABLE "public"."JutsuChakraNature" (
    "jutsuId" TEXT NOT NULL,
    "chakraNatureId" TEXT NOT NULL,

    CONSTRAINT "JutsuChakraNature_pkey" PRIMARY KEY ("jutsuId","chakraNatureId")
);

-- CreateTable
CREATE TABLE "public"."CharacterJutsu" (
    "characterId" TEXT NOT NULL,
    "jutsuId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CHARACTER_CREATION',
    "learnedAtLevel" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "CharacterJutsu_pkey" PRIMARY KEY ("characterId","jutsuId")
);

-- CreateTable
CREATE TABLE "public"."SkillProficiencyRecord" (
    "characterId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "proficiency" "public"."SkillProficiency" NOT NULL,

    CONSTRAINT "SkillProficiencyRecord_pkey" PRIMARY KEY ("characterId","skill")
);

-- CreateTable
CREATE TABLE "public"."SavingThrowProficiency" (
    "characterId" TEXT NOT NULL,
    "ability" TEXT NOT NULL,

    CONSTRAINT "SavingThrowProficiency_pkey" PRIMARY KEY ("characterId","ability")
);

-- CreateTable
CREATE TABLE "public"."CharacterDMData" (
    "characterId" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "secretInformation" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterDMData_pkey" PRIMARY KEY ("characterId")
);

-- CreateTable
CREATE TABLE "public"."CampaignAccessSession" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameSession" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "playerNotes" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "status" "public"."GameSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Location" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."LocationType" NOT NULL DEFAULT 'OTHER',
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "playerVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Npc" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CIVILIAN',
    "attitude" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "age" INTEGER,
    "gender" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "background" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "occupation" TEXT NOT NULL DEFAULT '',
    "residence" TEXT NOT NULL DEFAULT '',
    "affiliation" TEXT NOT NULL DEFAULT '',
    "ninjaRank" TEXT NOT NULL DEFAULT '',
    "village" TEXT NOT NULL DEFAULT '',
    "clan" TEXT NOT NULL DEFAULT '',
    "portraitUrl" TEXT NOT NULL DEFAULT '',
    "publicNotes" TEXT NOT NULL DEFAULT '',
    "dmSecrets" TEXT NOT NULL DEFAULT '',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Npc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "dmSecrets" TEXT NOT NULL DEFAULT '',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attitude" TEXT NOT NULL DEFAULT 'NEUTRAL',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "npcId" TEXT,
    "characterId" TEXT,
    "role" TEXT NOT NULL DEFAULT '',
    "isLeader" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CharacterRelationship" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sourceNpcId" TEXT,
    "targetNpcId" TEXT,
    "sourceCharacterId" TEXT,
    "targetCharacterId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dmSecrets" TEXT NOT NULL DEFAULT '',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CharacterRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EnemyTemplate" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "seedKey" TEXT,
    "sourceTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" "public"."EnemyCategory" NOT NULL,
    "difficulty" "public"."EnemyDifficulty" NOT NULL,
    "ninjaRank" "public"."EnemyNinjaRank",
    "level" INTEGER NOT NULL DEFAULT 1,
    "recommendedLevelMin" INTEGER NOT NULL DEFAULT 1,
    "recommendedLevelMax" INTEGER NOT NULL DEFAULT 1,
    "maxHp" INTEGER NOT NULL,
    "acOverride" INTEGER,
    "initiativeOverride" INTEGER,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "str" INTEGER NOT NULL DEFAULT 10,
    "dex" INTEGER NOT NULL DEFAULT 10,
    "con" INTEGER NOT NULL DEFAULT 10,
    "int" INTEGER NOT NULL DEFAULT 10,
    "wis" INTEGER NOT NULL DEFAULT 10,
    "cha" INTEGER NOT NULL DEFAULT 10,
    "hasChakra" BOOLEAN NOT NULL DEFAULT false,
    "reservoir" "public"."Reservoir" NOT NULL DEFAULT 'AVERAGE',
    "customReservoirMultiplier" DOUBLE PRECISION,
    "maxChakraOverride" INTEGER,
    "controlRank" "public"."RegenRank" NOT NULL DEFAULT 'TRAINED',
    "regenRank" "public"."RegenRank" NOT NULL DEFAULT 'TRAINED',
    "attacks" JSONB NOT NULL DEFAULT '[]',
    "abilities" JSONB NOT NULL DEFAULT '[]',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "savingThrows" JSONB NOT NULL DEFAULT '[]',
    "resistances" TEXT NOT NULL DEFAULT '',
    "tactics" TEXT NOT NULL DEFAULT '',
    "rewards" TEXT NOT NULL DEFAULT '',
    "experience" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnemyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EnemyTemplateNature" (
    "templateId" TEXT NOT NULL,
    "chakraNatureId" TEXT NOT NULL,

    CONSTRAINT "EnemyTemplateNature_pkey" PRIMARY KEY ("templateId","chakraNatureId")
);

-- CreateTable
CREATE TABLE "public"."EnemyTemplateJutsu" (
    "templateId" TEXT NOT NULL,
    "jutsuId" TEXT NOT NULL,

    CONSTRAINT "EnemyTemplateJutsu_pkey" PRIMARY KEY ("templateId","jutsuId")
);

-- CreateTable
CREATE TABLE "public"."Encounter" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "public"."EncounterType" NOT NULL DEFAULT 'COMBAT',
    "difficulty" "public"."EnemyDifficulty" NOT NULL DEFAULT 'MODERATE',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "status" "public"."EncounterStatus" NOT NULL DEFAULT 'DRAFT',
    "events" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EncounterParticipantPlan" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "enemyTemplateId" TEXT,
    "characterId" TEXT,
    "npcId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "side" "public"."EncounterSide" NOT NULL DEFAULT 'HOSTILE',
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncounterParticipantPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EncounterRun" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "startRequestId" TEXT NOT NULL,
    "startHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "public"."EncounterType" NOT NULL,
    "difficulty" "public"."EnemyDifficulty" NOT NULL,
    "locationName" TEXT NOT NULL DEFAULT '',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "events" JSONB NOT NULL DEFAULT '[]',
    "status" "public"."EncounterRunStatus" NOT NULL DEFAULT 'PREPARING',
    "round" INTEGER NOT NULL DEFAULT 0,
    "activeParticipantId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "EncounterRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EncounterRunParticipant" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourcePlanId" TEXT,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "side" "public"."EncounterSide" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "maxHp" INTEGER,
    "currentHp" INTEGER,
    "maxChakra" INTEGER,
    "currentChakra" INTEGER,
    "ac" INTEGER,
    "initiativeBonus" INTEGER NOT NULL DEFAULT 0,
    "initiative" INTEGER,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "defeated" BOOLEAN NOT NULL DEFAULT false,
    "unconscious" BOOLEAN NOT NULL DEFAULT false,
    "severelyWounded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "EncounterRunParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EncounterRunAction" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "appliedVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncounterRunAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mission" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "clientNpcId" TEXT,
    "locationId" TEXT,
    "title" TEXT NOT NULL,
    "rank" "public"."MissionRank" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "publicInformation" TEXT NOT NULL DEFAULT '',
    "rewards" TEXT NOT NULL DEFAULT '',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "status" "public"."MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionObjective" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "status" "public"."ObjectiveStatus" NOT NULL DEFAULT 'PENDING',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MissionObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionObjectiveDependency" (
    "objectiveId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    CONSTRAINT "MissionObjectiveDependency_pkey" PRIMARY KEY ("objectiveId","prerequisiteId")
);

-- CreateTable
CREATE TABLE "public"."MissionNpc" (
    "missionId" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,

    CONSTRAINT "MissionNpc_pkey" PRIMARY KEY ("missionId","npcId")
);

-- CreateTable
CREATE TABLE "public"."MissionEncounter" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MissionEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionEncounterRun" (
    "missionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "missionEncounterId" TEXT,

    CONSTRAINT "MissionEncounterRun_pkey" PRIMARY KEY ("missionId","runId")
);

-- CreateTable
CREATE TABLE "public"."SessionMission" (
    "sessionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,

    CONSTRAINT "SessionMission_pkey" PRIMARY KEY ("sessionId","missionId")
);

-- CreateTable
CREATE TABLE "public"."SessionEncounterRun" (
    "sessionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,

    CONSTRAINT "SessionEncounterRun_pkey" PRIMARY KEY ("sessionId","runId")
);

-- CreateTable
CREATE TABLE "public"."MissionConsequence" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "public"."ConsequenceKind" NOT NULL,
    "npcId" TEXT,
    "organizationId" TEXT,
    "targetMissionId" TEXT,
    "objectiveId" TEXT,
    "value" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MissionConsequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionConsequenceApplication" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "consequenceId" TEXT NOT NULL,
    "actorSessionId" TEXT NOT NULL,
    "kind" "public"."ConsequenceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionConsequenceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionAction" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionTemplate" (
    "id" TEXT NOT NULL,
    "seedKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rank" "public"."MissionRank" NOT NULL,
    "summary" TEXT NOT NULL,
    "blueprint" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Portrait" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT,
    "npcId" TEXT,
    "enemyTemplateId" TEXT,
    "label" TEXT NOT NULL DEFAULT 'Standard',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorldMap" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "public"."AtlasMapType" NOT NULL DEFAULT 'CUSTOM',
    "parentId" TEXT,
    "locationId" TEXT,
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "seedKey" TEXT,
    "imageKey" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "imageBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MapMarker" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "icon" TEXT NOT NULL DEFAULT 'pin',
    "color" TEXT NOT NULL DEFAULT '#d7ae68',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "childMapId" TEXT,
    "seedKey" TEXT,

    CONSTRAINT "MapMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AtlasWorldTemplate" (
    "seedKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "blueprint" JSONB NOT NULL,

    CONSTRAINT "AtlasWorldTemplate_pkey" PRIMARY KEY ("seedKey")
);

-- CreateTable
CREATE TABLE "public"."AtlasImport" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "seedKey" TEXT NOT NULL,
    "rootMapId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtlasImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AtlasLocationSeed" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "seedKey" TEXT NOT NULL,
    "locationId" TEXT,

    CONSTRAINT "AtlasLocationSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AtlasChange" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "mapId" TEXT,

    CONSTRAINT "AtlasChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_dmCodeHash_key" ON "public"."Campaign"("dmCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_playerCodeHash_key" ON "public"."Campaign"("playerCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_dmCodeLookup_key" ON "public"."Campaign"("dmCodeLookup");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_playerCodeLookup_key" ON "public"."Campaign"("playerCodeLookup");

-- CreateIndex
CREATE UNIQUE INDEX "ChakraNature_key_key" ON "public"."ChakraNature"("key");

-- CreateIndex
CREATE INDEX "Character_campaignId_idx" ON "public"."Character"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterHpLevel_characterId_level_key" ON "public"."CharacterHpLevel"("characterId", "level");

-- CreateIndex
CREATE INDEX "Jutsu_origin_pool_idx" ON "public"."Jutsu"("origin", "pool");

-- CreateIndex
CREATE INDEX "Jutsu_campaignId_idx" ON "public"."Jutsu"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Jutsu_campaignId_slug_key" ON "public"."Jutsu"("campaignId", "slug");

-- CreateIndex
CREATE INDEX "CampaignAccessSession_campaignId_idx" ON "public"."CampaignAccessSession"("campaignId");

-- CreateIndex
CREATE INDEX "GameSession_campaignId_status_idx" ON "public"."GameSession"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_campaignId_number_key" ON "public"."GameSession"("campaignId", "number");

-- CreateIndex
CREATE INDEX "Location_campaignId_playerVisible_idx" ON "public"."Location"("campaignId", "playerVisible");

-- CreateIndex
CREATE UNIQUE INDEX "Location_campaignId_slug_key" ON "public"."Location"("campaignId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Npc_characterId_key" ON "public"."Npc"("characterId");

-- CreateIndex
CREATE INDEX "Npc_campaignId_playerVisible_archived_idx" ON "public"."Npc"("campaignId", "playerVisible", "archived");

-- CreateIndex
CREATE INDEX "Organization_campaignId_playerVisible_archived_idx" ON "public"."Organization"("campaignId", "playerVisible", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_npcId_key" ON "public"."OrganizationMember"("organizationId", "npcId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_characterId_key" ON "public"."OrganizationMember"("organizationId", "characterId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_campaignId_playerVisible_idx" ON "public"."CharacterRelationship"("campaignId", "playerVisible");

-- CreateIndex
CREATE UNIQUE INDEX "EnemyTemplate_seedKey_key" ON "public"."EnemyTemplate"("seedKey");

-- CreateIndex
CREATE INDEX "EnemyTemplate_campaignId_archived_category_difficulty_idx" ON "public"."EnemyTemplate"("campaignId", "archived", "category", "difficulty");

-- CreateIndex
CREATE INDEX "Encounter_campaignId_status_idx" ON "public"."Encounter"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EncounterParticipantPlan_encounterId_idx" ON "public"."EncounterParticipantPlan"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterRun_campaignId_status_idx" ON "public"."EncounterRun"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterRun_campaignId_startRequestId_key" ON "public"."EncounterRun"("campaignId", "startRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterRunParticipant_runId_ordinal_key" ON "public"."EncounterRunParticipant"("runId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterRunAction_runId_requestId_key" ON "public"."EncounterRunAction"("runId", "requestId");

-- CreateIndex
CREATE INDEX "Mission_campaignId_status_playerVisible_archived_idx" ON "public"."Mission"("campaignId", "status", "playerVisible", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_campaignId_sourceTemplateId_key" ON "public"."Mission"("campaignId", "sourceTemplateId");

-- CreateIndex
CREATE INDEX "MissionObjective_missionId_position_idx" ON "public"."MissionObjective"("missionId", "position");

-- CreateIndex
CREATE INDEX "MissionEncounter_missionId_position_idx" ON "public"."MissionEncounter"("missionId", "position");

-- CreateIndex
CREATE INDEX "MissionConsequence_missionId_idx" ON "public"."MissionConsequence"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionConsequenceApplication_consequenceId_key" ON "public"."MissionConsequenceApplication"("consequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionAction_missionId_requestId_key" ON "public"."MissionAction"("missionId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionTemplate_seedKey_key" ON "public"."MissionTemplate"("seedKey");

-- CreateIndex
CREATE UNIQUE INDEX "Portrait_storageKey_key" ON "public"."Portrait"("storageKey");

-- CreateIndex
CREATE INDEX "Portrait_campaignId_idx" ON "public"."Portrait"("campaignId");

-- CreateIndex
CREATE INDEX "Portrait_characterId_isDefault_idx" ON "public"."Portrait"("characterId", "isDefault");

-- CreateIndex
CREATE INDEX "Portrait_npcId_isDefault_idx" ON "public"."Portrait"("npcId", "isDefault");

-- CreateIndex
CREATE INDEX "Portrait_enemyTemplateId_isDefault_idx" ON "public"."Portrait"("enemyTemplateId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "WorldMap_imageKey_key" ON "public"."WorldMap"("imageKey");

-- CreateIndex
CREATE INDEX "WorldMap_campaignId_parentId_idx" ON "public"."WorldMap"("campaignId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldMap_campaignId_seedKey_key" ON "public"."WorldMap"("campaignId", "seedKey");

-- CreateIndex
CREATE INDEX "MapMarker_mapId_idx" ON "public"."MapMarker"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "MapMarker_mapId_seedKey_key" ON "public"."MapMarker"("mapId", "seedKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasImport_campaignId_seedKey_key" ON "public"."AtlasImport"("campaignId", "seedKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasLocationSeed_campaignId_seedKey_key" ON "public"."AtlasLocationSeed"("campaignId", "seedKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasChange_campaignId_requestId_key" ON "public"."AtlasChange"("campaignId", "requestId");

-- AddForeignKey
ALTER TABLE "public"."Character" ADD CONSTRAINT "Character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterHpLevel" ADD CONSTRAINT "CharacterHpLevel_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterChakraNature" ADD CONSTRAINT "CharacterChakraNature_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterChakraNature" ADD CONSTRAINT "CharacterChakraNature_chakraNatureId_fkey" FOREIGN KEY ("chakraNatureId") REFERENCES "public"."ChakraNature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Jutsu" ADD CONSTRAINT "Jutsu_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JutsuPrerequisite" ADD CONSTRAINT "JutsuPrerequisite_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "public"."Jutsu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JutsuPrerequisite" ADD CONSTRAINT "JutsuPrerequisite_prerequisiteJutsuId_fkey" FOREIGN KEY ("prerequisiteJutsuId") REFERENCES "public"."Jutsu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JutsuChakraNature" ADD CONSTRAINT "JutsuChakraNature_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "public"."Jutsu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JutsuChakraNature" ADD CONSTRAINT "JutsuChakraNature_chakraNatureId_fkey" FOREIGN KEY ("chakraNatureId") REFERENCES "public"."ChakraNature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterJutsu" ADD CONSTRAINT "CharacterJutsu_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterJutsu" ADD CONSTRAINT "CharacterJutsu_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "public"."Jutsu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SkillProficiencyRecord" ADD CONSTRAINT "SkillProficiencyRecord_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavingThrowProficiency" ADD CONSTRAINT "SavingThrowProficiency_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterDMData" ADD CONSTRAINT "CharacterDMData_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignAccessSession" ADD CONSTRAINT "CampaignAccessSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameSession" ADD CONSTRAINT "GameSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Location" ADD CONSTRAINT "Location_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Npc" ADD CONSTRAINT "Npc_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Npc" ADD CONSTRAINT "Npc_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Npc" ADD CONSTRAINT "Npc_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMember" ADD CONSTRAINT "OrganizationMember_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "public"."Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMember" ADD CONSTRAINT "OrganizationMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_sourceNpcId_fkey" FOREIGN KEY ("sourceNpcId") REFERENCES "public"."Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_targetNpcId_fkey" FOREIGN KEY ("targetNpcId") REFERENCES "public"."Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_sourceCharacterId_fkey" FOREIGN KEY ("sourceCharacterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_targetCharacterId_fkey" FOREIGN KEY ("targetCharacterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnemyTemplate" ADD CONSTRAINT "EnemyTemplate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnemyTemplate" ADD CONSTRAINT "EnemyTemplate_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "public"."EnemyTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnemyTemplateNature" ADD CONSTRAINT "EnemyTemplateNature_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."EnemyTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnemyTemplateNature" ADD CONSTRAINT "EnemyTemplateNature_chakraNatureId_fkey" FOREIGN KEY ("chakraNatureId") REFERENCES "public"."ChakraNature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnemyTemplateJutsu" ADD CONSTRAINT "EnemyTemplateJutsu_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."EnemyTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnemyTemplateJutsu" ADD CONSTRAINT "EnemyTemplateJutsu_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "public"."Jutsu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Encounter" ADD CONSTRAINT "Encounter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Encounter" ADD CONSTRAINT "Encounter_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterParticipantPlan" ADD CONSTRAINT "EncounterParticipantPlan_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "public"."Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterParticipantPlan" ADD CONSTRAINT "EncounterParticipantPlan_enemyTemplateId_fkey" FOREIGN KEY ("enemyTemplateId") REFERENCES "public"."EnemyTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterParticipantPlan" ADD CONSTRAINT "EncounterParticipantPlan_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterParticipantPlan" ADD CONSTRAINT "EncounterParticipantPlan_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "public"."Npc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterRun" ADD CONSTRAINT "EncounterRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterRun" ADD CONSTRAINT "EncounterRun_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "public"."Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterRun" ADD CONSTRAINT "EncounterRun_activeParticipantId_fkey" FOREIGN KEY ("activeParticipantId") REFERENCES "public"."EncounterRunParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterRunParticipant" ADD CONSTRAINT "EncounterRunParticipant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."EncounterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterRunParticipant" ADD CONSTRAINT "EncounterRunParticipant_sourcePlanId_fkey" FOREIGN KEY ("sourcePlanId") REFERENCES "public"."EncounterParticipantPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterRunAction" ADD CONSTRAINT "EncounterRunAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."EncounterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mission" ADD CONSTRAINT "Mission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mission" ADD CONSTRAINT "Mission_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "public"."MissionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mission" ADD CONSTRAINT "Mission_clientNpcId_fkey" FOREIGN KEY ("clientNpcId") REFERENCES "public"."Npc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mission" ADD CONSTRAINT "Mission_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionObjective" ADD CONSTRAINT "MissionObjective_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionObjectiveDependency" ADD CONSTRAINT "MissionObjectiveDependency_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "public"."MissionObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionObjectiveDependency" ADD CONSTRAINT "MissionObjectiveDependency_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "public"."MissionObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionNpc" ADD CONSTRAINT "MissionNpc_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionNpc" ADD CONSTRAINT "MissionNpc_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "public"."Npc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionEncounter" ADD CONSTRAINT "MissionEncounter_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionEncounter" ADD CONSTRAINT "MissionEncounter_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "public"."Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionEncounterRun" ADD CONSTRAINT "MissionEncounterRun_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionEncounterRun" ADD CONSTRAINT "MissionEncounterRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."EncounterRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionEncounterRun" ADD CONSTRAINT "MissionEncounterRun_missionEncounterId_fkey" FOREIGN KEY ("missionEncounterId") REFERENCES "public"."MissionEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionMission" ADD CONSTRAINT "SessionMission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionMission" ADD CONSTRAINT "SessionMission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionEncounterRun" ADD CONSTRAINT "SessionEncounterRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionEncounterRun" ADD CONSTRAINT "SessionEncounterRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."EncounterRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionConsequence" ADD CONSTRAINT "MissionConsequence_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionConsequence" ADD CONSTRAINT "MissionConsequence_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "public"."Npc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionConsequence" ADD CONSTRAINT "MissionConsequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionConsequence" ADD CONSTRAINT "MissionConsequence_targetMissionId_fkey" FOREIGN KEY ("targetMissionId") REFERENCES "public"."Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionConsequence" ADD CONSTRAINT "MissionConsequence_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "public"."MissionObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionConsequenceApplication" ADD CONSTRAINT "MissionConsequenceApplication_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionConsequenceApplication" ADD CONSTRAINT "MissionConsequenceApplication_consequenceId_fkey" FOREIGN KEY ("consequenceId") REFERENCES "public"."MissionConsequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionAction" ADD CONSTRAINT "MissionAction_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Portrait" ADD CONSTRAINT "Portrait_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Portrait" ADD CONSTRAINT "Portrait_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Portrait" ADD CONSTRAINT "Portrait_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "public"."Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Portrait" ADD CONSTRAINT "Portrait_enemyTemplateId_fkey" FOREIGN KEY ("enemyTemplateId") REFERENCES "public"."EnemyTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorldMap" ADD CONSTRAINT "WorldMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorldMap" ADD CONSTRAINT "WorldMap_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."WorldMap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorldMap" ADD CONSTRAINT "WorldMap_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MapMarker" ADD CONSTRAINT "MapMarker_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "public"."WorldMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MapMarker" ADD CONSTRAINT "MapMarker_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MapMarker" ADD CONSTRAINT "MapMarker_childMapId_fkey" FOREIGN KEY ("childMapId") REFERENCES "public"."WorldMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtlasImport" ADD CONSTRAINT "AtlasImport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtlasLocationSeed" ADD CONSTRAINT "AtlasLocationSeed_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtlasLocationSeed" ADD CONSTRAINT "AtlasLocationSeed_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtlasChange" ADD CONSTRAINT "AtlasChange_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
