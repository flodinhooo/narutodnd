ALTER TABLE "ChakraNature" ADD COLUMN "playerSelectable" BOOLEAN NOT NULL DEFAULT false;

-- Opt-in, fail closed for current and future special natures. Keep all assignments.
UPDATE "ChakraNature" SET "playerSelectable" = true
WHERE "key" IN ('FIRE', 'WATER', 'WIND', 'LIGHTNING', 'EARTH');
