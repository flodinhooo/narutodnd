/** Dry-run by default. Only unreferenced regular WebP files older than 24h. */
import { PrismaClient } from "@prisma/client";
import { readdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { atlasStorage } from "../src/lib/atlas-image";
const db = new PrismaClient();
async function main() {
  const storage = atlasStorage(), root = resolve(process.env.ATLAS_STORAGE_ROOT || ".atlas-storage");
  const referenced = new Set((await db.worldMap.findMany({ select: { imageKey: true } })).map(p => p.imageKey));
  const files = await readdir(root).catch(e => { if (e.code === "ENOENT") return []; throw e; });
  let candidates = 0;
  for (const key of files) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(key) || referenced.has(key)) continue;
    const stat = await lstat(resolve(root, key));
    if (!stat.isFile() || stat.mtimeMs > Date.now() - 86400000) continue;
    if (await db.worldMap.findUnique({ where: { imageKey: key }, select: { id: true } })) continue;
    candidates++;
    if (process.argv.includes("--delete")) await storage.remove(key);
  }
  console.log(`${candidates} unreferenced atlas files older than 24h; mode: ${process.argv.includes("--delete") ? "delete" : "dry-run"}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
