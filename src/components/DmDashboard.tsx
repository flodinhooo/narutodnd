import Link from "next/link";
import { getDmDashboard } from "@/lib/dm-dashboard";
import { missionStatuses } from "@/lib/missions";
import { runStatuses } from "@/lib/encounters";

export default async function DmDashboard({ campaignId }: { campaignId: string }) {
  const { sessions, missions, runs } = await getDmDashboard(campaignId);
  const base = `/campaign/${campaignId}`;
  return <section aria-label="DM-Schnellzugriff">
    <h2>Session-Leitstand</h2>
    <div className="actions">
      <Link className="button ghost" href={`${base}/npcs`}>NPCs auswählen</Link>
      <Link className="button ghost" href={`${base}/organizations`}>Teams &amp; Organisationen</Link>
      <Link className="button ghost" href={`${base}/bestiary`}>Bestiary</Link>
      <Link className="button ghost" href={`${base}/missions`}>Missionen &amp; Vorlagen</Link>
      <Link className="button ghost" href={`${base}/encounters`}>Encounters</Link>
    </div>
    <div className="grid dm-dashboard">
      <section className="panel form"><h3>Aktive und geplante Sessions</h3>{sessions.length ? sessions.map(s => <Link key={s.id} href={`${base}/sessions/${s.id}`}><strong>{s.status === "ACTIVE" ? "Aktiv" : "Geplant"} · Session {s.number}</strong><span>{s.title}</span></Link>) : <p>Noch keine Session vorbereitet.</p>}<Link href={`${base}/sessions`}>Sessions verwalten / vorbereiten →</Link></section>
      <section className="panel form"><h3>Aktuelle Missionen</h3>{missions.length ? missions.map(m => <Link key={m.id} href={`${base}/missions/${m.id}`}><strong>{m.rank}-Rang · {m.title}</strong><span>{missionStatuses[m.status]} · {m.objectives.filter(o => o.status === "COMPLETED").length}/{m.objectives.length} Pflichtziele</span></Link>) : <p>Keine angenommene oder aktive Mission.</p>}<Link href={`${base}/missions`}>Mission auswählen / importieren →</Link></section>
      <section className="panel form"><h3>Laufende Begegnungen</h3>{runs.length ? runs.map(r => <Link key={r.id} href={`${base}/encounters/runs/${r.id}`}><strong>{r.name}</strong><span>{runStatuses[r.status]} · Runde {r.round}</span></Link>) : <p>Kein vorbereiteter oder laufender Run.</p>}<Link href={`${base}/encounters`}>Encounter vorbereiten →</Link></section>
    </div>
  </section>;
}
