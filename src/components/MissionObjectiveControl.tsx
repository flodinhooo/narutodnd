"use client";
import { useState } from "react";
import type { ObjectiveStatus } from "@prisma/client";
import { objectiveStatuses } from "@/lib/missions";
import MissionCommandButton from "./MissionCommandButton";
export default function MissionObjectiveControl({ campaignId, missionId, version, objectiveId, initial }: { campaignId: string; missionId: string; version: number; objectiveId: string; initial: ObjectiveStatus }) {
  const [status, setStatus] = useState(initial);
  return <div className="combat-inline"><label>Zielstatus<select value={status} onChange={e => setStatus(e.target.value as ObjectiveStatus)}>{Object.entries(objectiveStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><MissionCommandButton campaignId={campaignId} missionId={missionId} version={version} command={{ kind: "OBJECTIVE", objectiveId, status }}>Zielstatus speichern</MissionCommandButton></div>;
}
