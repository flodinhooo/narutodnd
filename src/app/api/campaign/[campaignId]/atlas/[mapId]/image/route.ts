import { atlasDetail } from "@/lib/atlas-library";
import { prisma } from "@/lib/prisma";
import { atlasStorage } from "@/lib/atlas-image";
import { portraitFailure } from "@/lib/portrait-http";
import { PortraitError } from "@/lib/portrait-image";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ campaignId: string; mapId: string }> }) {
  try {
    const { campaignId, mapId } = await params; await atlasDetail(campaignId, mapId);
    const map = await prisma.worldMap.findFirst({ where: { id: mapId, campaignId }, select: { imageKey: true } }); if (!map?.imageKey) throw new PortraitError("Kartenbild fehlt.", 404);
    const bytes = await atlasStorage().read(map.imageKey).catch(() => { throw new PortraitError("Kartenbild fehlt.", 404); });
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Content-Disposition": "inline; filename=map.webp" } });
  } catch (e) { return portraitFailure(e); }
}
