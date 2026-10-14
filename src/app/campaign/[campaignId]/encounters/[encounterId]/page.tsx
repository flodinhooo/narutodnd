import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getEncounter, encounterBuilderOptions } from "@/lib/encounter-library";
import { encounterTypes, encounterStatuses, encounterSides, runStatuses, encounterEventsSchema } from "@/lib/encounters";
import { saveEncounter, saveEncounterParticipant, removeEncounterParticipant, startEncounterRun, deleteEncounter } from "@/app/campaign/encounter-actions";
import EncounterForm from "@/components/EncounterForm";
import EncounterParticipantForm from "@/components/EncounterParticipantForm";
import PeopleForm from "@/components/PeopleForm";

export default async function EncounterDetail({ params }: { params: Promise<{ campaignId: string; encounterId: string }> }) {
  const { campaignId, encounterId } = await params, e = await getEncounter(campaignId, encounterId);
  if (!e) notFound();
  const options = await encounterBuilderOptions(campaignId), requestId = randomUUID();
  const version = e.version;
  async function save(fd: FormData) { "use server"; await saveEncounter(campaignId, encounterId, fd); }
  async function start() { "use server"; const id = await startEncounterRun(campaignId, encounterId, version, requestId); return `/campaign/${campaignId}/encounters/runs/${id}`; }
  async function remove(fd: FormData) { "use server"; await deleteEncounter(campaignId, encounterId, version, fd); return `/campaign/${campaignId}/encounters`; }
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/encounters`}>← Encounters</Link><header className="topbar"><div><div className="eyebrow">{encounterTypes[e.type]} · {encounterStatuses[e.status]} · VERSION {version}</div><h1>{e.name}</h1><p className="people-prose">{e.description}</p>{e.location && <p>Ort: {e.location.name}</p>}</div>{e.status === "READY" && <PeopleForm className="" action={start}><button className="button primary">Neue Durchführung vorbereiten</button></PeopleForm>}</header><section className="dm-panel"><h2>DM-Notizen</h2><p className="people-prose">{e.dmNotes || "Keine Notizen."}</p></section>
    <details className="panel form"><summary>Vorlage bearbeiten / Status ändern</summary><EncounterForm key={version} action={save} initial={e} locations={options.locations} /></details>
    <h2>Teilnehmer ({e.participants.reduce((sum, p) => sum + p.quantity, 0)})</h2>{e.participants.map(p => <section className="panel form" key={p.id}><h3>{p.quantity} × {p.enemyTemplate?.name ?? p.character?.name ?? p.npc?.name}</h3><p>{encounterSides[p.side]} · {p.notes}</p>{e.status !== "ARCHIVED" && <><details><summary>Teilnehmer bearbeiten</summary><EncounterParticipantForm key={`${p.id}:${version}`} options={options} initial={p} action={saveEncounterParticipant.bind(null, campaignId, encounterId, p.id, version)} /></details><PeopleForm className="" action={removeEncounterParticipant.bind(null, campaignId, encounterId, p.id, version)} confirm="Teilnehmergruppe aus dieser Vorlage entfernen? Bestehende Runs bleiben unverändert."><button className="button ghost">Entfernen</button></PeopleForm></>}</section>)}
    {e.status !== "ARCHIVED" && <details className="panel form" open={!e.participants.length}><summary>Teilnehmer hinzufügen</summary><EncounterParticipantForm key={`new:${version}`} options={options} action={saveEncounterParticipant.bind(null, campaignId, encounterId, null, version)} /></details>}
    <h2>Vorbereitete Ereignisse</h2>{encounterEventsSchema.parse(e.events).map(event => <section key={event.id} className="panel form"><h3>{event.title}</h3><p>Auslöser: {event.trigger || "Nach Entscheidung des DMs"}</p><p className="people-prose">{event.description}</p></section>)}
    <h2>Durchführungen</h2>{e.runs.length ? e.runs.map(run => <p key={run.id}><Link className="button ghost" href={`/campaign/${campaignId}/encounters/runs/${run.id}`}>{run.name} · {runStatuses[run.status]} · Runde {run.round} · {run.createdAt.toLocaleString("de-CH")}</Link></p>) : <p className="muted">Noch keine Durchführung. Vorlage auf „Bereit“ setzen und eine neue Durchführung vorbereiten.</p>}
    {e.status === "ARCHIVED" && !e.runs.length && <PeopleForm action={remove} confirm="Diese Vorlage endgültig löschen?"><label>Zum Löschen „{e.name}“ eingeben<input name="confirmation" required autoComplete="off" /></label><button className="button ghost">Vorlage endgültig löschen</button></PeopleForm>}
  </main>;
}
