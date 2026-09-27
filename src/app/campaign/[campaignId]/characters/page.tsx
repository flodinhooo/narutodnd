import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { effectiveAc } from "@/lib/rules";

export default async function CharactersPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const session = await getSession();
  if (!session || session.campaignId !== campaignId) return <main className="shell"><h1>Unbefugt</h1></main>;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { characters: { include: { natureLinks: { include: { nature: true } } } } } });
  if (!campaign) return <main className="shell"><h1>Kampagne nicht gefunden</h1></main>;
  return <main className="shell"><header className="topbar"><div><div className="eyebrow">KAMPAGNE / {session.role === "DM" ? "DM" : "SPIELER"}</div><h1>Charaktere</h1><p className="muted">Die Shinobi dieser Kampagne.</p></div><Link href={`/campaign/${campaignId}/characters/new`} className="button primary">+ Charakter erstellen</Link></header>{campaign.characters.length === 0 ? <section className="panel empty"><h2>Noch keine Charaktere</h2><p className="muted">Erstelle den ersten Charakter für diese Kampagne.</p><Link href={`/campaign/${campaignId}/characters/new`} className="button primary">Ersten Charakter erstellen</Link></section> : <div className="grid">{campaign.characters.map(character => { const nature = character.natureLinks.find(x => x.isPrimary)?.nature.displayName ?? "Keine Natur"; return <Link className="panel character-card" key={character.id} href={`/campaign/${campaignId}/characters/${character.id}`}><span className="tag">{nature}</span><h3>{character.name}</h3><p className="muted">Stufe {character.level} · RK {effectiveAc(character.dex, character.acOverride)}</p><div className="bars"><b>TP {character.currentHp}/{character.maxHp}</b><b>Chakra {character.currentChakra}</b></div></Link>; })}</div>}</main>;
}
