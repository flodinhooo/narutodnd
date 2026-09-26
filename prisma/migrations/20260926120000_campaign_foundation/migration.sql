ALTER TABLE "Campaign" ADD COLUMN "jutsuLibraryAccess" TEXT NOT NULL DEFAULT 'CLOSED';

ALTER TABLE "CampaignSession" RENAME TO "CampaignAccessSession";

CREATE TABLE "JutsuPrerequisite" (
  "jutsuId" TEXT NOT NULL,
  "prerequisiteJutsuId" TEXT NOT NULL,
  PRIMARY KEY ("jutsuId", "prerequisiteJutsuId"),
  CONSTRAINT "JutsuPrerequisite_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "Jutsu" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "JutsuPrerequisite_prerequisiteJutsuId_fkey" FOREIGN KEY ("prerequisiteJutsuId") REFERENCES "Jutsu" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GameSession" (
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
  CONSTRAINT "GameSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GameSession_campaignId_number_key" ON "GameSession"("campaignId", "number");
CREATE INDEX "GameSession_campaignId_status_idx" ON "GameSession"("campaignId", "status");

CREATE TABLE "Location" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "parentId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'OTHER',
  "shortDescription" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "playerVisible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Location_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Location_campaignId_slug_key" ON "Location"("campaignId", "slug");
CREATE INDEX "Location_campaignId_playerVisible_idx" ON "Location"("campaignId", "playerVisible");
