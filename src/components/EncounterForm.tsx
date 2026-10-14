"use client";

import { useState } from "react";
import type { Encounter } from "@prisma/client";
import PeopleForm from "./PeopleForm";
import { encounterTypes, encounterStatuses, encounterEventsSchema } from "@/lib/encounters";
import { enemyDifficulties } from "@/lib/enemy-templates";

export function EncounterOptions({ values }: { values: Record<string, string> }) { return Object.entries(values).map(([key, label]) => <option key={key} value={key}>{label}</option>); }
export default function EncounterForm({ action, initial, locations }: { action: (fd: FormData) => Promise<string | void>; initial?: Encounter; locations: { id: string; name: string }[] }) {
  const [values, setValues] = useState<Record<string, string>>({ name: initial?.name ?? "", description: initial?.description ?? "", type: initial?.type ?? "COMBAT", difficulty: initial?.difficulty ?? "MODERATE", locationId: initial?.locationId ?? "", dmNotes: initial?.dmNotes ?? "", status: initial?.status ?? "DRAFT" });
  const [events, setEvents] = useState(initial ? encounterEventsSchema.parse(initial.events) : []);
  const field = (name: string) => ({ name, value: values[name], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues(v => ({ ...v, [name]: e.target.value })) });
  return <PeopleForm action={action} className="panel form encounter-form"><input type="hidden" name="version" value={initial?.version ?? 1} />
    <label>Name<input {...field("name")} required maxLength={200} /></label><label>Beschreibung<textarea {...field("description")} maxLength={10000} /></label>
    <div className="two"><label>Begegnungstyp<select {...field("type")}><EncounterOptions values={encounterTypes} /></select></label><label>Schwierigkeit<select {...field("difficulty")}><EncounterOptions values={enemyDifficulties} /></select></label></div>
    <div className="two"><label>Ort<select {...field("locationId")}><option value="">Kein Ort</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Status<select {...field("status")}><EncounterOptions values={encounterStatuses} /></select></label></div>
    <label>DM-Notizen<textarea {...field("dmNotes")} maxLength={10000} /></label><p className="muted">Kämpfe zuerst als Entwurf speichern, Teilnehmer hinzufügen und danach auf „Bereit“ setzen. Vorlagen und Durchführungen sind ausschliesslich für DMs sichtbar.</p>
    <h2>Vorbereitete Ereignisse</h2><input type="hidden" name="events" value={JSON.stringify(events)} />{events.map((event, index) => <fieldset className="encounter-event" key={event.id}><legend>Ereignis {index + 1}</legend>{([["title", "Titel"], ["trigger", "Auslöser"], ["description", "Ereignisbeschreibung"]] as const).map(([key, label]) => <label key={key}>{label}{key === "description" ? <textarea value={event[key]} maxLength={10000} onChange={e => setEvents(rows => rows.map(row => row.id === event.id ? { ...row, [key]: e.target.value } : row))} /> : <input required={key === "title"} maxLength={key === "title" ? 200 : 500} value={event[key]} onChange={e => setEvents(rows => rows.map(row => row.id === event.id ? { ...row, [key]: e.target.value } : row))} />}</label>)}<div className="actions"><button type="button" className="button ghost" disabled={index === 0} onClick={() => setEvents(rows => { const copy = [...rows]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; return copy; })}>Nach oben</button><button type="button" className="button ghost" onClick={() => setEvents(rows => rows.filter(row => row.id !== event.id))}>Ereignis entfernen</button></div></fieldset>)}
    <button type="button" className="button ghost" disabled={events.length >= 50} onClick={() => setEvents([...events, { id: crypto.randomUUID(), title: "", trigger: "", description: "" }])}>Ereignis hinzufügen</button><button className="button primary">Begegnung speichern</button>
  </PeopleForm>;
}
