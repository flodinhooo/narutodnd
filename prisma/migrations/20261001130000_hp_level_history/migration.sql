ALTER TABLE "Character" ADD COLUMN "hpLegacyLevel" INTEGER;
ALTER TABLE "Character" ADD COLUMN "hpLegacyBase" INTEGER;
ALTER TABLE "Character" ADD COLUMN "hpOverrideOffset" INTEGER;

-- Preserve every existing HP value. No historical rolls are invented.
-- SQLite integer division truncates toward zero: the negative case implements floor.
UPDATE "Character" SET
  "hpLegacyLevel" = "level",
  "hpLegacyBase" = "maxHp" - "level" *
    CASE WHEN "con" < 10 THEN ("con" - 11) / 2 ELSE ("con" - 10) / 2 END;

CREATE TABLE "CharacterHpLevel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "level" INTEGER NOT NULL CHECK ("level" BETWEEN 2 AND 20),
  "hitDie" TEXT NOT NULL CHECK ("hitDie" IN ('d8', 'd10')),
  "rawRoll" INTEGER NOT NULL,
  "effectiveRoll" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterHpLevel_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK (("hitDie" = 'd8' AND "rawRoll" BETWEEN 1 AND 8 AND "effectiveRoll" = MAX("rawRoll", 4))
      OR ("hitDie" = 'd10' AND "rawRoll" BETWEEN 1 AND 10 AND "effectiveRoll" = MAX("rawRoll", 5)))
);
CREATE UNIQUE INDEX "CharacterHpLevel_characterId_level_key" ON "CharacterHpLevel"("characterId", "level");
