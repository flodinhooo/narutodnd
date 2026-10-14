import { missionFormResult } from "@/lib/mission-form-result";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCampaign } from "@/lib/session";
import { relationshipTypes } from "@/lib/campaign-people";
import { saveRelationship, deleteRelationship } from "@/app/campaign/people-actions";
import PeopleForm from "@/components/PeopleForm";
import { Options } from "@/components/PeopleFields";

export default async function Relationships({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const s = await requireCampaign(campaignId), dm = s.role === "DM";
  const [relationships, npcs, characters] = await Promise.all([
    prisma.characterRelationship.findMany({ where: { campaignId, ...(!dm ? {
      playerVisible: true,
      AND: [
        { OR: [{ sourceNpc: { campaignId, playerVisible: true, archived: false } }, { sourceCharacter: { campaignId, npc: null } }] },
        { OR: [{ targetNpc: { campaignId, playerVisible: true, archived: false } }, { targetCharacter: { campaignId, npc: null } }] },
      ],
    } : {}) }, select: {
      id: true, type: true, description: true, playerVisible: true, ...(dm ? { dmSecrets: true } : {}),
      sourceNpc: { select: { name: true } }, targetNpc: { select: { name: true } },
      sourceCharacter: { select: { name: true } }, targetCharacter: { select: { name: true } },
    }, orderBy: { type: "asc" } }),
    dm ? prisma.npc.findMany({ where: { campaignId, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    dm ? prisma.character.findMany({ where: { campaignId, npc: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/organizations`}>← Organisationen</Link><h1>Beziehungen</h1><p className="muted">Beziehungen gelten in Pfeilrichtung. Eine Gegenbeziehung kann unabhängig angelegt werden.</p><div className="grid">{relationships.map(r => <section className="panel form" key={r.id}><h2>{r.sourceNpc?.name ?? r.sourceCharacter?.name} → {r.targetNpc?.name ?? r.targetCharacter?.name}</h2><span className="tag">{relationshipTypes[r.type as keyof typeof relationshipTypes]}</span><p className="people-prose">{r.description}</p>{dm && <><p className="muted">{r.playerVisible ? "Freigegeben" : "Verborgen"}</p><p className="people-prose">DM: {r.dmSecrets}</p><PeopleForm className="" action={async () => { "use server"; return missionFormResult(() => deleteRelationship(campaignId, r.id)); }} confirm="Beziehung entfernen?"><button className="button ghost">Entfernen</button></PeopleForm></>}</section>)}</div>{!relationships.length && <p className="panel empty">Keine freigegebenen Beziehungen.</p>}
    {dm && <PeopleForm action={async (fd: FormData) => { "use server"; return missionFormResult(() => saveRelationship(campaignId, fd)); }}><h2>Beziehung anlegen / aktualisieren</h2>{([ ["source", "Von"], ["target", "Zu"] ] as const).map(([name, label]) => <label key={name}>{label}<select name={name} required><option value="">Person auswählen</option>{npcs.map(n => <option value={`npc:${n.id}`} key={n.id}>{n.name}</option>)}{characters.map(c => <option value={`character:${c.id}`} key={c.id}>{c.name} (Charakter)</option>)}</select></label>)}<label>Beziehung<select name="type"><Options values={relationshipTypes} /></select></label><label>Beschreibung<textarea name="description" maxLength={10000} /></label><label>DM-Geheimnisse<textarea name="dmSecrets" maxLength={10000} /></label><label className="check"><input name="playerVisible" type="checkbox" />Für Spieler sichtbar (beide Personen müssen freigegeben sein)</label><p className="muted">Gleiche Ausgangsperson, Zielperson und Beziehungstyp aktualisieren den vorhandenen Eintrag.</p><button className="button primary">Beziehung speichern</button></PeopleForm>}
  </main>;
}
