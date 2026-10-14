import Link from "next/link";
import { enemyBuilderOptions } from "@/lib/enemy-library";
import EnemyBuilder from "@/components/EnemyBuilder";
import { saveEnemyTemplate } from "@/app/campaign/enemy-actions";

export default async function NewEnemy({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const options = await enemyBuilderOptions(campaignId);
  async function save(fd: FormData) { "use server"; const id = await saveEnemyTemplate(campaignId, null, fd); return `/campaign/${campaignId}/bestiary/${id}`; }
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/bestiary`}>← Bestiary</Link><h1>Gegnervorlage erstellen</h1><EnemyBuilder action={save} {...options} /></main>;
}
