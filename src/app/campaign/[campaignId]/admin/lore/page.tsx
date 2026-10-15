import { requireCampaign } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { lorePackages } from "@/lib/lore-files";
import LoreImporter from "@/components/LoreImporter";
export const metadata = { title: "Privater Lore-Import" };
export default async function LorePage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params; await requireCampaign(campaignId, true);
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { name: true } });
  return <main className="shell"><h1>Verwaltung · Lore-Import</h1><p>Private Vorlagen auswählen, vergleichen und ausdrücklich als verborgene Kampagneninhalte übernehmen. Bestehende Datensätze und manuelle Notizen bleiben erhalten.</p><LoreImporter campaignId={campaignId} campaignName={campaign.name} packages={await lorePackages()} /></main>;
}
