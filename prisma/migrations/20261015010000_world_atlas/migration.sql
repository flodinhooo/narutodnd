-- CreateTable
CREATE TABLE "WorldMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorldMap_not_self" CHECK ("parentId" IS NULL OR "parentId" != "id"),
    CONSTRAINT "WorldMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldMap_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorldMap" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorldMap_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "icon" TEXT NOT NULL DEFAULT 'pin',
    "color" TEXT NOT NULL DEFAULT '#d7ae68',
    "playerVisible" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "childMapId" TEXT,
    "seedKey" TEXT,
    CONSTRAINT "MapMarker_coordinates" CHECK ("x" >= 0 AND "x" <= 1 AND "y" >= 0 AND "y" <= 1),
    CONSTRAINT "MapMarker_not_self" CHECK ("childMapId" IS NULL OR "childMapId" != "mapId"),
    CONSTRAINT "MapMarker_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "WorldMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapMarker_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MapMarker_childMapId_fkey" FOREIGN KEY ("childMapId") REFERENCES "WorldMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AtlasWorldTemplate" (
    "seedKey" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "blueprint" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "AtlasImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "seedKey" TEXT NOT NULL,
    "rootMapId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtlasImport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AtlasLocationSeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "seedKey" TEXT NOT NULL,
    "locationId" TEXT,
    CONSTRAINT "AtlasLocationSeed_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AtlasLocationSeed_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AtlasChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "mapId" TEXT,
    CONSTRAINT "AtlasChange_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorldMap_imageKey_key" ON "WorldMap"("imageKey");

-- CreateIndex
CREATE INDEX "WorldMap_campaignId_parentId_idx" ON "WorldMap"("campaignId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldMap_campaignId_seedKey_key" ON "WorldMap"("campaignId", "seedKey");

-- CreateIndex
CREATE INDEX "MapMarker_mapId_idx" ON "MapMarker"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "MapMarker_mapId_seedKey_key" ON "MapMarker"("mapId", "seedKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasImport_campaignId_seedKey_key" ON "AtlasImport"("campaignId", "seedKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasLocationSeed_campaignId_seedKey_key" ON "AtlasLocationSeed"("campaignId", "seedKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasChange_campaignId_requestId_key" ON "AtlasChange"("campaignId", "requestId");
