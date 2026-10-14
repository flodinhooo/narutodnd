"use client";
import { useState } from "react";
import PeopleForm, { type FormAction } from "./PeopleForm";
export function SessionContentForm({ action, missions, runs }: { action: FormAction; missions: { id: string; title: string }[]; runs: { id: string; name: string; status: string }[] }) {
  const [kind, setKind] = useState("MISSION"), [id, setId] = useState("");
  return <PeopleForm action={action}><input type="hidden" name="assigned" value="true" /><label>Zuordnung<select name="kind" value={kind} onChange={e => { setKind(e.target.value); setId(""); }}><option value="MISSION">Mission</option><option value="RUN">Vorhandener Encounter Run</option></select></label><label>Inhalt<select name="id" value={id} required onChange={e => setId(e.target.value)}><option value="">Auswählen</option>{kind === "MISSION" ? missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>) : runs.map(r => <option key={r.id} value={r.id}>{r.name} · {r.status}</option>)}</select></label><button className="button primary">Der Session zuordnen</button></PeopleForm>;
}
export function SessionNotesForm({ action, session }: { action: FormAction; session: { title: string; summary: string; playerNotes: string; dmNotes: string; status: string; version: number } }) {
  const [values, setValues] = useState<Record<string, string>>({ title: session.title, summary: session.summary, playerNotes: session.playerNotes, dmNotes: session.dmNotes, status: session.status });
  const field = (key: string) => ({ name: key, value: values[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(v => ({ ...v, [key]: e.target.value })) });
  return <PeopleForm action={action}><input type="hidden" name="version" value={session.version} /><label>Session-Titel<input {...field("title")} required maxLength={200} /></label>{([["summary", "Öffentliche Zusammenfassung"], ["playerNotes", "Spielernotizen"], ["dmNotes", "DM-Notizen"]] as const).map(([key, label]) => <label key={key}>{label}<textarea {...field(key)} maxLength={10000} /></label>)}<label>Session-Status<select {...field("status")}><option value="PLANNED">Geplant</option><option value="ACTIVE">Aktiv</option><option value="COMPLETED">Abgeschlossen</option></select></label><button className="button primary">Session speichern</button></PeopleForm>;
}
