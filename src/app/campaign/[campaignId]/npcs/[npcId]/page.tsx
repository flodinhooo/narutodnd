import PortraitManager from "@/components/PortraitManager";
import Portrait from "@/components/Portrait";
import { missionFormResult } from "@/lib/mission-form-result";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCampaign } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { attitudes, npcCategories, publicNpcSelect, relationshipTypes } from "@/lib/campaign-people";
import { archiveNpc, deleteNpc, enableNpcCombat, saveRelationship, deleteRelationship } from "@/app/campaign/people-actions";
import PeopleForm from "@/components/PeopleForm";
import { Options } from "@/components/PeopleFields";

export default async function NpcDetail({ params }: { params: Promise<{ campaignId: string; npcId: string }> }) {
  const { campaignId, npcId } = await params;
  const session = await requireCampaign(campaignId), dm = session.role === "DM";
  const publicNpc = await prisma.npc.findFirst({ where: { id: npcId, campaignId, ...(!dm ? { playerVisible: true, archived: false } : {}) }, select: publicNpcSelect });
  if (!publicNpc) notFound();
  // Secrets are fetched only after DM authorization and never cross a client boundary.
  const internal = dm ? await prisma.npc.findFirstOrThrow({ where: { id: npcId, campaignId }, include: { location: true } }) : null;
  const members = await prisma.organizationMember.findMany({ where: { npcId, organization: { campaignId, ...(!dm ? { playerVisible: true, archived: false } : {}) } }, select: { id: true, role: true, isLeader: true, organization: { select: { id: true, name: true } } } });
  const [npcs, characters, relationships] = dm ? await Promise.all([
    prisma.npc.findMany({ where: { campaignId, archived: false, id: { not: npcId } }, select: { id: true, name: true } }),
    prisma.character.findMany({ where: { campaignId, npc: null }, select: { id: true, name: true } }),
    prisma.characterRelationship.findMany({ where: { campaignId, OR: [{ sourceNpcId: npcId }, { targetNpcId: npcId }] }, include: { sourceNpc: { select: { name: true } }, targetNpc: { select: { name: true } }, sourceCharacter: { select: { name: true } }, targetCharacter: { select: { name: true } } } }),
  ]) : [[], [], []];
  async function remove(fd: FormData) { "use server"; return missionFormResult(async () => { await deleteNpc(campaignId, npcId, fd); return `/campaign/${campaignId}/npcs`; }); }
  async function relate(fd: FormData) { "use server"; fd.set("source", `npc:${npcId}`); return missionFormResult(() => saveRelationship(campaignId, fd)); }
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/npcs`}>← NPCs</Link><header className="topbar"><div><div className="eyebrow">{npcCategories[publicNpc.category as keyof typeof npcCategories]} {internal?.archived && " / ARCHIV"}</div><Portrait campaignId={campaignId} kind="npc" entityId={npcId} name={publicNpc.name} /><h1>{publicNpc.name}</h1><p>{publicNpc.occupation} · {publicNpc.affiliation}</p></div>{dm && <Link className="button primary" href={`/campaign/${campaignId}/npcs/${npcId}/edit`}>Bearbeiten</Link>}</header>
    <PortraitManager campaignId={campaignId} kind="npc" entityId={npcId} name={publicNpc.name} />{publicNpc.portraitUrl && <a className="button ghost" href={publicNpc.portraitUrl} target="_blank" rel="noopener noreferrer">Portrait öffnen</a>}
    <section className="panel form"><h2>Profil</h2><p className="people-prose">{publicNpc.description}</p><p>Alter: {publicNpc.age ?? "–"} · Geschlecht: {publicNpc.gender || "–"} · Wohnort: {publicNpc.residence || "–"}</p><p>Rang: {publicNpc.ninjaRank || "–"} · Dorf: {publicNpc.village || "–"} · Clan: {publicNpc.clan || "–"}</p><p className="people-prose">{publicNpc.publicNotes}</p></section>
    {publicNpc.characterId && <p><Link className="button primary" href={`/campaign/${campaignId}/characters/${publicNpc.characterId}`}>Interaktiven Charakterbogen öffnen</Link></p>}
    <section className="panel form"><h2>Organisationen</h2>{members.length ? members.map(m => <p key={m.id}><Link href={`/campaign/${campaignId}/organizations/${m.organization.id}`}>{m.organization.name}</Link> · {m.role} {m.isLeader && "(Leitung)"}</p>) : <p className="muted">Keine freigegebenen Mitgliedschaften.</p>}</section>
    {internal && <><section className="dm-panel people-prose"><h2>DM-Informationen</h2><p>Haltung: {attitudes[internal.attitude as keyof typeof attitudes]} · {internal.playerVisible ? "Freigegeben" : "Verborgen"}</p><h3>Hintergrund</h3><p>{internal.background}</p><h3>Persönlichkeit</h3><p>{internal.personality}</p><h3>Geheimnisse</h3><p>{internal.dmSecrets}</p>{internal.location && <Link href={`/campaign/${campaignId}/world/${internal.location.slug}`}>Ort: {internal.location.name}</Link>}</section>
      {!internal.characterId && <PeopleForm action={async (fd: FormData) => { "use server"; return missionFormResult(() => enableNpcCombat(campaignId, npcId, fd)); }}><h2>Shinobi-Charakterbogen hinzufügen</h2><p className="muted">Neuer Bogen: Stufe 1 mit Standardattributen und regelbasierten HP/Chakra. Attribute, Stufe, Jutsu und Naturen bearbeitest du anschliessend über die vorhandenen DM-Controls. Für gewöhnliche Zivilisten ist kein Bogen nötig.</p><label>Bestehenden Charakter verknüpfen (optional)<select name="characterId"><option value="">Neuen Shinobi-Bogen erstellen</option>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="button primary">Bogen hinzufügen</button></PeopleForm>}
      <section className="panel form"><h2>Gerichtete Beziehungen (DM)</h2>{relationships.map(r => <div key={r.id}><p>{r.sourceNpc?.name ?? r.sourceCharacter?.name} → {r.targetNpc?.name ?? r.targetCharacter?.name} · {relationshipTypes[r.type as keyof typeof relationshipTypes]}</p><p>{r.description}</p><p className="muted">DM: {r.dmSecrets}</p><PeopleForm className="" confirm="Diese Beziehung entfernen?" action={async () => { "use server"; return missionFormResult(() => deleteRelationship(campaignId, r.id)); }}><button className="button ghost">Entfernen</button></PeopleForm></div>)}</section>
      <PeopleForm action={relate}><h3>Beziehung anlegen / aktualisieren</h3><label>Zielperson<select name="target" required><option value="">Person auswählen</option>{npcs.map(n => <option key={n.id} value={`npc:${n.id}`}>{n.name}</option>)}{characters.map(c => <option key={c.id} value={`character:${c.id}`}>{c.name} (Charakter)</option>)}</select></label><label>Beziehung<select name="type"><Options values={relationshipTypes} /></select></label><label>Beschreibung<textarea name="description" maxLength={10000} /></label><label>DM-Geheimnisse<textarea name="dmSecrets" maxLength={10000} /></label><button className="button primary">Beziehung speichern</button></PeopleForm>
      <PeopleForm action={async () => { "use server"; return missionFormResult(() => archiveNpc(campaignId, npcId, !internal.archived)); }} confirm={internal.archived ? undefined : "NPC archivieren? Er wird für Spieler ausgeblendet."}><button className="button ghost">{internal.archived ? "Aus Archiv wiederherstellen" : "Archivieren"}</button></PeopleForm>
      {internal.archived && !internal.characterId && <PeopleForm action={remove} confirm="NPC und seine Mitgliedschaften und Beziehungen endgültig löschen?"><label>Zum endgültigen Löschen „{internal.name}“ eingeben<input name="confirmation" required autoComplete="off" /></label><button className="button ghost">Endgültig löschen</button></PeopleForm>}
    </>}
  </main>;
}
