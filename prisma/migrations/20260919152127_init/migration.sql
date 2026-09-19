-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dmCodeHash" TEXT NOT NULL,
    "playerCodeHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChakraNature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "portraitUrl" TEXT,
    "background" TEXT NOT NULL DEFAULT '',
    "alignment" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "speed" INTEGER NOT NULL DEFAULT 30,
    "maxHp" INTEGER NOT NULL DEFAULT 10,
    "currentHp" INTEGER NOT NULL DEFAULT 10,
    "hitDie" TEXT NOT NULL DEFAULT 'd10',
    "acOverride" INTEGER,
    "str" INTEGER NOT NULL DEFAULT 10,
    "dex" INTEGER NOT NULL DEFAULT 10,
    "con" INTEGER NOT NULL DEFAULT 10,
    "int" INTEGER NOT NULL DEFAULT 10,
    "wis" INTEGER NOT NULL DEFAULT 10,
    "cha" INTEGER NOT NULL DEFAULT 10,
    "currentChakra" INTEGER NOT NULL DEFAULT 0,
    "reservoir" TEXT NOT NULL DEFAULT 'AVERAGE',
    "customReservoirMultiplier" REAL,
    "regenRank" TEXT NOT NULL DEFAULT 'TRAINED',
    "controlRank" TEXT NOT NULL DEFAULT 'TRAINED',
    "breakthroughPoints" INTEGER NOT NULL DEFAULT 0,
    "shortRestsSinceLongRest" INTEGER NOT NULL DEFAULT 0,
    "limitBreakUsed" BOOLEAN NOT NULL DEFAULT false,
    "deathSaveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "deathSaveFailures" INTEGER NOT NULL DEFAULT 0,
    "severelyWounded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterChakraNature" (
    "characterId" TEXT NOT NULL,
    "chakraNatureId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAtLevel" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'CHARACTER_CREATION',

    PRIMARY KEY ("characterId", "chakraNatureId"),
    CONSTRAINT "CharacterChakraNature_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterChakraNature_chakraNatureId_fkey" FOREIGN KEY ("chakraNatureId") REFERENCES "ChakraNature" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Jutsu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "japaneseName" TEXT,
    "description" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "chakraCost" INTEGER NOT NULL,
    "range" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "attackType" TEXT,
    "damageDice" TEXT,
    "damageType" TEXT,
    "saveAbility" TEXT,
    "requiresConcentration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JutsuChakraNature" (
    "jutsuId" TEXT NOT NULL,
    "chakraNatureId" TEXT NOT NULL,

    PRIMARY KEY ("jutsuId", "chakraNatureId"),
    CONSTRAINT "JutsuChakraNature_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "Jutsu" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JutsuChakraNature_chakraNatureId_fkey" FOREIGN KEY ("chakraNatureId") REFERENCES "ChakraNature" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterJutsu" (
    "characterId" TEXT NOT NULL,
    "jutsuId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CHARACTER_CREATION',
    "learnedAtLevel" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    PRIMARY KEY ("characterId", "jutsuId"),
    CONSTRAINT "CharacterJutsu_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterJutsu_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "Jutsu" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillProficiencyRecord" (
    "characterId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "proficiency" TEXT NOT NULL,

    PRIMARY KEY ("characterId", "skill"),
    CONSTRAINT "SkillProficiencyRecord_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingThrowProficiency" (
    "characterId" TEXT NOT NULL,
    "ability" TEXT NOT NULL,

    PRIMARY KEY ("characterId", "ability"),
    CONSTRAINT "SavingThrowProficiency_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterDMData" (
    "characterId" TEXT NOT NULL PRIMARY KEY,
    "notes" TEXT NOT NULL DEFAULT '',
    "secretInformation" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterDMData_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_dmCodeHash_key" ON "Campaign"("dmCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_playerCodeHash_key" ON "Campaign"("playerCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChakraNature_key_key" ON "ChakraNature"("key");

-- CreateIndex
CREATE INDEX "Character_campaignId_idx" ON "Character"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Jutsu_slug_key" ON "Jutsu"("slug");

-- CreateIndex
CREATE INDEX "CampaignSession_campaignId_idx" ON "CampaignSession"("campaignId");
