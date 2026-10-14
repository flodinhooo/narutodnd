import Link from "next/link";
import { notFound } from "next/navigation";
import { enemyBuilderOptions, getEnemyTemplate } from "@/lib/enemy-library";
import EnemyBuilder from "@/components/EnemyBuilder";
import { saveEnemyTemplate } from "@/app/campaign/enemy-actions";

export default async function EditEnemy({ params }: { params: Promise<{ campaignId: string; templateId: string }> }) {
  const { campaignId, templateId } = await params;
  const enemy = await getEnemyTemplate(campaignId, templateId);
  if (!enemy || enemy.campaignId !== campaignId) notFound();
  const options = await enemyBuilderOptions(campaignId);
  async function save(fd: FormData) { "use server"; await saveEnemyTemplate(campaignId, templateId, fd); return `/campaign/${campaignId}/bestiary/${templateId}`; }
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/bestiary/${templateId}`}>← Statblock</Link><h1>Vorlage bearbeiten</h1><EnemyBuilder action={save} initial={enemy} {...options} /></main>;
}
