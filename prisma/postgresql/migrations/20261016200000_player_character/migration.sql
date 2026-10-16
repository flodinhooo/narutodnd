ALTER TABLE "Character" ADD COLUMN "controlClaimHash" TEXT;
ALTER TABLE "Character" ADD COLUMN "activityVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "InventoryItem" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "characterId" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "category" TEXT NOT NULL DEFAULT 'EQUIPMENT',
 "description" TEXT NOT NULL DEFAULT '',
 "quantity" INTEGER NOT NULL DEFAULT 1,
 "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
 "equipped" BOOLEAN NOT NULL DEFAULT false,
 "damageDice" TEXT,
 "damageType" TEXT,
 "attackAbility" TEXT NOT NULL DEFAULT 'DEX',
 "proficient" BOOLEAN NOT NULL DEFAULT true,
 "range" TEXT NOT NULL DEFAULT '',
 "throwable" BOOLEAN NOT NULL DEFAULT false,
 "version" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "InventoryItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InventoryItem_characterId_idx" ON "InventoryItem"("characterId");
CREATE TABLE "CharacterActivity" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "characterId" TEXT NOT NULL,
 "requestId" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "result" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CharacterActivity_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CharacterActivity_characterId_requestId_key" ON "CharacterActivity"("characterId", "requestId");
CREATE INDEX "CharacterActivity_characterId_createdAt_idx" ON "CharacterActivity"("characterId", "createdAt");
