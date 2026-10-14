import type { Npc, Organization } from "@prisma/client";
import { attitudes, npcCategories, organizationTypes } from "@/lib/campaign-people";

export function Options({ values }: { values: Record<string, string> }) {
  return Object.entries(values).map(([key, label]) => <option value={key} key={key}>{label}</option>);
}
export function LocationField({ locations, value }: { locations: { id: string; name: string }[]; value?: string | null }) {
  return <label>Ort<select name="locationId" defaultValue={value ?? ""}><option value="">Kein Ort</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>;
}
export function NpcFields({ npc, locations }: { npc?: Npc; locations: { id: string; name: string }[] }) {
  return <>
    <label>Name<input name="name" required maxLength={200} defaultValue={npc?.name} /></label>
    <div className="two"><label>Kategorie<select name="category" defaultValue={npc?.category ?? "CIVILIAN"}><Options values={npcCategories} /></select></label><label>Haltung<select name="attitude" defaultValue={npc?.attitude ?? "NEUTRAL"}><Options values={attitudes} /></select></label></div>
    <div className="two"><label>Alter (optional)<input name="age" type="number" min={0} max={10000} defaultValue={npc?.age ?? ""} /></label><label>Geschlecht (optional)<input name="gender" maxLength={200} defaultValue={npc?.gender} /></label></div>
    {([ ["description", "Öffentliche Beschreibung"], ["background", "Hintergrund (DM)"], ["personality", "Persönlichkeit (DM)"] ] as const).map(([key, label]) => <label key={key}>{label}<textarea name={key} maxLength={10000} defaultValue={npc?.[key]} /></label>)}
    <div className="two">{([["occupation", "Beruf"], ["residence", "Wohnort"], ["affiliation", "Zugehörigkeit"], ["ninjaRank", "Ninja-Rang (optional)"], ["village", "Herkunftsdorf"], ["clan", "Clan"]] as const).map(([key, label]) => <label key={key}>{label}<input name={key} maxLength={200} defaultValue={npc?.[key]} /></label>)}</div>
    <LocationField locations={locations} value={npc?.locationId} />
    <label>Portrait-URL (HTTP/HTTPS)<input name="portraitUrl" type="url" maxLength={2000} defaultValue={npc?.portraitUrl} /></label>
    <label>Öffentliche Notizen<textarea name="publicNotes" maxLength={10000} defaultValue={npc?.publicNotes} /></label>
    <label>DM-Geheimnisse<textarea name="dmSecrets" maxLength={10000} defaultValue={npc?.dmSecrets} /></label>
    <label className="check"><input name="playerVisible" type="checkbox" defaultChecked={npc?.playerVisible} />Für Spieler sichtbar</label>
    <button className="button primary">NPC speichern</button>
  </>;
}
export function OrganizationFields({ organization, locations }: { organization?: Organization; locations: { id: string; name: string }[] }) {
  return <>
    <label>Name<input name="name" required maxLength={200} defaultValue={organization?.name} /></label>
    <label>Typ<select name="type" defaultValue={organization?.type ?? "TEAM"}><Options values={organizationTypes} /></select></label>
    <label>Öffentliche Beschreibung<textarea name="description" maxLength={10000} defaultValue={organization?.description} /></label>
    <LocationField locations={locations} value={organization?.locationId} />
    <label>Teamnotizen (DM)<textarea name="notes" maxLength={10000} defaultValue={organization?.notes} /></label>
    <label>DM-Geheimnisse<textarea name="dmSecrets" maxLength={10000} defaultValue={organization?.dmSecrets} /></label>
    <label className="check"><input name="playerVisible" type="checkbox" defaultChecked={organization?.playerVisible} />Für Spieler sichtbar</label>
    <button className="button primary">Organisation speichern</button>
  </>;
}
