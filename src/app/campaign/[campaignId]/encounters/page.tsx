export const metadata = { title: "Encounters" };
import Link from "next/link";
import { listEncounters } from "@/lib/encounter-library";
import { encounterTypes, encounterStatuses } from "@/lib/encounters";
import { enemyDifficulties } from "@/lib/enemy-templates";

export default async function Encounters({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { campaignId } = await params, query = await searchParams;
  const filter = (key: string) => typeof query[key] === "string" ? (query[key] as string).slice(0, 200) : "";
  const encounters = await listEncounters(campaignId, { q: filter("q"), type: filter("type"), status: filter("status") });
  return <main className="shell"><header className="topbar"><div><div className="eyebrow">DM / BEGEGNUNGEN</div><h1>Encounters</h1><p className="muted">Begegnungen vorbereiten und beliebig oft durchführen.</p></div><Link className="button primary" href={`/campaign/${campaignId}/encounters/new`}>Encounter erstellen</Link></header><form className="filter-row"><input name="q" aria-label="Encounter suchen" placeholder="Name suchen" defaultValue={filter("q")} /><select name="type" aria-label="Typ" defaultValue={filter("type")}><option value="">Alle Typen</option>{Object.entries(encounterTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select name="status" aria-label="Status" defaultValue={filter("status")}><option value="">Aktuelle Vorlagen</option>{Object.entries(encounterStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="button primary">Filtern</button><Link className="button ghost" href={`/campaign/${campaignId}/encounters`}>Zurücksetzen</Link></form><div className="grid">{encounters.map(e => <Link key={e.id} className="panel character-card" href={`/campaign/${campaignId}/encounters/${e.id}`}><span className="tag">{encounterTypes[e.type]} · {enemyDifficulties[e.difficulty]} · {encounterStatuses[e.status]}</span><h2>{e.name}</h2><p>{e._count.participants} Teilnehmergruppen · {e._count.runs} Durchführungen</p></Link>)}</div>{!encounters.length && <p className="panel empty">Keine passenden Begegnungen.</p>}</main>;
}
