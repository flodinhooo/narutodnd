import { atlasLocationDetail } from "@/lib/atlas-location";
import { portraitFailure } from "@/lib/portrait-http";
export async function GET(_request: Request, { params }: { params: Promise<{ campaignId: string; locationId: string }> }) {
  try { const { campaignId, locationId } = await params, data = await atlasLocationDetail(campaignId, locationId); return Response.json(data, { status: data ? 200 : 404, headers: { "Cache-Control": "private, no-store" } }); }
  catch (e) { return portraitFailure(e); }
}
