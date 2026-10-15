import Link from "next/link";
import { atlasCatalog } from "@/lib/atlas-library";
import { mapTypes } from "@/lib/atlas-schema";
import AtlasCreate from "@/components/atlas/AtlasCreate";
export default async function AtlasIndex({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { campaignId } = await params, catalog = await atlasCatalog(campaignId), query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 200) : "", archived = query.archived === "true";
  const shown = catalog.maps.filter(m => (catalog.role !== "DM" || m.archived === archived) && m.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
  return <main className="shell"><header className="topbar"><div><div className="eyebrow">KAMPAGNE / WELTATLAS</div><h1>Deine Welt entdecken.</h1><p className="muted">Weltkarten, Regionen und Orte – vom Überblick bis ins Detail.</p></div><Link className="button ghost" href={`/campaign/${campaignId}/world`}>Orte verwalten</Link></header><form className="filter-row"><label>Karten suchen<input name="q" defaultValue={q} /></label>{catalog.role === "DM" && <label className="check"><input name="archived" type="checkbox" value="true" defaultChecked={archived} />Archiv</label>}<button className="button primary">Filtern</button></form>
    <div className="grid">{shown.map(m => <Link className="panel character-card" key={m.id} href={`/campaign/${campaignId}/atlas/${m.id}`}><span className="tag">{mapTypes[m.type]}{catalog.role === "DM" && ` · ${m.playerVisible ? "Freigegeben" : "Verborgen"}`}</span><h2>{m.name}</h2><p className="people-prose">{m.description}</p>{m.parentId && <p className="muted">In: {catalog.maps.find(p => p.id === m.parentId)?.name}</p>}</Link>)}</div>{!shown.length && <p className="panel empty">Keine Karten in dieser Auswahl. {catalog.role === "DM" ? "Erstelle eine eigene Karte oder importiere die Beispielwelt." : "Die Spielleitung kann Karten freigeben."}</p>}
    {catalog.role === "DM" && <AtlasCreate campaignId={campaignId} catalog={catalog} />}</main>;
}
