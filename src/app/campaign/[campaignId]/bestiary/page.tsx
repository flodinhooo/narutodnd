import Portrait from "@/components/Portrait";
export const metadata = { title: "Bestiary" };
import Link from "next/link";
import { listEnemyTemplates } from "@/lib/enemy-library";
import { enemyCategories, enemyDifficulties, enemyRanks } from "@/lib/enemy-templates";
import { effectiveAc } from "@/lib/rules";
import { enemyMaxChakra } from "@/lib/rules/enemies";

export default async function Bestiary({ params, searchParams }: {
  params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { campaignId } = await params, query = await searchParams;
  const filter = (key: string) => typeof query[key] === "string" ? (query[key] as string).slice(0, 200) : "";
  const enemies = await listEnemyTemplates(campaignId, Object.fromEntries(["q", "category", "difficulty", "rank", "scope", "archived"].map(key => [key, filter(key)])));
  return <main className="shell"><header className="topbar"><div><div className="eyebrow">KAMPAGNE / DM-BESTIARY</div><h1>Bestiary</h1><p className="muted">Wiederverwendbare Gegner und Tiere für deine Begegnungen.</p></div><Link className="button primary" href={`/campaign/${campaignId}/bestiary/new`}>Gegnervorlage erstellen</Link></header>
    <form className="filter-row"><input name="q" aria-label="Gegner suchen" placeholder="Name oder Beschreibung suchen" defaultValue={filter("q")} />{([["category", "Alle Kategorien", enemyCategories], ["difficulty", "Alle Schwierigkeiten", enemyDifficulties], ["rank", "Alle Ninja-Ränge", enemyRanks]] as const).map(([name, title, labels]) => <select key={name} name={name} aria-label={title} defaultValue={filter(name)}><option value="">{title}</option>{name === "rank" && <option value="none">Ohne Ninja-Rang</option>}{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>)}<select name="scope" aria-label="Herkunft" defaultValue={filter("scope")}><option value="">Alle Vorlagen</option><option value="global">Globale Bibliothek</option><option value="campaign">Eigene Kampagne</option></select><label className="check"><input type="checkbox" name="archived" value="true" defaultChecked={filter("archived") === "true"} />Archiv</label><button className="button primary">Filtern</button><Link className="button ghost" href={`/campaign/${campaignId}/bestiary`}>Zurücksetzen</Link></form>
    <p className="muted">{enemies.length} Vorlagen · Globale Vorlagen zum Anpassen zuerst duplizieren.</p><div className="grid">{enemies.map(e => <Link className="panel character-card" key={e.id} href={`/campaign/${campaignId}/bestiary/${e.id}`}><span className="tag">{enemyCategories[e.category]} · {enemyDifficulties[e.difficulty]}</span><Portrait campaignId={campaignId} kind="enemy" entityId={e.id} name={e.name} /><h2>{e.name}</h2><p className="muted">{e.campaignId ? "Kampagnenvorlage" : "Globale Vorlage"} · {e.ninjaRank ? enemyRanks[e.ninjaRank] : "Ohne Ninja-Rang"} · Empfohlen: Stufe {e.recommendedLevelMin}–{e.recommendedLevelMax}</p><div className="bars"><b>HP {e.maxHp} · AC {effectiveAc(e.dex, e.acOverride)}</b><b>{e.hasChakra ? `Chakra ${enemyMaxChakra(e)}` : "Ohne Chakra"}</b></div></Link>)}</div>{!enemies.length && <section className="panel empty"><h2>Keine passenden Vorlagen</h2><p>Filter anpassen oder eine eigene Vorlage erstellen. Die globale Bibliothek wird mit dem Datenbank-Seed geladen.</p></section>}
  </main>;
}
