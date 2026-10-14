"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { performCombatAction, reloadEncounterRun } from "@/app/campaign/combat-actions";
import { encounterTypes, runStatuses, runEventsSchema, type RunView, type CombatCommand, type CombatRequest } from "@/lib/encounters";
import { initiativeOrder } from "@/lib/rules/encounters";
import CombatParticipant from "./CombatParticipant";

export default function CombatManager({ initial }: { initial: RunView }) {
  const [run, setRun] = useState(initial), [pending, setPending] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState<CombatRequest | null>(null), lock = useRef(false);
  const [notesEdit, setNotesEdit] = useState({ baseline: run.notes, value: run.notes }), [summary, setSummary] = useState("");
  const terminal = run.status === "COMPLETED" || run.status === "CANCELLED", disabled = pending || terminal || retry !== null;
  const notes = notesEdit.baseline === run.notes ? notesEdit.value : run.notes;
  const active = run.participants.find(p => p.id === run.activeParticipantId), order = initiativeOrder(run.participants), events = runEventsSchema.parse(run.events);
  async function send(command: CombatCommand, replay?: CombatRequest) {
    if (lock.current || terminal || (retry && !replay)) return;
    lock.current = true; setPending(true); setError("");
    const request = replay ?? { requestId: crypto.randomUUID(), expectedVersion: run.version, command };
    try {
      const result = await performCombatAction(run.campaignId, run.id, request);
      setRetry(null);
      if (!result.ok) setError(result.error);
      else { setRun(result.run); toast.success("Kampfstand gespeichert."); }
    } catch { setRetry(request); setError("Antwort nicht erhalten. Dieselbe Anfrage erneut senden oder den gespeicherten Stand aktualisieren."); }
    finally { lock.current = false; setPending(false); }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true; setPending(true);
    try { const fresh = await reloadEncounterRun(run.campaignId, run.id); if (!fresh) throw new Error(); setRun(fresh); setRetry(null); setError(""); }
    catch { setError("Kampfstand konnte nicht geladen werden. Bitte DM-Zugang prüfen und erneut versuchen."); }
    finally { lock.current = false; setPending(false); }
  }
  return <div className="combat-manager"><header className="combat-toolbar panel"><div><span className="tag">{encounterTypes[run.type]} · {runStatuses[run.status]} · VERSION {run.version}</span><h1>{run.name}</h1><h2>Runde {run.round} · {active ? `${active.name} ist am Zug` : run.status === "PREPARING" ? "Initiative vorbereiten" : "Kein aktiver Kampfteilnehmer"}</h2></div><div className="combat-buttons"><button className="button ghost" disabled={pending} onClick={() => void reload()}>Stand aktualisieren</button>{run.status === "PREPARING" && <><button className="button ghost" disabled={disabled || !run.participants.some(p => p.maxHp !== null)} onClick={() => void send({ kind: "ROLL_INITIATIVE" })}>Alle Initiativen würfeln</button><button className="button primary" disabled={disabled} onClick={() => void send({ kind: "BEGIN" })}>Begegnung starten</button></>}{run.status === "ACTIVE" && <button className="button primary" disabled={disabled || !active} onClick={() => void send({ kind: "NEXT" })}>Nächster Zug</button>}</div></header>
    <p className="muted">Alle Änderungen gelten ausschliesslich für diesen Run. Charakterbögen, NPCs und Bestiary-Vorlagen bleiben unverändert. Weitere DM-Tabs über „Stand aktualisieren“ abgleichen.</p>
    {pending && <p role="status">Kampfstand wird gespeichert …</p>}{error && <p className="accent" role="alert">{error}</p>}{retry && <button className="button primary" disabled={pending} onClick={() => void send(retry.command, retry)}>Letzte Anfrage erneut senden</button>}
    <section className="panel form"><h2>Initiative-Reihenfolge</h2><ol className="initiative-list">{order.map(p => <li key={p.id} className={p.id === run.activeParticipantId ? "is-active" : ""}><a href={`#participant-${p.id}`}>{p.initiative ?? "–"} · {p.name}{p.defeated ? " · Besiegt" : ""}{p.unconscious ? " · Bewusstlos" : ""}{p.maxHp === null ? " · Erzählteilnehmer" : ""}</a></li>)}</ol><p className="muted">Gleichstand: höherer Initiativebonus, danach gespeicherte Teilnehmerreihenfolge. Besiegte, bewusstlose Teilnehmer und 0 HP werden beim nächsten Zug übersprungen. Andere Zustände beenden keinen Zug automatisch.</p></section>
    <div className="combat-participants">{order.map(p => <div id={`participant-${p.id}`} key={p.id}><CombatParticipant campaignId={run.campaignId} participant={p} active={p.id === run.activeParticipantId} preparing={run.status === "PREPARING"} disabled={disabled} send={command => void send(command)} /></div>)}</div>
    <section className="panel form"><h2>Vorbereitete Ereignisse</h2>{events.length ? events.map(event => <div key={event.id}><label className="check"><input type="checkbox" disabled={disabled} checked={event.done} onChange={e => void send({ kind: "EVENT", eventId: event.id, done: e.target.checked })} />{event.title}</label><p>Auslöser: {event.trigger || "Nach Entscheidung des DMs"}</p><p className="people-prose">{event.description}</p></div>) : <p>Keine vorbereiteten Ereignisse.</p>}</section>
    <section className="panel form"><h2>Run-Notizen</h2><p className="people-prose">{run.description}</p>{run.locationName && <p>Ort: {run.locationName}</p>}<details><summary>Übernommene DM-Notizen</summary><p className="people-prose">{run.dmNotes}</p></details><form onSubmit={e => { e.preventDefault(); void send({ kind: "RUN_NOTES", notes }); }}><label>Laufende Notizen<textarea maxLength={10000} disabled={disabled} value={notes} onChange={e => setNotesEdit({ baseline: run.notes, value: e.target.value })} /></label><button className="button ghost" disabled={disabled}>Run-Notizen speichern</button></form></section>
    {terminal ? <section className="panel form"><h2>{runStatuses[run.status]}</h2><p className="people-prose">{run.summary || "Keine Abschlussnotiz."}</p><p className="muted">Dieser Run bleibt als schreibgeschützte Historie erhalten. Die Vorlage kann erneut durchgeführt werden.</p></section> : <section className="panel form"><h2>Durchführung beenden</h2><label>Abschlussnotizen<textarea maxLength={10000} disabled={disabled} value={summary} onChange={e => setSummary(e.target.value)} /></label><div className="combat-buttons">{run.status === "ACTIVE" && <button className="button primary" disabled={disabled} onClick={() => { if (window.confirm("Begegnung abschliessen? Dieser Run wird danach schreibgeschützt.")) void send({ kind: "COMPLETE", summary }); }}>Begegnung abschliessen</button>}<button className="button ghost" disabled={disabled} onClick={() => { if (window.confirm("Durchführung abbrechen und als Historie erhalten?")) void send({ kind: "CANCEL", summary }); }}>Durchführung abbrechen</button></div></section>}
  </div>;
}
