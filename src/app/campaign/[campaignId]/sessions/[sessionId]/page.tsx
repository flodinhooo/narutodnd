import {SessionNotesForm} from "@/components/MissionSessionForms";
import {missionFormResult} from "@/lib/mission-form-result";
import SessionMissionPanel from "@/components/SessionMissionPanel";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { updateGameSession } from "@/app/campaign/campaign-actions";
const sessionStatuses = { PLANNED: "Geplant", ACTIVE: "Aktiv", COMPLETED: "Abgeschlossen" };
export default async function SessionPage({ params }: { params: Promise<{ campaignId: string; sessionId: string }> }) { const { campaignId, sessionId } = await params; const s = await getSession(); if (!s || s.campaignId !== campaignId) return <main className="shell"><h1>Unauthorized</h1></main>; const x = await prisma.gameSession.findFirst({ where: { id: sessionId, campaignId }, select: s.role === "DM" ? undefined : { id: true, number: true, title: true, summary: true, playerNotes: true, status: true } }); if (!x) return <main className="shell"><h1>Session nicht gefunden</h1></main>; async function saveNotes(fd:FormData){"use server";return missionFormResult(()=>updateGameSession(campaignId,sessionId,fd));} return <main className="shell"><div className="eyebrow">SESSION {x.number} · {sessionStatuses[x.status]}</div><h1>{x.title}</h1><p>{x.summary}</p><p className="panel form">{x.playerNotes || "Keine Notizen für Spieler."}</p>{s.role === "DM" && <SessionNotesForm key={x.version} action={saveNotes} session={x}/>}<SessionMissionPanel campaignId={campaignId} sessionId={sessionId}/></main>; }
