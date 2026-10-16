import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { PortraitError } from "./portrait-image";
import { prisma } from "./prisma";

export interface PortraitStorage { put(data: Uint8Array): Promise<string>; read(key: string): Promise<Uint8Array>; remove(key: string): Promise<void> }
export function privateImageStorage(rootVariable: string, fallback: string): PortraitStorage {
  if (/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
    function validate(key: string) { if (!/^[a-f0-9-]{36}\.webp$/.test(key)) throw new PortraitError("Ungültige Bildreferenz."); }
    return {
      async put(data) {
        const key = `${randomUUID()}.webp`;
        await prisma.privateImage.create({ data: { key, namespace: rootVariable, data: Buffer.from(data) } });
        return key;
      },
      async read(key) {
        validate(key);
        const image = await prisma.privateImage.findFirst({ where: { key, namespace: rootVariable } });
        if (!image) throw new PortraitError("Bild fehlt.", 404);
        return image.data;
      },
      async remove(key) {
        validate(key);
        await prisma.privateImage.deleteMany({ where: { key, namespace: rootVariable } });
      },
    };
  }
  if (process.env.NODE_ENV === "production" && !process.env[rootVariable]) throw new PortraitError("Privater Bildspeicher ist nicht konfiguriert.", 503);
  const root = resolve(/* turbopackIgnore: true */ process.env[rootVariable] || fallback);
  const publicRelative = relative(resolve("public"), root);
  if (!publicRelative || (!publicRelative.startsWith("..") && !isAbsolute(publicRelative))) throw new PortraitError("Portrait-Speicher muss ausserhalb von public liegen.", 503);
  function path(key: string) { if (!/^[a-f0-9-]{36}\.webp$/.test(key)) throw new PortraitError("Ungültige Bildreferenz."); return resolve(root, key); }
  return {
    async put(data) { await mkdir(root, { recursive: true, mode: 0o700 }); const key = `${randomUUID()}.webp`; await writeFile(path(key), data, { flag: "wx", mode: 0o600 }); return key; },
    async read(key) { return readFile(/* turbopackIgnore: true */ path(key)); },
    async remove(key) { try { await unlink(path(key)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } },
  };
}

export function portraitStorage(): PortraitStorage { return privateImageStorage("PORTRAIT_STORAGE_ROOT", ".portrait-storage"); }
