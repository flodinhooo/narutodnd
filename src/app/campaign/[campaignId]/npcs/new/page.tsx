import { missionFormResult } from "@/lib/mission-form-result";
import { requireCampaign } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { saveNpc } from "@/app/campaign/people-actions";
import PeopleForm from "@/components/PeopleForm";
import { NpcFields } from "@/components/PeopleFields";

export default async function NewNpc({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  await requireCampaign(campaignId, true);
  const locations = await prisma.location.findMany({ where: { campaignId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  async function create(fd: FormData) { "use server"; return missionFormResult(async () => { const id = await saveNpc(campaignId, null, fd); return `/campaign/${campaignId}/npcs/${id}`; }); }
  return <main className="shell narrow"><h1>NPC erstellen</h1><p className="muted">Kategorie und Haltung sind unabhängig. Einen Shinobi-Charakterbogen kannst du im nächsten Schritt hinzufügen.</p><PeopleForm action={create}><NpcFields locations={locations} /></PeopleForm></main>;
}
