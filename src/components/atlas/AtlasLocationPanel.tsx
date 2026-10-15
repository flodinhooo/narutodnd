"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AtlasLocationView } from "@/lib/atlas-location";
import Portrait from "../Portrait";
export default function AtlasLocationPanel({ campaignId, locationId }: { campaignId: string; locationId: string }) {
  const [data, setData] = useState<AtlasLocationView | null>(null), [error, setError] = useState("");
  useEffect(() => { const abort = new AbortController(); fetch(`/api/campaign/${campaignId}/atlas/location/${locationId}`, { signal: abort.signal, cache: "no-store" }).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(setData).catch(() => { if (!abort.signal.aborted) setError("Ortsinformationen nicht verfügbar."); }); return () => abort.abort(); }, [campaignId, locationId]);
  if (error) return <p role="alert">{error}</p>; if (!data) return <p role="status">Ortsinformationen werden geladen …</p>;
  const base = `/campaign/${campaignId}`;
  return <section className="atlas-location-panel"><h3><Link href={`${base}/world/${data.location.slug}`}>{data.location.name} →</Link></h3>{data.parent && <p>Gehört zu <Link href={`${base}/world/${data.parent.slug}`}>{data.parent.name}</Link></p>}<p className="people-prose">{data.location.description}</p>{data.npcs.length > 0 && <><h4>NPCs / Charaktere</h4>{data.npcs.map(n => <p key={n.id}><Portrait campaignId={campaignId} kind="npc" entityId={n.id} name={n.name} /><Link href={`${base}/npcs/${n.id}`}>{n.name}</Link></p>)}</>}{data.organizations.length > 0 && <><h4>Organisationen</h4>{data.organizations.map(o => <p key={o.id}><Link href={`${base}/organizations/${o.id}`}>{o.name}</Link></p>)}</>}{data.missions.length > 0 && <><h4>Missionen</h4>{data.missions.map(m => <p key={m.id}><Link href={`${base}/missions/${m.id}`}>{m.rank}-Rang · {m.title}</Link></p>)}</>}{data.encounters.length > 0 && <><h4>Encounters (DM)</h4>{data.encounters.map(e => <p key={e.id}><Link href={`${base}/encounters/${e.id}`}>{e.name}</Link></p>)}</>}{data.maps.map(m => <p key={m.id}><Link className="button ghost" href={`${base}/atlas/${m.id}`}>Detailkarte: {m.name}</Link></p>)}{data.children.length > 0 && <><h4>Untergeordnete Orte</h4>{data.children.map(c => <p key={c.id}><Link href={`${base}/world/${c.slug}`}>{c.name}</Link></p>)}</>}</section>;
}
