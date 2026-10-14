"use client";
import { useState } from "react";
import PeopleForm, { type FormAction } from "./PeopleForm";
import { consequenceKinds } from "@/lib/missions";
import { attitudes } from "@/lib/campaign-people";
import type { DmMission } from "@/lib/mission-library";
type Consequence = DmMission["consequences"][number];
export default function ConsequenceForm({ action, initial, options }: { action: FormAction; initial?: Consequence; options: { npcs: { id: string; name: string }[]; organizations: { id: string; name: string }[]; missions: { id: string; title: string }[]; objectives: { id: string; title: string }[] } }) {
  const [kind, setKind] = useState(initial?.kind ?? "NPC_ATTITUDE"), [title, setTitle] = useState(initial?.title ?? ""), [description, setDescription] = useState(initial?.description ?? ""), [value, setValue] = useState(initial?.value ?? "FRIENDLY");
  const [target, setTarget] = useState(initial?.npcId ?? initial?.organizationId ?? initial?.targetMissionId ?? initial?.objectiveId ?? "");
  const key = kind === "NPC_ATTITUDE" ? "npcId" : kind === "ORGANIZATION_ATTITUDE" ? "organizationId" : kind === "UNLOCK_OBJECTIVE" ? "objectiveId" : "targetMissionId";
  const choices = kind === "NPC_ATTITUDE" ? options.npcs.map(n => ({ id: n.id, label: n.name })) : kind === "ORGANIZATION_ATTITUDE" ? options.organizations.map(n => ({ id: n.id, label: n.name })) : (kind === "UNLOCK_OBJECTIVE" ? options.objectives : options.missions).map(n => ({ id: n.id, label: n.title }));
  return <PeopleForm action={action}><label>Konsequenz-Titel<input required name="title" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label><label>DM-Begründung<textarea name="description" maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} /></label><label>Konsequenztyp<select name="kind" value={kind} onChange={e => { setKind(e.target.value as typeof kind); setTarget(""); setValue(e.target.value === "REVEAL_INFORMATION" ? "" : "FRIENDLY"); }}>{Object.entries(consequenceKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Ziel<select name={key} required value={target} onChange={e => setTarget(e.target.value)}><option value="">Auswählen</option>{choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    {["NPC_ATTITUDE", "ORGANIZATION_ATTITUDE"].includes(kind) ? <label>Neue Haltung<select name="value" value={value} onChange={e => setValue(e.target.value)}>{Object.entries(attitudes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> : kind === "REVEAL_INFORMATION" ? <label>Ausdrücklich freizugebender Text<textarea name="value" required maxLength={10000} value={value} onChange={e => setValue(e.target.value)} /></label> : <input type="hidden" name="value" value="" />}
    <p className="muted">Speichern führt keine Änderung am Ziel aus. Erst die gesonderte Bestätigung wendet diese Konsequenz genau einmal an. Mission freischalten setzt den Zielentwurf auf „Verfügbar“ und gibt ihn für Spieler frei.</p><button className="button primary">Konsequenz vorbereiten</button></PeopleForm>;
}
