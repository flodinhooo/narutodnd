/** Trusted local operator tool, dry-run by default. No web endpoint or public lore payload. */
import { PrismaClient } from "@prisma/client";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
export { assertPrivateLoreDatabase } from "../src/lib/private-database";
import { assertPrivateLoreDatabase } from "../src/lib/private-database";
import { type LoreBundle } from "../src/lib/lore-bundle";

export { importLoreBundle } from "../src/lib/lore-importer";
import { importLoreBundle } from "../src/lib/lore-importer";
export function privateLorePath(path: string) {
  const target = resolve(path), root = resolve(process.env.LORE_STORAGE_ROOT || ".lore-storage"), rel = relative(root, target);
  const publicRel = relative(resolve("public"), root);
  if (!publicRel || (!publicRel.startsWith("..") && !isAbsolute(publicRel)) || !rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Lore-Bundle muss im privaten LORE_STORAGE_ROOT liegen, niemals in public.");
  return target;
}
async function main() {
  const args = process.argv.slice(2), apply = args.includes("--apply"), campaignId = args[args.indexOf("--campaign") + 1];
  if (!args.includes("--campaign") || !campaignId || campaignId.startsWith("--")) throw new Error("Usage: tsx scripts/lore-import.ts bundle.json --campaign ID [--apply --confirm-campaign NAME]");
  const input = JSON.parse(await readFile(privateLorePath(args[0]), "utf8")) as LoreBundle, db = new PrismaClient();
  try {
    const preview = await importLoreBundle(db, campaignId, input);
    if (!apply) { console.log(JSON.stringify(preview, null, 2)); return; }
    if (!args.includes("--confirm-campaign") || args[args.indexOf("--confirm-campaign") + 1] !== preview.campaign) throw new Error("Exakten Kampagnennamen mit --confirm-campaign bestätigen.");
    if (preview.conflicts.length) throw new Error("Importkonflikte: zuerst Dry-run prüfen.");
    await assertPrivateLoreDatabase(db);
    await mkdir(resolve(".local-backups"), { recursive: true });
    const backup = resolve(`.local-backups/pre-lore-import-${Date.now()}.sqlite`).replaceAll("\\", "/");
    await db.$executeRawUnsafe("VACUUM INTO ?", backup);
    console.log(JSON.stringify({ backup, ...await importLoreBundle(db, campaignId, input, true) }, null, 2));
  } finally { await db.$disconnect(); }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/lore-import.ts")) main().catch(e => { console.error(e); process.exitCode = 1; });
