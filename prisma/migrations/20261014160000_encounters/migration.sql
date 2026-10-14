-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'COMBAT',
    "difficulty" TEXT NOT NULL DEFAULT 'MODERATE',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "events" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Encounter_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterParticipantPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "enemyTemplateId" TEXT,
    "characterId" TEXT,
    "npcId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "side" TEXT NOT NULL DEFAULT 'HOSTILE',
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EncounterParticipantPlan_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterParticipantPlan_enemyTemplateId_fkey" FOREIGN KEY ("enemyTemplateId") REFERENCES "EnemyTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EncounterParticipantPlan_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EncounterParticipantPlan_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EncounterParticipantPlan_one_source" CHECK (("enemyTemplateId" IS NOT NULL) + ("characterId" IS NOT NULL) + ("npcId" IS NOT NULL) = 1),
    CONSTRAINT "EncounterParticipantPlan_quantity" CHECK ("quantity" BETWEEN 1 AND 20 AND ("enemyTemplateId" IS NOT NULL OR "quantity" = 1))
);

-- CreateTable
CREATE TABLE "EncounterRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "startRequestId" TEXT NOT NULL,
    "startHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "locationName" TEXT NOT NULL DEFAULT '',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "events" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "round" INTEGER NOT NULL DEFAULT 0,
    "activeParticipantId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    CONSTRAINT "EncounterRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterRun_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EncounterRun_activeParticipantId_fkey" FOREIGN KEY ("activeParticipantId") REFERENCES "EncounterRunParticipant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EncounterRun_round" CHECK ("round" >= 0 AND ("status" != 'PREPARING' OR ("round" = 0 AND "activeParticipantId" IS NULL)) AND ("status" != 'ACTIVE' OR "round" >= 1)),
    CONSTRAINT "EncounterRun_terminal" CHECK ("status" NOT IN ('COMPLETED', 'CANCELLED') OR ("activeParticipantId" IS NULL AND "endedAt" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "EncounterRunParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "sourcePlanId" TEXT,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "side" TEXT NOT NULL,
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
    CONSTRAINT "EncounterRunParticipant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EncounterRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterRunParticipant_sourcePlanId_fkey" FOREIGN KEY ("sourcePlanId") REFERENCES "EncounterParticipantPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EncounterRunParticipant_hp" CHECK (("maxHp" IS NULL AND "currentHp" IS NULL) OR ("maxHp" IS NOT NULL AND "currentHp" IS NOT NULL AND "maxHp" > 0 AND "currentHp" BETWEEN 0 AND "maxHp")),
    CONSTRAINT "EncounterRunParticipant_chakra" CHECK (("maxChakra" IS NULL AND "currentChakra" IS NULL) OR ("maxChakra" IS NOT NULL AND "currentChakra" IS NOT NULL AND "maxChakra" > 0 AND "currentChakra" BETWEEN 0 AND "maxChakra")),
    CONSTRAINT "EncounterRunParticipant_zero_hp" CHECK ("currentHp" IS NULL OR "currentHp" > 0 OR "unconscious"),
    CONSTRAINT "EncounterRunParticipant_ordinal" CHECK ("ordinal" >= 0)
);

-- CreateTable
CREATE TABLE "EncounterRunAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "appliedVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EncounterRunAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EncounterRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Encounter_campaignId_status_idx" ON "Encounter"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EncounterParticipantPlan_encounterId_idx" ON "EncounterParticipantPlan"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterRun_campaignId_status_idx" ON "EncounterRun"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterRun_campaignId_startRequestId_key" ON "EncounterRun"("campaignId", "startRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterRunParticipant_runId_ordinal_key" ON "EncounterRunParticipant"("runId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterRunAction_runId_requestId_key" ON "EncounterRunAction"("runId", "requestId");
