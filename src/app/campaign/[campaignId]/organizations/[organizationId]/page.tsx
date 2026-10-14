import Portrait from "@/components/Portrait";
import { missionFormResult } from "@/lib/mission-form-result";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCampaign } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { organizationTypes, publicOrganizationSelect } from "@/lib/campaign-people";
import { archiveOrganization, saveOrganization, setOrganizationMember, removeOrganizationMember } from "@/app/campaign/people-actions";
import PeopleForm from "@/components/PeopleForm";
import { OrganizationFields } from "@/components/PeopleFields";

export default async function OrganizationDetail({ params }: { params: Promise<{ campaignId: string; organizationId: string }> }) {
  const { campaignId, organizationId } = await params;
  const session = await requireCampaign(campaignId), dm = session.role === "DM";
  const publicOrg = await prisma.organization.findFirst({ where: { id: organizationId, campaignId, ...(!dm ? { playerVisible: true, archived: false } : {}) }, select: publicOrganizationSelect });
  if (!publicOrg) notFound();
  const internal = dm ? await prisma.organization.findFirstOrThrow({ where: { id: organizationId, campaignId }, include: { location: true } }) : null;
  const members = await prisma.organizationMember.findMany({ where: { organizationId,
    ...(!dm ? { OR: [{ npc: { campaignId, playerVisible: true, archived: false } }, { character: { campaignId, npc: null } }] } : {}),
  }, select: { id: true, role: true, isLeader: true, npc: { select: { id: true, name: true } }, character: { select: { id: true, name: true } } }, orderBy: [{ isLeader: "desc" }, { role: "asc" }] });
  const [locations, npcs, characters] = dm ? await Promise.all([
    prisma.location.findMany({ where: { campaignId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.npc.findMany({ where: { campaignId, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.character.findMany({ where: { campaignId, npc: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]) : [[], [], []];
  async function save(fd: FormData) { "use server"; return missionFormResult(() => saveOrganization(campaignId, organizationId, fd)); }
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/organizations`}>← Organisationen</Link><div className="eyebrow">{organizationTypes[publicOrg.type as keyof typeof organizationTypes]} {internal?.archived && "/ ARCHIV"}</div><h1>{publicOrg.name}</h1><p className="people-prose">{publicOrg.description}</p>
    <section className="panel form"><h2>Mitglieder</h2>{!members.length && <p>Keine freigegebenen Mitglieder.</p>}{members.map(m => <div key={m.id}><p><Portrait campaignId={campaignId} kind={m.npc ? "npc" : "character"} entityId={m.npc?.id ?? m.character!.id} name={m.npc?.name ?? m.character!.name} /><Link href={m.npc ? `/campaign/${campaignId}/npcs/${m.npc.id}` : `/campaign/${campaignId}/characters/${m.character!.id}`}>{m.npc?.name ?? m.character?.name}</Link> · {m.role} {m.isLeader && "(Leitung)"}</p>{dm && <PeopleForm className="" action={async () => { "use server"; return missionFormResult(() => removeOrganizationMember(campaignId, organizationId, m.id)); }} confirm="Mitglied aus der Organisation entfernen?"><button className="button ghost">Entfernen</button></PeopleForm>}</div>)}</section>
    {internal && <><section className="dm-panel people-prose"><h2>DM-Informationen</h2><p>{internal.notes}</p><p>{internal.dmSecrets}</p><p>{internal.playerVisible ? "Freigegeben" : "Verborgen"}</p>{internal.location && <Link href={`/campaign/${campaignId}/world/${internal.location.slug}`}>Hauptsitz: {internal.location.name}</Link>}</section>
      {!internal.archived && <PeopleForm action={async (fd: FormData) => { "use server"; return missionFormResult(() => setOrganizationMember(campaignId, organizationId, fd)); }}><h2>Mitglied hinzufügen / Rolle ändern</h2><label>Person<select name="person" required><option value="">Person auswählen</option>{npcs.map(n => <option key={n.id} value={`npc:${n.id}`}>{n.name}</option>)}{characters.map(c => <option key={c.id} value={`character:${c.id}`}>{c.name} (Charakter)</option>)}</select></label><label>Rolle<input name="role" maxLength={200} placeholder="z. B. Sensei, Schüler, Händler" /></label><label className="check"><input name="isLeader" type="checkbox" />Leitung / Sensei</label><button className="button primary">Mitglied speichern</button></PeopleForm>}
      <details className="panel form"><summary>Organisation bearbeiten</summary><PeopleForm action={save}><OrganizationFields organization={internal} locations={locations} /></PeopleForm></details>
      <PeopleForm action={async () => { "use server"; return missionFormResult(() => archiveOrganization(campaignId, organizationId, !internal.archived)); }} confirm={internal.archived ? undefined : "Organisation archivieren? Sie wird für Spieler ausgeblendet."}><button className="button ghost">{internal.archived ? "Wiederherstellen" : "Archivieren"}</button></PeopleForm>
    </>}
  </main>;
}
