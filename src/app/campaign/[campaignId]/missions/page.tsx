export const metadata = { title: "Missionen" };
import Link from "next/link";
import { requireCampaign } from "@/lib/session";
import { listMissions, listMissionTemplates } from "@/lib/mission-library";
import { missionStatuses } from "@/lib/missions";
import { importMissionTemplate } from "@/app/campaign/mission-import-actions";
import { missionFormResult } from "@/lib/mission-form-result";
import PeopleForm from "@/components/PeopleForm";

export default async function MissionBoard({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { campaignId } = await params, actor = await requireCampaign(campaignId), query = await searchParams, dm = actor.role === "DM";
  const filter = (key: string) => typeof query[key] === "string" ? (query[key] as string).slice(0, 200) : "";
  const missions = await listMissions(campaignId, { q: filter("q"), rank: filter("rank"), status: filter("status"), archived: filter("archived") });
  const templates = dm ? await listMissionTemplates(campaignId) : [];
  return <main className="shell"><header className="topbar"><div><div className="eyebrow">{dm ? "DM" : "SPIELER"} / MISSION BOARD</div><h1>Missionen</h1><p className="muted">Aufträge, Ziele und Fortschritt der Kampagne.</p></div>{dm && <Link className="button primary" href={`/campaign/${campaignId}/missions/new`}>Mission erstellen</Link>}</header><form className="filter-row"><input name="q" placeholder="Titel suchen" aria-label="Mission suchen" defaultValue={filter("q")} /><select name="rank" aria-label="Rang" defaultValue={filter("rank")}><option value="">Alle Ränge</option>{["D", "C", "B", "A", "S"].map(r => <option key={r}>{r}</option>)}</select><select name="status" aria-label="Status" defaultValue={filter("status")}><option value="">Alle Status</option>{Object.entries(missionStatuses).filter(([key]) => dm || key !== "DRAFT").map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>{dm && <label className="check"><input type="checkbox" name="archived" value="true" defaultChecked={filter("archived") === "true"} />Archiv</label>}<button className="button primary">Filtern</button><Link className="button ghost" href={`/campaign/${campaignId}/missions?status=AVAILABLE`}>Verfügbare Missionen</Link></form>
    <div className="grid">{missions.map(m => <article className="panel character-card" key={m.id}><span className="tag">{m.rank}-Rang · {missionStatuses[m.status]}</span><Link href={`/campaign/${campaignId}/missions/${m.id}`}><h2>{m.title}</h2></Link><p className="people-prose">{m.publicInformation}</p><p>{m.rewards}</p></article>)}</div>{!missions.length && <p className="panel empty">Keine passenden freigegebenen Missionen.</p>}
    {dm && <section className="panel form"><h2>Beispielmissionen importieren</h2><Link className="button" href={`/campaign/${campaignId}/admin/lore`}>Private Startermissionen und Auftraggeber ausw?hlen</Link><p className="muted">Erst der bestätigte Import erstellt kampagneneigene Missionen, fehlende NPCs, Orte und Encounter. Passende vorhandene NPCs/Orte werden wiederverwendet. Ein erneuter Import öffnet dieselbe Mission.</p>{templates.map(t => {
      async function importTemplate() { "use server"; return missionFormResult(async () => { const id = await importMissionTemplate(campaignId, t.id); return `/campaign/${campaignId}/missions/${id}`; }); }
      return <details key={t.id}><summary>{t.rank}-Rang · {t.title}</summary><p>{t.summary}</p><PeopleForm action={importTemplate} confirm="Diese Beispielmission mit ihren fehlenden NPCs, Orten und Encountern in diese Kampagne importieren?"><button className="button primary">In Kampagne importieren / öffnen</button></PeopleForm></details>;
    })}</section>}
  </main>;
}
