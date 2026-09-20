ALTER TABLE "Campaign" ADD COLUMN "dmCodeLookup" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "playerCodeLookup" TEXT;

CREATE UNIQUE INDEX "Campaign_dmCodeLookup_key" ON "Campaign"("dmCodeLookup");
CREATE UNIQUE INDEX "Campaign_playerCodeLookup_key" ON "Campaign"("playerCodeLookup");
