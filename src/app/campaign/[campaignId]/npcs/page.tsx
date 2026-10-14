import Portrait from "@/components/Portrait";
export const metadata = { title: "NPCs" };
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { npcCategories, attitudes, publicNpcSelect } from "@/lib/campaign-people";
import { Options } from "@/components/PeopleFields";

export default async function Npcs({ params, searchParams }: {
  params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { campaignId } = await params;
  const session = await requireCampaign(campaignId);
  const dm = session.role === "DM", query = await searchParams;
  const filter = (key: string) => typeof query[key] === "string" ? (query[key] as string).slice(0, 200) : "";
  const archived = dm && filter("archived") === "true";
  const npcs = await prisma.npc.findMany({ where: {
    campaignId, archived, ...(!dm ? { playerVisible: true } : filter("visibility") ? { playerVisible: filter("visibility") === "visible" } : {}),
    ...(filter("q") ? { name: { contains: filter("q") } } : {}),
    ...(filter("category") ? { category: filter("category") } : {}),
    ...(filter("affiliation") ? { affiliation: { contains: filter("affiliation") } } : {}),
    ...(filter("rank") ? { ninjaRank: { contains: filter("rank") } } : {}),
  }, select: { ...publicNpcSelect, ...(dm ? { attitude: true, playerVisible: true } : {}) }, orderBy: { name: "asc" } });
  return <main className="shell"><header className="topbar"><div><div className="eyebrow">KAMPAGNE / NPCs</div><h1>NPCs</h1><p className="muted">Personen und Tiere deiner Kampagne.</p></div>{dm && <Link className="button primary" href={`/campaign/${campaignId}/npcs/new`}>NPC erstellen</Link>}</header>
    <form className="filter-row"><input name="q" aria-label="Nach Name suchen" placeholder="Name suchen" defaultValue={filter("q")} /><select name="category" aria-label="Kategorie" defaultValue={filter("category")}><option value="">Alle Kategorien</option><Options values={npcCategories} /></select><input name="affiliation" aria-label="Zugehörigkeit" placeholder="Zugehörigkeit" defaultValue={filter("affiliation")} /><input name="rank" aria-label="Rang" placeholder="Ninja-Rang" defaultValue={filter("rank")} />{dm && <><select name="visibility" aria-label="Sichtbarkeit" defaultValue={filter("visibility")}><option value="">Alle Sichtbarkeiten</option><option value="visible">Freigegeben</option><option value="hidden">Verborgen</option></select><label className="check"><input name="archived" value="true" type="checkbox" defaultChecked={archived} />Archiv</label></>}<button className="button primary">Filtern</button></form>
    {!npcs.length && <p className="panel empty">Keine passenden NPCs gefunden.</p>}
    <div className="grid">{npcs.map(n => <Link key={n.id} className="panel character-card" href={`/campaign/${campaignId}/npcs/${n.id}`}><span className="tag">{npcCategories[n.category as keyof typeof npcCategories]}</span><Portrait campaignId={campaignId} kind="npc" entityId={n.id} name={n.name} /><h3>{n.name}</h3><p>{n.occupation} {n.affiliation && `· ${n.affiliation}`}</p>{dm && <small>{attitudes[n.attitude as keyof typeof attitudes]} · {n.playerVisible ? "Freigegeben" : "Verborgen"}</small>}</Link>)}</div>
  </main>;
}
