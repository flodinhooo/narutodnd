"use client";

import { useState } from "react";
import type { EncounterParticipantPlan } from "@prisma/client";
import { encounterSides, planOverridesSchema } from "@/lib/encounters";
import { EncounterOptions } from "./EncounterForm";
import PeopleForm from "./PeopleForm";

type Options = { enemies: { id: string; name: string }[]; characters: { id: string; name: string }[]; npcs: { id: string; name: string }[] };
export default function EncounterParticipantForm({ action, options, initial }: { action: (fd: FormData) => Promise<string | void>; options: Options; initial?: EncounterParticipantPlan }) {
  const overrides = initial ? planOverridesSchema.parse(initial.overrides) : {};
  const [values, setValues] = useState<Record<string, string>>({ source: initial?.enemyTemplateId ? "ENEMY" : initial?.characterId ? "CHARACTER" : initial?.npcId ? "NPC" : "ENEMY", sourceId: initial?.enemyTemplateId ?? initial?.characterId ?? initial?.npcId ?? "", quantity: String(initial?.quantity ?? 1), side: initial?.side ?? "HOSTILE", notes: initial?.notes ?? "", ...Object.fromEntries(["name", "maxHp", "maxChakra", "ac", "initiativeBonus"].map(key => [`override_${key}`, String(overrides[key as keyof typeof overrides] ?? "")])) });
  const field = (name: string) => ({ name, value: values[name], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues(old => ({ ...old, [name]: e.target.value, ...(name === "source" ? { sourceId: "", quantity: "1" } : {}) })) });
  const choices = values.source === "ENEMY" ? options.enemies : values.source === "NPC" ? options.npcs : options.characters;
  return <PeopleForm action={action} className="panel form encounter-form"><div className="two"><label>Quelle<select {...field("source")}><option value="ENEMY">Bestiary / Tiere / eigene Gegner</option><option value="NPC">NPC / Zivilist</option><option value="CHARACTER">Spielercharakter</option></select></label><label>Teilnehmer<select {...field("sourceId")} required><option value="">Auswählen</option>{values.sourceId && !choices.some(c => c.id === values.sourceId) && <option value={values.sourceId}>Quelle nicht mehr verfügbar – bitte ersetzen</option>}{choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    <div className="two"><label>Anzahl<input name="quantity" type="number" min={1} max={values.source === "ENEMY" ? 20 : 1} required value={values.source === "ENEMY" ? values.quantity : "1"} onChange={field("quantity").onChange} /></label><label>Seite<select {...field("side")}><EncounterOptions values={encounterSides} /></select></label></div>
    <details><summary>Abweichende Werte (optional)</summary><p className="muted">Gelten für diese vorbereitete Gruppe. Für individuelle Werte dieselbe Gegnervorlage in mehreren Einträgen hinzufügen. Ein Zivilist erhält erst mit einem HP-Override Kampfwerte; Chakra wird dadurch nicht hinzugefügt.</p><label>Anzeigename<input {...field("override_name")} maxLength={200} /></label><div className="two">{([["maxHp", "Maximale HP", 1, 1000000], ["ac", "AC", 0, 100], ["initiativeBonus", "Initiativebonus", -30, 50], ["maxChakra", "Maximales Chakra", 1, 1000000]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input {...field(`override_${key}`)} type="number" min={min} max={max} /></label>)}</div></details>
    <label>Teilnehmernotizen<textarea {...field("notes")} maxLength={10000} /></label><button className="button primary">{initial ? "Teilnehmer speichern" : "Teilnehmer hinzufügen"}</button>
  </PeopleForm>;
}
