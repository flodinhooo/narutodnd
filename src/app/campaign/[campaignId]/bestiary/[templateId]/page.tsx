import PortraitManager from "@/components/PortraitManager";
import Portrait from "@/components/Portrait";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEnemyTemplate } from "@/lib/enemy-library";
import { archiveEnemyTemplate, duplicateEnemyTemplate } from "@/app/campaign/enemy-actions";
import PeopleForm from "@/components/PeopleForm";
import EnemyStatblock from "@/components/EnemyStatblock";

export default async function EnemyDetail({ params }: { params: Promise<{ campaignId: string; templateId: string }> }) {
  const { campaignId, templateId } = await params;
  const enemy = await getEnemyTemplate(campaignId, templateId);
  if (!enemy) notFound();
  async function duplicate() { "use server"; const id = await duplicateEnemyTemplate(campaignId, templateId); return `/campaign/${campaignId}/bestiary/${id}/edit`; }
  const own = enemy.campaignId === campaignId;
  return <main className="shell"><Link className="back" href={`/campaign/${campaignId}/bestiary`}>← Bestiary</Link><header className="topbar"><div><div className="eyebrow">{own ? "KAMPAGNENVORLAGE" : "GLOBALE BIBLIOTHEK"} · VERSION {enemy.version}{enemy.archived && " · ARCHIV"}</div><Portrait campaignId={campaignId} kind="enemy" entityId={templateId} name={enemy.name} /><h1>{enemy.name}</h1></div>{own && <Link className="button primary" href={`/campaign/${campaignId}/bestiary/${templateId}/edit`}>Bearbeiten</Link>}</header>
    {!own && <p className="muted">Globale Vorlagen sind schreibgeschützt. Zum Anpassen eine eigene Kampagnenkopie erstellen.</p>}<div className="actions"><PeopleForm className="" action={duplicate}><button className="button primary">{own ? "Vorlage duplizieren" : "Für diese Kampagne duplizieren"}</button></PeopleForm>{own && <PeopleForm className="" action={archiveEnemyTemplate.bind(null, campaignId, templateId, !enemy.archived, enemy.version)} confirm={enemy.archived ? undefined : "Vorlage archivieren? Sie bleibt erhalten und kann wiederhergestellt werden."}><button className="button ghost">{enemy.archived ? "Wiederherstellen" : "Archivieren"}</button></PeopleForm>}</div>{own && <PortraitManager campaignId={campaignId} kind="enemy" entityId={templateId} name={enemy.name} />}<EnemyStatblock enemy={enemy} />
  </main>;
}
