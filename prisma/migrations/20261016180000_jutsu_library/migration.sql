ALTER TABLE "Jutsu" ADD COLUMN "reviewNeeded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Jutsu" ADD COLUMN "sourceMarkdown" TEXT;
CREATE TABLE "CampaignJutsuRelease" (
  "campaignId" TEXT NOT NULL,
  "jutsuId" TEXT NOT NULL,
  PRIMARY KEY ("campaignId", "jutsuId"),
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("jutsuId") REFERENCES "Jutsu"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
