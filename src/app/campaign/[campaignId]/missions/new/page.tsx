import Link from "next/link";
import { missionOptions } from "@/lib/mission-library";
import { saveMission } from "@/app/campaign/mission-actions";
import { missionFormResult } from "@/lib/mission-form-result";
import MissionForm from "@/components/MissionForm";
export default async function NewMission({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params, options = await missionOptions(campaignId);
  async function save(fd: FormData) { "use server"; return missionFormResult(async () => { const id = await saveMission(campaignId, null, fd); return `/campaign/${campaignId}/missions/${id}`; }); }
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/missions`}>← Mission Board</Link><h1>Mission erstellen</h1><MissionForm action={save} options={options} /></main>;
}
