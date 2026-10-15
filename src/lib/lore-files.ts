import { readdir, readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { loreBundleSchema } from "./lore-bundle";
import { PortraitError } from "./private-image-error";
async function root() {
  if (process.env.NODE_ENV === "production" && !process.env.LORE_STORAGE_ROOT) throw new PortraitError("Privater Lore-Speicher ist nicht konfiguriert.", 503);
  const path = resolve(/* turbopackIgnore: true */ process.env.LORE_STORAGE_ROOT || ".lore-storage"), rel = relative(resolve("public"), path);
  if (!rel || (!rel.startsWith("..") && !isAbsolute(rel))) throw new PortraitError("Privater Lore-Speicher darf nicht in public liegen.", 503);
  return realpath(/* turbopackIgnore: true */ path);
}
export async function readLorePackage(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}\.json$/.test(id)) throw new PortraitError("Ungültige Paketauswahl.", 400);
  const directory = await root(), file = await realpath(/* turbopackIgnore: true */ resolve(/* turbopackIgnore: true */ directory, id));
  const rel = relative(directory, file); if (rel.startsWith("..") || isAbsolute(rel)) throw new PortraitError("Paket nicht verfügbar.", 404);
  const bytes = await readFile(/* turbopackIgnore: true */ file); if (bytes.length > 5 * 1024 * 1024) throw new PortraitError("Lore-Paket ist zu gross.", 413);
  return loreBundleSchema.parse(JSON.parse(bytes.toString("utf8")));
}
export async function lorePackages() {
  let files: string[]; try { files = await readdir(/* turbopackIgnore: true */ await root()); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
  const result = [];
  for (const id of files.filter(f => /^[a-zA-Z0-9_-]{1,100}\.json$/.test(f)).sort()) {
    try { const b = await readLorePackage(id); result.push({ id, key: b.key, npcs: b.npcs.length, organizations: b.organizations.length, missions: b.missions.length }); } catch { /* Non-bundle private review files are not catalogue entries. */ }
  }
  return result;
}
