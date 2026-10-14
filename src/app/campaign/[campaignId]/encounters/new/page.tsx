import Link from "next/link";
import { encounterBuilderOptions } from "@/lib/encounter-library";
import { saveEncounter } from "@/app/campaign/encounter-actions";
import EncounterForm from "@/components/EncounterForm";

export default async function NewEncounter({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params, options = await encounterBuilderOptions(campaignId);
  async function save(fd: FormData) { "use server"; const id = await saveEncounter(campaignId, null, fd); return `/campaign/${campaignId}/encounters/${id}`; }
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/encounters`}>← Encounters</Link><h1>Encounter erstellen</h1><EncounterForm action={save} locations={options.locations} /></main>;
}
