import Link from "next/link";
import { getSessionDashboard } from "@/lib/mission-session";
import { missionOptions } from "@/lib/mission-library";
import { missionStatuses, objectiveStatuses } from "@/lib/missions";
import { runStatuses } from "@/lib/encounters";
import { missionFormResult } from "@/lib/mission-form-result";
import { setSessionContent } from "@/app/campaign/mission-session-actions";
import PeopleForm from "./PeopleForm";
import { SessionContentForm } from "./MissionSessionForms";
import MissionCommandButton from "./MissionCommandButton";

export default async function SessionMissionPanel({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const dashboard = await getSessionDashboard(campaignId, sessionId); if (!dashboard) return null;
  if (dashboard.role === "PLAYER") return <section><h2>Missionen und Fortschritt</h2>{dashboard.missions.map(m => <section className="panel form" key={m.id}><Link href={`/campaign/${campaignId}/missions/${m.id}`}><h3>{m.rank}-Rang · {m.title}</h3></Link><p>{missionStatuses[m.status]} · {m.objectives.filter(o => o.status === "COMPLETED").length}/{m.objectives.length} öffentliche Ziele erfüllt</p>{m.objectives.map(o => <p key={o.id}>{o.title} · {objectiveStatuses[o.status]}</p>)}<div className="combat-buttons">{m.npcs.map(n => <Link key={n.id} href={`/campaign/${campaignId}/npcs/${n.id}`}>{n.name}</Link>)}</div></section>)}</section>;
  const { session, missions } = dashboard, options = await missionOptions(campaignId);
  async function assign(fd: FormData) { "use server"; return missionFormResult(() => setSessionContent(campaignId, sessionId, session.version, fd)); }
  return <section><h2>Zugeordnete Missionen</h2>{missions.map(m => {
    async function unassign() { "use server"; return missionFormResult(() => { const fd = new FormData(); fd.set("kind", "MISSION"); fd.set("id", m.id); fd.set("assigned", "false"); return setSessionContent(campaignId, sessionId, session.version, fd); }); }
    return <section className="panel form" key={m.id}><Link href={`/campaign/${campaignId}/missions/${m.id}`}><h2>{m.rank}-Rang · {m.title}</h2></Link><p>{missionStatuses[m.status]} · {m.objectives.filter(o => o.status === "COMPLETED").length}/{m.objectives.length} Ziele erfüllt</p><div className="combat-buttons">{m.npcs.map(n => <Link key={n.npcId} href={`/campaign/${campaignId}/npcs/${n.npcId}`}>{n.npc.name}</Link>)}</div>
      {m.objectives.filter(o => o.enabled && !["COMPLETED", "SKIPPED"].includes(o.status)).map(o => <div className="mission-objective" key={o.id}><h3>{o.title}</h3><p>{objectiveStatuses[o.status]} · {o.optional ? "Optional" : "Pflichtziel"} · {o.playerVisible ? "Öffentlich" : "Geheim"}</p>{m.status === "ACTIVE" && !m.archived && <MissionCommandButton key={m.version} campaignId={campaignId} missionId={m.id} version={m.version} command={{ kind: "OBJECTIVE", objectiveId: o.id, status: "COMPLETED" }}>Ziel abhaken</MissionCommandButton>}</div>)}
      {m.status === "ACTIVE" && !m.archived && session.status !== "COMPLETED" && m.encounters.filter(e => e.encounter.status === "READY").map(e => <MissionCommandButton key={`${e.id}:${m.version}:${session.version}`} campaignId={campaignId} missionId={m.id} version={m.version} command={{ kind: "START_ENCOUNTER", linkId: e.id, encounterVersion: e.encounter.version, sessionId, sessionVersion: session.version }}>{e.encounter.name}: Run in dieser Session vorbereiten</MissionCommandButton>)}
      <PeopleForm className="" action={unassign} confirm="Mission aus dieser Session entfernen? Fortschritt und Runs bleiben erhalten."><button className="button ghost">Zuordnung entfernen</button></PeopleForm></section>;
  })}<h2>Encounter Runs</h2>{session.encounterRunLinks.map(link => {
    async function unassignRun() { "use server"; return missionFormResult(() => { const fd = new FormData(); fd.set("kind", "RUN"); fd.set("id", link.runId); fd.set("assigned", "false"); return setSessionContent(campaignId, sessionId, session.version, fd); }); }
    return <section className="panel form" key={link.runId}><Link href={`/campaign/${campaignId}/encounters/runs/${link.runId}`}><h3>{link.run.name} · {runStatuses[link.run.status]} · Runde {link.run.round}</h3></Link><p className="people-prose">{link.run.summary}</p><PeopleForm className="" action={unassignRun} confirm="Run-Zuordnung entfernen? Der Run bleibt erhalten."><button className="button ghost">Run-Zuordnung entfernen</button></PeopleForm></section>;
  })}<details className="panel form"><summary>Mission oder vorhandenen Run zuordnen</summary><SessionContentForm key={session.version} action={assign} missions={options.missions} runs={options.runs} /></details></section>;
}
