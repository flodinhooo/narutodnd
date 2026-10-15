-- Optional structured NPC combat data; existing character sheets remain unchanged.
ALTER TABLE "Character" ADD COLUMN "combatProfile" JSONB;
