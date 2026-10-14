import Link from "next/link";
import { notFound } from "next/navigation";
import { getEncounterRun } from "@/lib/encounter-library";
import CombatManager from "@/components/CombatManager";
import { prisma } from "@/lib/prisma";

export default async function EncounterRunPage({ params }: { params: Promise<{ campaignId: string; runId: string }> }) {
  const { campaignId, runId } = await params, run = await getEncounterRun(campaignId, runId);
  if (!run) notFound();
  const [missions, sessions] = await Promise.all([
    prisma.mission.findMany({ where: { campaignId, runs: { some: { runId } } }, select: { id: true, title: true } }),
    prisma.gameSession.findMany({ where: { campaignId, encounterRunLinks: { some: { runId } } }, select: { id: true, number: true, title: true } }),
  ]);
  return <main className="shell"><nav className="actions" aria-label="Zurück zur Vorbereitung"><Link className="back" href={`/campaign/${campaignId}/encounters/${run.encounterId}`}>← Encounter-Vorlage</Link>{missions.map(m => <Link key={m.id} href={`/campaign/${campaignId}/missions/${m.id}`}>← Mission: {m.title}</Link>)}{sessions.map(s => <Link key={s.id} href={`/campaign/${campaignId}/sessions/${s.id}`}>← Session {s.number}: {s.title}</Link>)}</nav><CombatManager initial={run} key={run.id} /></main>;
}
