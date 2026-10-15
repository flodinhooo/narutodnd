import { atlasActor } from "@/lib/atlas-library";
import { lorePackages, readLorePackage } from "@/lib/lore-files";
import { loreSelectionSchema } from "@/lib/lore-selection";
import { importSelectedLore } from "@/lib/lore-importer";
import { prisma } from "@/lib/prisma";
import { portraitForm } from "@/lib/portrait-http";
import { PortraitError } from "@/lib/private-image-error";
import { assertPrivateLoreDatabase } from "@/lib/private-database";
import { mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function failure(e: unknown) { const message = e instanceof Error ? e.message : "Import fehlgeschlagen."; return Response.json({ error: e instanceof PortraitError || !message.startsWith("[\n") ? message : "Ungültige Importauswahl oder Paketdaten." }, { status: e instanceof PortraitError ? e.status : /veraltet|Importkonflikte/.test(message) ? 409 : 400, headers }); }
export async function GET(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  try { const { campaignId } = await params; await atlasActor(campaignId, true); const id = new URL(request.url).searchParams.get("package"); return Response.json(id ? await readLorePackage(id) : await lorePackages(), { headers }); } catch (e) { return failure(e); }
}
export async function POST(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await params; await atlasActor(campaignId, true);
    const form = await portraitForm(request, 1024 * 1024), bundle = await readLorePackage(String(form.get("package") || "")), selection = loreSelectionSchema.parse(JSON.parse(String(form.get("selection") || "")));
    const op = form.get("op"); if (op !== "PREVIEW" && op !== "APPLY") throw new PortraitError("Unbekannte Importaktion.", 400);
    const apply = op === "APPLY", fingerprint = String(form.get("fingerprint") || "");
    if (apply) {
      const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { name: true } });
      if (form.get("confirmation") !== campaign.name || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new PortraitError("Aktuelle Vorschau und exakter Kampagnenname erforderlich.", 400);
      await assertPrivateLoreDatabase(prisma);
      if (process.env.NODE_ENV === "production" && !process.env.LORE_BACKUP_ROOT) throw new PortraitError("Privates Backup-Verzeichnis ist nicht konfiguriert.", 503);
      const directory = resolve(/* turbopackIgnore: true */ process.env.LORE_BACKUP_ROOT || ".local-backups"), rel = relative(resolve("public"), directory);
      if (!rel || (!rel.startsWith("..") && !isAbsolute(rel))) throw new PortraitError("Backup-Verzeichnis muss privat sein.", 503);
      await mkdir(directory, { recursive: true, mode: 0o700 }); await prisma.$executeRawUnsafe("VACUUM INTO ?", resolve(/* turbopackIgnore: true */ directory, `pre-lore-web-${randomUUID()}.sqlite`).replaceAll("\\", "/"));
    }
    const result = await importSelectedLore(prisma, campaignId, bundle, selection, apply, apply ? fingerprint : undefined);
    if (apply) revalidatePath(`/campaign/${campaignId}`, "layout"); return Response.json(result, { headers });
  } catch (e) { return failure(e); }
}
