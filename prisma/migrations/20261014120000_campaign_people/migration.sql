-- CreateTable
CREATE TABLE "Npc" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Npc_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Npc_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Npc_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "dmSecrets" TEXT NOT NULL DEFAULT '',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Organization_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "npcId" TEXT,
    "characterId" TEXT,
    "role" TEXT NOT NULL DEFAULT '',
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMember_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMember_exactly_one_person" CHECK (("npcId" IS NOT NULL) != ("characterId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "CharacterRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sourceNpcId" TEXT,
    "targetNpcId" TEXT,
    "sourceCharacterId" TEXT,
    "targetCharacterId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dmSecrets" TEXT NOT NULL DEFAULT '',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CharacterRelationship_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterRelationship_sourceNpcId_fkey" FOREIGN KEY ("sourceNpcId") REFERENCES "Npc" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterRelationship_targetNpcId_fkey" FOREIGN KEY ("targetNpcId") REFERENCES "Npc" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterRelationship_sourceCharacterId_fkey" FOREIGN KEY ("sourceCharacterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterRelationship_targetCharacterId_fkey" FOREIGN KEY ("targetCharacterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterRelationship_source_person" CHECK (("sourceNpcId" IS NOT NULL) != ("sourceCharacterId" IS NOT NULL)),
    CONSTRAINT "CharacterRelationship_target_person" CHECK (("targetNpcId" IS NOT NULL) != ("targetCharacterId" IS NOT NULL)),
    CONSTRAINT "CharacterRelationship_distinct_people" CHECK (("sourceNpcId" IS NULL OR "targetNpcId" IS NULL OR "sourceNpcId" != "targetNpcId") AND ("sourceCharacterId" IS NULL OR "targetCharacterId" IS NULL OR "sourceCharacterId" != "targetCharacterId"))
);

-- CreateIndex
CREATE UNIQUE INDEX "Npc_characterId_key" ON "Npc"("characterId");

-- CreateIndex
CREATE INDEX "Npc_campaignId_playerVisible_archived_idx" ON "Npc"("campaignId", "playerVisible", "archived");

-- CreateIndex
CREATE INDEX "Organization_campaignId_playerVisible_archived_idx" ON "Organization"("campaignId", "playerVisible", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_npcId_key" ON "OrganizationMember"("organizationId", "npcId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_characterId_key" ON "OrganizationMember"("organizationId", "characterId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_campaignId_playerVisible_idx" ON "CharacterRelationship"("campaignId", "playerVisible");
