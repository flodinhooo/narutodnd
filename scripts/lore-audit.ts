/** Read-only audit. Private input/output stay outside tracked source and public assets. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { CanonJutsu } from "../seeding/jutsu-canon.generated";
import { HomebrewElementalJutsu } from "../seeding/jutsu-homebrew-elemental.generated";
import { FoundationJutsu } from "../seeding/jutsu-foundation.generated";
import { UzumakiJutsu } from "../seeding/jutsu-uzumaki.generated";
import { CharacterSignaturesJutsu } from "../seeding/jutsu-character-signatures.generated";
import { ItoharaHidenJutsu } from "../seeding/jutsu-itohara-hiden.generated";
import { ShiranamiHidenJutsu } from "../seeding/jutsu-shiranami-hiden.generated";

export function normalizeLoreName(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export type LoreSource = { path: string; sha: string; content: string };
export function verifyLoreSources(docs: LoreSource[]) {
  if (new Set(docs.map(d => d.path)).size !== docs.length) throw new Error("Duplicate source paths.");
  for (const d of docs) {
    const sha = createHash("sha1").update(`blob ${Buffer.byteLength(d.content, "utf8")}\0`).update(d.content).digest("hex");
    if (sha !== d.sha) throw new Error(`Source content does not match pinned Git blob: ${d.path}`);
  }
}
export function auditLinks(docs: LoreSource[], availablePaths: string[] = docs.map(d => d.path)) {
  const index = new Map<string, string[]>();
  for (const path of availablePaths) {
    for (const key of [path.replace(/\.md$/i, ""), path.split("/").at(-1)!.replace(/\.md$/i, "")]) {
      const n = normalizeLoreName(key), list = index.get(n) ?? []; if (!list.includes(path)) list.push(path); index.set(n, list);
    }
  }
  return docs.flatMap(doc => [...doc.content.matchAll(/(!?)\[\[([^\]]+)\]\]/g)].map(m => {
    const target = m[2].split("|")[0].split("#")[0].trim();
    const sameFolder = doc.path.slice(0, doc.path.lastIndexOf("/") + 1) + target;
    const candidates = !target ? [doc.path] : index.get(normalizeLoreName(sameFolder.replace(/\.md$/i, ""))) ?? index.get(normalizeLoreName(target.replace(/\.md$/i, ""))) ?? [];
    return { source: doc.path, target, embedded: Boolean(m[1]), status: candidates.length === 1 ? "RESOLVED" : candidates.length ? "AMBIGUOUS" : "MISSING", candidates };
  }));
}
export function jutsuSections(docs: LoreSource[]) {
  return docs.flatMap(doc => {
    const headings = [...doc.content.matchAll(/^#{1,6}\s+(.+)$/gm)];
    return headings.flatMap((heading, i) => {
      const block = doc.content.slice(heading.index!, headings[i + 1]?.index ?? doc.content.length);
      const rank = block.match(/^\s*(?:[-*]\s+)?(?:\*\*(?:Rang|Rank):\*\*|\*\*(?:Rang|Rank)\*\*:)\s*(?:\*\*)?([EDCBAS])(?:\*\*)?(?:[- ]?Rang|\b)/mi)?.[1];
      if (!rank) return [];
      const name = heading[1].replace(/[*_`]/g, "").replace(/^\d+[.)]\s*/, "").trim();
      return [{ name, rank, source: doc.path, sourceSha: doc.sha, line: doc.content.slice(0, heading.index).split("\n").length, block }];
    });
  });
}
function safeOutput(path: string) {
  const privateRoot = resolve(".local-backups"), target = resolve(path), rel = relative(privateRoot, target);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Audit output must be inside .local-backups; private lore must not enter tracked files.");
  return target;
}
async function main() {
  const input = process.argv[2] ?? ".local-backups/lore-vault-snapshot.json", output = safeOutput(process.argv[3] ?? ".local-backups/lore-audit.json");
  const snapshot = JSON.parse(await readFile(input, "utf8")) as { revision: string; docs: LoreSource[]; availablePaths?: string[] };
  verifyLoreSources(snapshot.docs);
  const db = new PrismaClient();
  try {
    const [jutsu, npcs, characters, organizations, locations, violations] = await Promise.all([
      db.jutsu.findMany({ select: { id: true, name: true, germanName: true, japaneseName: true, slug: true, campaignId: true, rank: true, chakraCost: true, prerequisiteText: true, pool: true } }),
      db.npc.findMany({ select: { id: true, name: true, campaignId: true } }), db.character.findMany({ select: { id: true, name: true, campaignId: true } }),
      db.organization.findMany({ select: { id: true, name: true, type: true, campaignId: true } }), db.location.findMany({ select: { id: true, name: true, campaignId: true } }),
      db.$queryRawUnsafe("PRAGMA foreign_key_check"),
    ]);
    const registered = [...CanonJutsu, ...HomebrewElementalJutsu, ...FoundationJutsu, ...UzumakiJutsu, ...CharacterSignaturesJutsu];
    const dormantHiden = [...ItoharaHidenJutsu, ...ShiranamiHidenJutsu];
    const texts = snapshot.docs.map(d => ({ path: d.path, normalized: " " + normalizeLoreName(d.content) + " " }));
    const registeredSources = registered.map(r => {
      const names = [r.name, r.germanName, r.japaneseName, r.englishName].filter(Boolean).map(n => normalizeLoreName(n!)).filter(n => n.length >= 5);
      return { slug: r.slug, name: r.name, sources: texts.filter(d => names.some(n => d.normalized.includes(" " + n + " "))).map(d => d.path), review: "Name occurrence; does not confirm mechanical agreement" };
    });
    const aliases = new Map<string, string[]>();
    for (const j of jutsu) for (const value of [j.name, j.germanName, j.japaneseName, j.slug].filter(Boolean) as string[]) {
      for (const part of [value, ...value.split(/\s[–—]\s/), value.replace(/^(?:Suiton|Doton|Katon|Raiton|Fūton|Futon):\s*/i, "")]) {
        const key = normalizeLoreName(part); if (!key) continue; const list = aliases.get(key) ?? []; if (!list.includes(j.id)) list.push(j.id); aliases.set(key, list);
      }
    }
    const sections = jutsuSections(snapshot.docs).map(s => ({ ...s, matches: aliases.get(normalizeLoreName(s.name)) ?? [], review: "Candidate only; no automatic equivalence or mechanics inferred" }));
    const report = { revision: snapshot.revision, files: snapshot.docs.length, emptyFiles: snapshot.docs.filter(d => !d.content.trim()).length,
      contentHashes: snapshot.docs.map(d => ({ path: d.path, gitSha: d.sha, sha256: createHash("sha256").update(d.content).digest("hex") })),
      links: auditLinks(snapshot.docs, snapshot.availablePaths), jutsuSections: sections, registeredRecords: registered.length,
      missingRegisteredSlugs: registered.filter(r => !jutsu.some(j => j.campaignId === null && j.slug === r.slug)).map(r => r.slug),
      dormantHidenRecords: dormantHiden.length, registeredSources, database: { jutsu, npcs, characters, organizations, locations }, foreignKeyViolations: violations };
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ files: report.files, emptyFiles: report.emptyFiles, registeredRecords: registered.length, globalJutsu: jutsu.filter(j => !j.campaignId).length, candidates: sections.length, unmatchedCandidates: sections.filter(s => !s.matches.length).length, dormantHidenRecords: dormantHiden.length, output }));
  } finally { await db.$disconnect(); }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/lore-audit.ts")) main().catch(e => { console.error(e); process.exitCode = 1; });
