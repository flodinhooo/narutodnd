import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { atlasLocationDetail } from "@/lib/atlas-location";
export default async function LocationPage({ params }: { params: Promise<{ campaignId: string; slug: string }> }) {
  const { campaignId, slug } = await params, session = await getSession();
  if (!session || session.campaignId !== campaignId) return <main className="shell"><h1>Unbefugt</h1></main>;
  const record = await prisma.location.findFirst({ where: { campaignId, slug, ...(session.role !== "DM" ? { playerVisible: true } : {}) }, select: { id: true } });
  const data = record ? await atlasLocationDetail(campaignId, record.id) : null;
  if (!data) return <main className="shell"><h1>Ort nicht gefunden</h1></main>;
  const base = `/campaign/${campaignId}`;
  return <main className="shell"><Link className="back" href={`${base}/world`}>← Orte</Link>{data.parent && <p>In: <Link href={`${base}/world/${data.parent.slug}`}>{data.parent.name}</Link></p>}<h1>{data.location.name}</h1><p className="muted">{data.location.shortDescription}</p><section className="panel form"><p className="people-prose">{data.location.description}</p></section><section className="grid"><div className="panel form"><h2>Karten</h2>{data.maps.map(m => <Link key={m.id} href={`${base}/atlas/${m.id}`}>{m.name} →</Link>)}{!data.maps.length && <p>Keine freigegebene Detailkarte.</p>}</div><div className="panel form"><h2>Orte in der Umgebung</h2>{data.children.map(c => <Link key={c.id} href={`${base}/world/${c.slug}`}>{c.name}</Link>)}{!data.children.length && <p>Keine untergeordneten Orte.</p>}</div><div className="panel form"><h2>NPCs / Charaktere</h2>{data.npcs.map(n => <p key={n.id}><Link href={`${base}/npcs/${n.id}`}>{n.name}</Link>{n.characterId && <Link href={`${base}/characters/${n.characterId}`}> · Charakterbogen</Link>}</p>)}</div><div className="panel form"><h2>Organisationen</h2>{data.organizations.map(o => <Link key={o.id} href={`${base}/organizations/${o.id}`}>{o.name}</Link>)}</div><div className="panel form"><h2>Missionen</h2>{data.missions.map(m => <Link key={m.id} href={`${base}/missions/${m.id}`}>{m.rank}-Rang · {m.title}</Link>)}</div>{session.role === "DM" && <div className="panel form"><h2>Encounters</h2>{data.encounters.map(e => <Link key={e.id} href={`${base}/encounters/${e.id}`}>{e.name}</Link>)}</div>}</section></main>;
}
