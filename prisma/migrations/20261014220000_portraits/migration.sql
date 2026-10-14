-- AlterTable
ALTER TABLE "Character" ADD COLUMN "portraitOwnerKey" TEXT;

-- CreateTable
CREATE TABLE "Portrait" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Portrait_one_subject" CHECK (("characterId" IS NOT NULL) + ("npcId" IS NOT NULL) + ("enemyTemplateId" IS NOT NULL) = 1),
    CONSTRAINT "Portrait_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Portrait_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Portrait_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Portrait_enemyTemplateId_fkey" FOREIGN KEY ("enemyTemplateId") REFERENCES "EnemyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Portrait_storageKey_key" ON "Portrait"("storageKey");

-- CreateIndex
CREATE INDEX "Portrait_campaignId_idx" ON "Portrait"("campaignId");

-- CreateIndex
CREATE INDEX "Portrait_characterId_isDefault_idx" ON "Portrait"("characterId", "isDefault");

-- CreateIndex
CREATE INDEX "Portrait_npcId_isDefault_idx" ON "Portrait"("npcId", "isDefault");

-- CreateIndex
CREATE INDEX "Portrait_enemyTemplateId_isDefault_idx" ON "Portrait"("enemyTemplateId", "isDefault");

CREATE UNIQUE INDEX "Portrait_character_default" ON "Portrait"("characterId") WHERE "isDefault" = 1;
CREATE UNIQUE INDEX "Portrait_npc_default" ON "Portrait"("npcId") WHERE "isDefault" = 1;
CREATE UNIQUE INDEX "Portrait_enemy_default" ON "Portrait"("enemyTemplateId") WHERE "isDefault" = 1;
