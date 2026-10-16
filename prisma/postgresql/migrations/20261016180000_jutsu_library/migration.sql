ALTER TABLE "Jutsu" ADD COLUMN "reviewNeeded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Jutsu" ADD COLUMN "sourceMarkdown" TEXT;
CREATE TABLE "CampaignJutsuRelease" (
  "campaignId" TEXT NOT NULL,
  "jutsuId" TEXT NOT NULL,
  CONSTRAINT "CampaignJutsuRelease_pkey" PRIMARY KEY ("campaignId", "jutsuId"),
  CONSTRAINT "CampaignJutsuRelease_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampaignJutsuRelease_jutsuId_fkey" FOREIGN KEY ("jutsuId") REFERENCES "Jutsu"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
