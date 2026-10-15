import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
async function files(dir: string): Promise<string[]> { const out: string[] = []; for (const e of await readdir(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) out.push(...await files(p)); else out.push(p); } return out; }
async function main() {
  const all = await files(".next"), traces = all.filter(p => p.endsWith(".nft.json")), forbidden = /(?:\.local-backups|\.private-data|\.lore-storage|\.portrait-storage|\.atlas-storage)[/\\]|[/\\]prisma[/\\][^/\\]+\.(?:db|sqlite)(?:$|-)/;
  for (const path of traces) { const trace = JSON.parse(await readFile(path, "utf8")); if (trace.files?.some((p: string) => forbidden.test(p))) throw new Error("Private runtime file found in build tracing; deployment blocked."); }
  const canaries: string[] = [];
  for (const filename of ["shio-v1.json", "living-population-v1.json"]) {
    const packet = JSON.parse(await readFile(join(process.env.LORE_STORAGE_ROOT || ".lore-storage", filename), "utf8"));
    for (const n of packet.npcs.slice(0, 5)) if (n.description?.length > 70) canaries.push(n.description);
  }
  const client = all.filter(p => p.replaceAll("\\", "/").includes("/.next/static/") || p.replaceAll("\\", "/").startsWith(".next/static/"));
  for (const path of client) { const bytes = await readFile(path); if (canaries.some(value => bytes.includes(Buffer.from(value)))) throw new Error("Private profile text found in client assets; deployment blocked."); }
  const report = { traceFiles: traces.length, clientFiles: client.length, privateCanaries: canaries.length, privateRuntimeFilesInTraces: 0, privateTextInClientAssets: 0 };
  await writeFile(".local-backups/living-artifact-check.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
