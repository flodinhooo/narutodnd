import Link from "next/link";
import {notFound} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {getSession} from "@/lib/session";
import {campaignJutsuScope, playerJutsuScope} from "@/lib/jutsu-access";
import {actionLabel,jutsuTitle,jutsuSummary,techniqueType,jutsuUsages} from "@/lib/jutsu-content";
import JutsuRules from "@/components/JutsuRules";
import {setJutsuRelease} from "@/app/campaign/jutsu-library-actions";
export default async function JutsuPage({params}:{params:Promise<{campaignId:string;slug:string}>}){
 const {campaignId,slug}=await params;const session=await getSession();if(!session||session.campaignId!==campaignId)notFound();const dm=session.role==="DM";
 const campaign=await prisma.campaign.findUniqueOrThrow({where:{id:campaignId},select:{jutsuLibraryAccess:true}});
 const scope=dm?campaignJutsuScope(campaignId):{AND:[playerJutsuScope(campaignId),...(campaign.jutsuLibraryAccess!=="OPEN"?[{characterLinks:{some:{character:{campaignId,npc:null}}}}]:[])]};
 const j=await prisma.jutsu.findFirst({where:{AND:[scope,{slug}]},include:{natures:{include:{nature:true}},releases:{where:{campaignId}}}});if(!j)notFound();
 const [pre,unlocks]=await Promise.all([prisma.jutsuPrerequisite.findMany({where:{jutsuId:j.id,prerequisiteJutsu:scope},include:{prerequisiteJutsu:true}}),prisma.jutsuPrerequisite.findMany({where:{prerequisiteJutsuId:j.id,jutsu:scope},include:{jutsu:true}})]);
 return <main className="shell narrow"><Link className="back" href={`/campaign/${campaignId}/jutsu-library`} >← Jutsu-Bibliothek</Link><div className="eyebrow">RANG {j.rank} · {techniqueType(j.category)}</div><h1>{jutsuTitle(j)}</h1><div className="jutsu-tags">{jutsuUsages(j).map(t=><span key={t}>{t}</span>)}</div><p>{jutsuSummary(j.description)}</p>
 <dl className="panel jutsu-facts">{[["Chakra",j.chakraCost],["Aktion",actionLabel(j.actionType)],["Natur",j.natures.map(n=>n.nature.displayName).join(", ")||"Ohne Elementbindung"],["Reichweite",actionLabel(j.range)],["Dauer",actionLabel(j.duration)],["Angriff",j.attackType||"—"],["Schaden",j.damageDice||"—"],["Rettungswurf",j.saveAbility||"—"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
 <section className="panel"><h2>Wirkung &amp; Spielregeln</h2><JutsuRules description={j.description}/></section>
 {pre.length>0&&<section><h2>Voraussetzungen</h2>{pre.map(p=><p key={p.prerequisiteJutsuId}><Link href={`/campaign/${campaignId}/jutsu-library/${p.prerequisiteJutsu.slug}`}>{jutsuTitle(p.prerequisiteJutsu)}</Link></p>)}</section>}
 {unlocks.length>0&&<section><h2>Entwicklungspfad</h2>{unlocks.map(p=><p key={p.jutsuId}><Link href={`/campaign/${campaignId}/jutsu-library/${p.jutsu.slug}`}>{jutsuTitle(p.jutsu)}</Link></p>)}</section>}
 {dm&&<section className="panel form"><h2>Spielleitung</h2><p>Originalname: {j.name} · {j.japaneseName}</p><p>{j.reviewNeeded?"Dieser Import muss vor der Freigabe geprüft werden.":j.dmOnly?"Geheime Technik – nur für die Spielleitung.":j.releases.length?"Für Spieler freigegeben.":"Nicht für Spieler freigegeben."}</p>{!j.reviewNeeded&&!j.dmOnly&&<form action={setJutsuRelease.bind(null,campaignId,j.id)}><input type="hidden" name="release" value={j.releases.length?"no":"yes"}/><button className="button primary">{j.releases.length?"Freigabe entziehen":"Für Spieler freigeben"}</button></form>}{j.prerequisiteText&&<p>Quellangabe zu Voraussetzungen: {j.prerequisiteText}</p>}{j.sourceMarkdown&&<details><summary>Originalquelle zur Prüfung</summary><pre className="jutsu-source">{j.sourceMarkdown}</pre></details>}</section>}</main>;
}
