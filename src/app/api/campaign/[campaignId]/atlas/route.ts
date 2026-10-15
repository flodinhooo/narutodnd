import { atlasCatalog, atlasDetail, atlasActor } from "@/lib/atlas-library";
import { mutateAtlas } from "@/lib/atlas-write";
import { importShioAtlas } from "@/lib/atlas-import";
import { portraitFailure, portraitForm } from "@/lib/portrait-http";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
type Context = { params: Promise<{ campaignId: string }> };
export async function GET(request: Request, { params }: Context) {
  try { const { campaignId } = await params, id = new URL(request.url).searchParams.get("map"); const data = id ? await atlasDetail(campaignId, id) : await atlasCatalog(campaignId); return Response.json(data, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (e) { return portraitFailure(e); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { campaignId } = await params; await atlasActor(campaignId, true); const fd = await portraitForm(request, 26 * 1024 * 1024);
    const result = fd.get("op") === "IMPORT_SHIO" ? { mapId: await importShioAtlas(campaignId) } : await mutateAtlas(campaignId, fd);
    revalidatePath(`/campaign/${campaignId}`, "layout"); return Response.json({ ok: true, ...result });
  } catch (e) { return portraitFailure(e); }
}
