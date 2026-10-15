import { notFound } from "next/navigation";
import { atlasDetail, type AtlasDetail } from "@/lib/atlas-library";
import { PortraitError } from "@/lib/portrait-image";
import AtlasWorkspace from "@/components/atlas/AtlasWorkspace";
export default async function AtlasMapPage({ params }: { params: Promise<{ campaignId: string; mapId: string }> }) {
  const { campaignId, mapId } = await params;
  let detail: AtlasDetail;
  try { detail = await atlasDetail(campaignId, mapId); }
  catch (e) { if (e instanceof PortraitError && e.status === 404) notFound(); throw e; }
  return <AtlasWorkspace key={mapId} campaignId={campaignId} initial={detail} />;
}
