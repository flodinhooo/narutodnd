export const metadata = { title: "Teams und Organisationen" };
import { missionFormResult } from "@/lib/mission-form-result";
import Link from "next/link";
import { requireCampaign } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { organizationTypes, publicOrganizationSelect } from "@/lib/campaign-people";
import { saveOrganization } from "@/app/campaign/people-actions";
import PeopleForm from "@/components/PeopleForm";
import { Options, OrganizationFields } from "@/components/PeopleFields";

export default async function Organizations({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { campaignId } = await params;
  const session = await requireCampaign(campaignId), dm = session.role === "DM", query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 200) : "", type = typeof query.type === "string" ? query.type : "";
  const archived = dm && query.archived === "true";
  const [organizations, locations] = await Promise.all([
    prisma.organization.findMany({ where: { campaignId, archived, ...(!dm ? { playerVisible: true } : {}), ...(q ? { name: { contains: q } } : {}), ...(type ? { type } : {}) }, select: publicOrganizationSelect, orderBy: { name: "asc" } }),
    dm ? prisma.location.findMany({ where: { campaignId }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  async function create(fd: FormData) { "use server"; return missionFormResult(async () => { const id = await saveOrganization(campaignId, null, fd); return `/campaign/${campaignId}/organizations/${id}`; }); }
  return <main className="shell"><h1>Teams & Organisationen</h1><form className="filter-row"><input name="q" aria-label="Name suchen" placeholder="Name suchen" defaultValue={q} /><select name="type" aria-label="Organisationstyp" defaultValue={type}><option value="">Alle Typen</option><Options values={organizationTypes} /></select>{dm && <label className="check"><input type="checkbox" name="archived" value="true" defaultChecked={archived} />Archiv</label>}<button className="button primary">Filtern</button></form>
    <p><Link className="button ghost" href={`/campaign/${campaignId}/organizations/relationships`}>Charakterbeziehungen verwalten</Link></p>
    {!organizations.length && <p className="panel empty">Keine passenden Organisationen gefunden.</p>}<div className="grid">{organizations.map(o => <Link className="panel character-card" key={o.id} href={`/campaign/${campaignId}/organizations/${o.id}`}><span className="tag">{organizationTypes[o.type as keyof typeof organizationTypes]}</span><h3>{o.name}</h3><p>{o.description}</p></Link>)}</div>
    {dm && <details className="panel form"><summary>Organisation erstellen</summary><PeopleForm action={create}><OrganizationFields locations={locations} /></PeopleForm></details>}
  </main>;
}
