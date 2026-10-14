import { missionFormResult } from "@/lib/mission-form-result";
import { notFound } from "next/navigation";
import { requireCampaign } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { saveNpc } from "@/app/campaign/people-actions";
import PeopleForm from "@/components/PeopleForm";
import { NpcFields } from "@/components/PeopleFields";

export default async function EditNpc({ params }: { params: Promise<{ campaignId: string; npcId: string }> }) {
  const { campaignId, npcId } = await params;
  await requireCampaign(campaignId, true);
  const [npc, locations] = await Promise.all([prisma.npc.findFirst({ where: { id: npcId, campaignId } }), prisma.location.findMany({ where: { campaignId }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  if (!npc) notFound();
  async function save(fd: FormData) { "use server"; return missionFormResult(async () => { await saveNpc(campaignId, npcId, fd); return `/campaign/${campaignId}/npcs/${npcId}`; }); }
  return <main className="shell narrow"><h1>NPC bearbeiten</h1><PeopleForm action={save}><NpcFields npc={npc} locations={locations} /></PeopleForm></main>;
}
