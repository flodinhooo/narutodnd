"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { performMissionAction } from "@/app/campaign/mission-actions";
import type { MissionCommand } from "@/lib/missions";
export default function MissionCommandButton({ campaignId, missionId, version, command, children, confirmation }: { campaignId: string; missionId: string; version: number; command: MissionCommand; children: React.ReactNode; confirmation?: string }) {
  const router = useRouter(), busy = useRef(false), requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  async function submit() {
    if (busy.current || (confirmation && !window.confirm(confirmation))) return;
    busy.current = true; setPending(true); setError(""); requestId.current ??= crypto.randomUUID();
    try {
      const result = await performMissionAction(campaignId, missionId, { requestId: requestId.current, expectedVersion: version, command });
      if (!result.ok) { setError(result.error); requestId.current = null; }
      else { toast.success("Gespeichert."); if (result.url) router.push(result.url); router.refresh(); }
    } catch { setError("Antwort nicht erhalten. Erneutes Klicken sendet dieselbe Anfrage sicher erneut. Bei abgelaufenem Zugang neu anmelden."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div><button type="button" className="button ghost" disabled={pending} onClick={() => void submit()}>{pending ? "Wird gespeichert …" : children}</button>{error && <p role="alert" className="accent">{error} <button type="button" className="button ghost" onClick={() => router.refresh()}>Stand aktualisieren</button></p>}</div>;
}
