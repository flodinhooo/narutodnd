-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Jutsu" (
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
    "origin" TEXT NOT NULL DEFAULT 'SHIO_HOMEBREW',
    "pool" TEXT NOT NULL DEFAULT 'ELEMENTAL',
    "campaignId" TEXT,
    "category" TEXT,
    "progressionType" TEXT,
    "traditionProvenance" TEXT,
    "prerequisiteText" TEXT,
    "requiredNatureKeys" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Jutsu_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Jutsu" ("actionType", "attackType", "chakraCost", "createdAt", "damageDice", "damageType", "description", "duration", "id", "japaneseName", "name", "range", "rank", "requiresConcentration", "saveAbility", "slug", "updatedAt") SELECT "actionType", "attackType", "chakraCost", "createdAt", "damageDice", "damageType", "description", "duration", "id", "japaneseName", "name", "range", "rank", "requiresConcentration", "saveAbility", "slug", "updatedAt" FROM "Jutsu";
DROP TABLE "Jutsu";
ALTER TABLE "new_Jutsu" RENAME TO "Jutsu";
CREATE INDEX "Jutsu_origin_pool_idx" ON "Jutsu"("origin", "pool");
CREATE INDEX "Jutsu_campaignId_idx" ON "Jutsu"("campaignId");
CREATE UNIQUE INDEX "Jutsu_campaignId_slug_key" ON "Jutsu"("campaignId", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
DROP INDEX "CampaignSession_campaignId_idx";
CREATE INDEX "CampaignAccessSession_campaignId_idx" ON "CampaignAccessSession"("campaignId");
