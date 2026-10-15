/** Trusted local operator tool, dry-run by default. No web endpoint or public lore payload. */
import { PrismaClient } from "@prisma/client";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { loreBundleSchema, loreEntityId, loreProvenance, type LoreBundle } from "../src/lib/lore-bundle";

export async function importLoreBundle(db: PrismaClient, campaignId: string, input: unknown, apply = false) {
  const bundle = loreBundleSchema.parse(input);
  return db.$transaction(async tx => {
    const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true } });
    if (!campaign) throw new Error("Kampagne nicht gefunden.");
    const id = (kind: string, key: string) => loreEntityId(campaignId, bundle.key, kind, key);
    const result = { campaign: campaign.name, createNpcs: 0, createOrganizations: 0, createMemberships: 0, createRelationships: 0, preserved: 0, conflicts: [] as string[] };
    const npcIds = new Set<string>(), orgIds = new Set<string>();
    for (const n of bundle.npcs) {
      const entityId = id("npc", n.key), existing = await tx.npc.findUnique({ where: { id: entityId } });
      if (existing) { if (existing.campaignId !== campaignId) throw new Error("Kampagnenkonflikt."); result.preserved++; npcIds.add(n.key); continue; }
      const names = { campaignId, name: n.name };
      if (await tx.npc.count({ where: names }) || await tx.character.count({ where: names })) { result.conflicts.push(`npc:${n.key}: existing name requires explicit manual reconciliation`); continue; }
      result.createNpcs++; npcIds.add(n.key);
      if (apply) await tx.npc.create({ data: { id: entityId, campaignId, name: n.name, category: n.category, attitude: "UNKNOWN", age: n.age, gender: n.gender, ninjaRank: n.ninjaRank, occupation: n.occupation, village: n.village, clan: n.clan, dmSecrets: loreProvenance(bundle, n), playerVisible: false } });
    }
    for (const o of bundle.organizations) {
      const entityId = id("organization", o.key), existing = await tx.organization.findUnique({ where: { id: entityId } });
      if (existing) { if (existing.campaignId !== campaignId) throw new Error("Kampagnenkonflikt."); result.preserved++; orgIds.add(o.key); }
      else if (await tx.organization.count({ where: { campaignId, name: o.name } })) { result.conflicts.push(`organization:${o.key}: existing name requires explicit manual reconciliation`); continue; }
      else { result.createOrganizations++; orgIds.add(o.key); if (apply) await tx.organization.create({ data: { id: entityId, campaignId, name: o.name, type: o.type, attitude: "UNKNOWN", dmSecrets: loreProvenance(bundle, o), playerVisible: false } }); }
      if (!orgIds.has(o.key)) continue;
      for (const m of o.members) {
        if (!npcIds.has(m.npcKey)) { result.conflicts.push(`membership:${o.key}:${m.npcKey}: unresolved NPC`); continue; }
        const membership = await tx.organizationMember.findUnique({ where: { organizationId_npcId: { organizationId: entityId, npcId: id("npc", m.npcKey) } } });
        if (membership) { result.preserved++; continue; } result.createMemberships++;
        if (apply) await tx.organizationMember.create({ data: { organizationId: entityId, npcId: id("npc", m.npcKey), role: m.role, isLeader: m.isLeader } });
      }
    }
    for (const r of bundle.relationships) {
      if (!npcIds.has(r.sourceKey) || !npcIds.has(r.targetKey)) { result.conflicts.push(`relationship:${r.key}: unresolved NPC`); continue; }
      const entityId = id("relationship", r.key), existing = await tx.characterRelationship.findUnique({ where: { id: entityId } });
      if (existing) { if (existing.campaignId !== campaignId) throw new Error("Kampagnenkonflikt."); result.preserved++; continue; }
      result.createRelationships++;
      if (apply) await tx.characterRelationship.create({ data: { id: entityId, campaignId, sourceNpcId: id("npc", r.sourceKey), targetNpcId: id("npc", r.targetKey), type: r.type, description: r.description, dmSecrets: loreProvenance(bundle, r), playerVisible: false } });
    }
    // A partial or ambiguous import must never silently attach identities.
    if (apply && result.conflicts.length) throw new Error("Importkonflikte: zuerst den Dry-run prüfen und das private Bundle abgleichen.");
    return result;
  }, { timeout: 30000 });
}
export function privateLorePath(path: string) {
  const target = resolve(path), root = resolve(process.env.LORE_STORAGE_ROOT || ".lore-storage"), rel = relative(root, target);
  const publicRel = relative(resolve("public"), root);
  if (!publicRel || (!publicRel.startsWith("..") && !isAbsolute(publicRel)) || !rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Lore-Bundle muss im privaten LORE_STORAGE_ROOT liegen, niemals in public.");
  return target;
}
export async function assertPrivateLoreDatabase(db: PrismaClient) {
  const databases = await db.$queryRawUnsafe<{ name: string; file: string }[]>("PRAGMA database_list");
  const filename = databases.find(d => d.name === "main")?.file;
  if (!filename) throw new Error("Private persistente SQLite-Datenbank erforderlich.");
  const rel = relative(resolve("."), filename);
  if (!rel.startsWith("..") && !isAbsolute(rel)) {
    try { execFileSync("git", ["check-ignore", "-q", "--", rel], { stdio: "ignore" }); }
    catch { throw new Error("Lore nicht in eine getrackte oder nicht ignorierte Datenbank importieren. Erst eine private DB-Kopie ausserhalb des öffentlichen Sourcecodes konfigurieren."); }
  }
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
