-- CreateTable
CREATE TABLE "EnemyTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "seedKey" TEXT,
    "sourceTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "ninjaRank" TEXT,
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
    "reservoir" TEXT NOT NULL DEFAULT 'AVERAGE',
    "customReservoirMultiplier" REAL,
    "maxChakraOverride" INTEGER,
    "controlRank" TEXT NOT NULL DEFAULT 'TRAINED',
    "regenRank" TEXT NOT NULL DEFAULT 'TRAINED',
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EnemyTemplate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnemyTemplate_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "EnemyTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EnemyTemplate_seed_scope" CHECK ("seedKey" IS NULL OR ("campaignId" IS NULL AND "sourceTemplateId" IS NULL)),
    CONSTRAINT "EnemyTemplate_positive_hp" CHECK ("maxHp" > 0),
    CONSTRAINT "EnemyTemplate_level_range" CHECK ("level" BETWEEN 1 AND 20 AND "recommendedLevelMin" BETWEEN 1 AND 20 AND "recommendedLevelMax" BETWEEN "recommendedLevelMin" AND 20),
    CONSTRAINT "EnemyTemplate_chakra_override" CHECK (("maxChakraOverride" IS NULL OR ("hasChakra" AND "maxChakraOverride" > 0)) AND ("hasChakra" OR "customReservoirMultiplier" IS NULL))
);

-- CreateTable
CREATE TABLE "EnemyTemplateNature" (
    "templateId" TEXT NOT NULL,
    "chakraNatureId" TEXT NOT NULL,

    PRIMARY KEY ("templateId", "chakraNatureId"),
    CONSTRAINT "EnemyTemplateNature_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EnemyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnemyTemplateNature_chakraNatureId_fkey" FOREIGN KEY ("chakraNatureId") REFERENCES "ChakraNature" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnemyTemplateJutsu" (
    "templateId" TEXT NOT NULL,
    "jutsuId" TEXT NOT NULL,

    PRIMARY KEY ("templateId", "jutsuId"),
    CONSTRAINT "EnemyTemplateJutsu_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EnemyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnemyTemplateJutsu_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "Jutsu" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EnemyTemplate_seedKey_key" ON "EnemyTemplate"("seedKey");

-- CreateIndex
CREATE INDEX "EnemyTemplate_campaignId_archived_category_difficulty_idx" ON "EnemyTemplate"("campaignId", "archived", "category", "difficulty");
