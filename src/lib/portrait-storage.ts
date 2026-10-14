import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { PortraitError } from "./portrait-image";

export interface PortraitStorage { put(data: Uint8Array): Promise<string>; read(key: string): Promise<Uint8Array>; remove(key: string): Promise<void> }
export function portraitStorage(): PortraitStorage {
  if (process.env.NODE_ENV === "production" && !process.env.PORTRAIT_STORAGE_ROOT) throw new PortraitError("Portrait-Speicher ist nicht konfiguriert.", 503);
  const root = resolve(/* turbopackIgnore: true */ process.env.PORTRAIT_STORAGE_ROOT || ".portrait-storage");
  const publicRelative = relative(resolve("public"), root);
  if (!publicRelative || (!publicRelative.startsWith("..") && !isAbsolute(publicRelative))) throw new PortraitError("Portrait-Speicher muss ausserhalb von public liegen.", 503);
  function path(key: string) { if (!/^[a-f0-9-]{36}\.webp$/.test(key)) throw new PortraitError("Ungültige Bildreferenz."); return resolve(root, key); }
  return {
    async put(data) { await mkdir(root, { recursive: true, mode: 0o700 }); const key = `${randomUUID()}.webp`; await writeFile(path(key), data, { flag: "wx", mode: 0o600 }); return key; },
    async read(key) { return readFile(/* turbopackIgnore: true */ path(key)); },
    async remove(key) { try { await unlink(path(key)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } },
  };
}
