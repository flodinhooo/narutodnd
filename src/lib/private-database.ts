import type { PrismaClient } from "@prisma/client";
import { resolve, relative, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
export async function assertPrivateLoreDatabase(db: PrismaClient) {
  const databases = await db.$queryRawUnsafe<{ name: string; file: string }[]>("PRAGMA database_list");
  const filename = databases.find(d => d.name === "main")?.file;
  if (!filename) throw new Error("Private persistente SQLite-Datenbank erforderlich.");
  const rel = relative(resolve(/* turbopackIgnore: true */ "."), filename);
  if (!rel.startsWith("..") && !isAbsolute(rel)) {
    try { execFileSync("git", ["check-ignore", "-q", "--", rel], { stdio: "ignore" }); }
    catch { throw new Error("Lore nicht in eine getrackte oder nicht ignorierte Datenbank importieren. Erst eine private DB-Kopie ausserhalb des öffentlichen Sourcecodes konfigurieren."); }
  }
}
