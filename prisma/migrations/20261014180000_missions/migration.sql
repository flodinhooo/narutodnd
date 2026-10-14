-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "clientNpcId" TEXT,
    "locationId" TEXT,
    "title" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "publicInformation" TEXT NOT NULL DEFAULT '',
    "rewards" TEXT NOT NULL DEFAULT '',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mission_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "MissionTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mission_clientNpcId_fkey" FOREIGN KEY ("clientNpcId") REFERENCES "Npc" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mission_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MissionObjective_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionObjective_position" CHECK ("position" >= 0)
);

-- CreateTable
CREATE TABLE "MissionObjectiveDependency" (
    "objectiveId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    PRIMARY KEY ("objectiveId", "prerequisiteId"),
    CONSTRAINT "MissionObjectiveDependency_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "MissionObjective" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionObjectiveDependency_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "MissionObjective" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionObjectiveDependency_distinct" CHECK ("objectiveId" != "prerequisiteId")
);

-- CreateTable
CREATE TABLE "MissionNpc" (
    "missionId" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,

    PRIMARY KEY ("missionId", "npcId"),
    CONSTRAINT "MissionNpc_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionNpc_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionEncounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MissionEncounter_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionEncounter_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionEncounterRun" (
    "missionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "missionEncounterId" TEXT,

    PRIMARY KEY ("missionId", "runId"),
    CONSTRAINT "MissionEncounterRun_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionEncounterRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EncounterRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionEncounterRun_missionEncounterId_fkey" FOREIGN KEY ("missionEncounterId") REFERENCES "MissionEncounter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionMission" (
    "sessionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,

    PRIMARY KEY ("sessionId", "missionId"),
    CONSTRAINT "SessionMission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionMission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionEncounterRun" (
    "sessionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,

    PRIMARY KEY ("sessionId", "runId"),
    CONSTRAINT "SessionEncounterRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionEncounterRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EncounterRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionConsequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "npcId" TEXT,
    "organizationId" TEXT,
    "targetMissionId" TEXT,
    "objectiveId" TEXT,
    "value" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "MissionConsequence_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionConsequence_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionConsequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionConsequence_targetMissionId_fkey" FOREIGN KEY ("targetMissionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionConsequence_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "MissionObjective" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionConsequence_one_target" CHECK (("npcId" IS NOT NULL) + ("organizationId" IS NOT NULL) + ("targetMissionId" IS NOT NULL) + ("objectiveId" IS NOT NULL) = 1)
);

-- CreateTable
CREATE TABLE "MissionConsequenceApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "consequenceId" TEXT NOT NULL,
    "actorSessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionConsequenceApplication_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionConsequenceApplication_consequenceId_fkey" FOREIGN KEY ("consequenceId") REFERENCES "MissionConsequence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "resultId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionAction_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seedKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "blueprint" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "dmNotes" TEXT NOT NULL DEFAULT '',
    "playerNotes" TEXT NOT NULL DEFAULT '',
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "GameSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameSession" ("campaignId", "createdAt", "dmNotes", "endedAt", "id", "number", "playerNotes", "scheduledAt", "startedAt", "status", "summary", "title", "updatedAt") SELECT "campaignId", "createdAt", "dmNotes", "endedAt", "id", "number", "playerNotes", "scheduledAt", "startedAt", "status", "summary", "title", "updatedAt" FROM "GameSession";
DROP TABLE "GameSession";
ALTER TABLE "new_GameSession" RENAME TO "GameSession";
CREATE INDEX "GameSession_campaignId_status_idx" ON "GameSession"("campaignId", "status");
CREATE UNIQUE INDEX "GameSession_campaignId_number_key" ON "GameSession"("campaignId", "number");
CREATE TABLE "new_Organization" (
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
    "attitude" TEXT NOT NULL DEFAULT 'NEUTRAL',
    CONSTRAINT "Organization_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Organization_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Organization" ("archived", "campaignId", "createdAt", "description", "dmSecrets", "id", "locationId", "name", "notes", "playerVisible", "type", "updatedAt") SELECT "archived", "campaignId", "createdAt", "description", "dmSecrets", "id", "locationId", "name", "notes", "playerVisible", "type", "updatedAt" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE INDEX "Organization_campaignId_playerVisible_archived_idx" ON "Organization"("campaignId", "playerVisible", "archived");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Mission_campaignId_status_playerVisible_archived_idx" ON "Mission"("campaignId", "status", "playerVisible", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_campaignId_sourceTemplateId_key" ON "Mission"("campaignId", "sourceTemplateId");

-- CreateIndex
CREATE INDEX "MissionObjective_missionId_position_idx" ON "MissionObjective"("missionId", "position");

-- CreateIndex
CREATE INDEX "MissionEncounter_missionId_position_idx" ON "MissionEncounter"("missionId", "position");

-- CreateIndex
CREATE INDEX "MissionConsequence_missionId_idx" ON "MissionConsequence"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionConsequenceApplication_consequenceId_key" ON "MissionConsequenceApplication"("consequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionAction_missionId_requestId_key" ON "MissionAction"("missionId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionTemplate_seedKey_key" ON "MissionTemplate"("seedKey");
