import { prisma } from "@/lib/prisma";
import { portraitSubject, portraitOwnerKey } from "@/lib/portrait-access";
import { portraitView, changePortrait, portraitImage } from "@/lib/portraits";
import { portraitFailure, portraitForm } from "@/lib/portrait-http";
export const runtime = "nodejs";
type Context = { params: Promise<{ campaignId: string; kind: string; entityId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const { campaignId, kind, entityId } = await params, s = await portraitSubject(campaignId, kind, entityId);
    if (new URL(request.url).searchParams.has("default")) {
      const image = await prisma.portrait.findFirst({ where: { campaignId, ...s.scope, isDefault: true }, select: { id: true } });
      return image ? await portraitImage(image.id) : new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    const portraits = await prisma.portrait.findMany({ where: { campaignId, ...s.scope }, select: portraitView, orderBy: { createdAt: "asc" } });
    const owners = s.actor.role === "DM" && kind === "character" && "characterId" in s.scope ? await prisma.campaignAccessSession.findMany({ where: { campaignId, role: "PLAYER", expiresAt: { gt: new Date() } }, select: { id: true }, take: 100 }) : [];
    const canAssignOwner = s.actor.role === "DM" && kind === "character" && "characterId" in s.scope;
    const currentOwner = canAssignOwner ? (await prisma.character.findFirst({ where: { id: entityId, campaignId }, select: { portraitOwnerKey: true } }))?.portraitOwnerKey : null;
    return Response.json({ portraits, canEdit: s.canEdit, accessHandle: portraitOwnerKey(s.actor.id).slice(0, 8), canAssignOwner, currentOwner, owners: owners.map(o => ({ id: portraitOwnerKey(o.id) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return portraitFailure(e); }
}
export async function POST(request: Request, { params }: Context) {
  try { const { campaignId, kind, entityId } = await params; await portraitSubject(campaignId, kind, entityId, true); const fd = await portraitForm(request); await changePortrait(campaignId, kind, entityId, fd); return Response.json({ ok: true }); }
  catch (e) { return portraitFailure(e); }
}
