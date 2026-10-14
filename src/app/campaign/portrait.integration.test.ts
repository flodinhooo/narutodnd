import { enemyTemplateSeeds } from "../../../seeding/enemy-templates";
import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
const { db, getSession } = vi.hoisted(() => ({ db: { client: null as unknown as PrismaClient }, getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return db.client; } }));
vi.mock("@/lib/session", () => ({ getSession, requireCampaign: vi.fn(async () => ({ role: "DM" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { enableNpcCombat } from "./people-actions";
import { portraitSubject, portraitOwnerKey } from "@/lib/portrait-access";
import { changePortrait, portraitImage } from "@/lib/portraits";
import { portraitForm } from "@/lib/portrait-http";
import { portraitStorage } from "@/lib/portrait-storage";
import { GET as collection } from "@/app/api/campaign/[campaignId]/portraits/[kind]/[entityId]/route";
let directory: string, campaignId: string, foreign: string, characterId: string, npcId: string, enemyId: string;
let image: Buffer;
function actor(role = "DM", campaign = campaignId, id = "dm") { getSession.mockResolvedValue({ id, role, campaignId: campaign }); }
function form(op = "UPLOAD", patch: Record<string, string> = {}) { const fd = new FormData(); fd.set("op", op); fd.set("label", "Genin"); if (op === "UPLOAD") fd.set("file", new File([new Uint8Array(image)], "../../evil.png", { type: "image/png" })); for (const [k, v] of Object.entries(patch)) fd.set(k, v); return fd; }
const portraits = () => db.client.portrait.findMany({ where: { campaignId, characterId }, orderBy: { createdAt: "asc" } });
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shio-portraits-")); vi.stubEnv("PORTRAIT_STORAGE_ROOT", join(directory, "storage"));
  db.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  for (const name of (await readdir("prisma/migrations")).filter(n => /^\d/.test(n)).sort()) { const sql = (await readFile(join("prisma/migrations", name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, ""); for (const command of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.client.$executeRawUnsafe(command); }
  campaignId = (await db.client.campaign.create({ data: { name: "Portraits", dmCodeHash: "dm", playerCodeHash: "pc" } })).id;
  foreign = (await db.client.campaign.create({ data: { name: "Other", dmCodeHash: "dm2", playerCodeHash: "pc2" } })).id;
  characterId = (await db.client.character.create({ data: { campaignId, name: "PC", portraitOwnerKey: portraitOwnerKey("owner") } })).id;
  npcId = (await db.client.npc.create({ data: { campaignId, name: "Secret", playerVisible: false } })).id;
  enemyId = (await db.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[6].data, campaignId, name: "Enemy" } })).id;
  image = await sharp({ create: { width: 50, height: 70, channels: 3, background: "red" } }).png().toBuffer();
});
beforeEach(() => actor());
afterAll(async () => { await db.client.$disconnect(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
it("renders existing characters without portraits and rejects unknown subjects", async () => {
  const r = await collection(new Request("http://localhost/?default=1"), { params: Promise.resolve({ campaignId, kind: "character", entityId: characterId }) }); expect(r.status).toBe(404);
  await expect(portraitSubject(campaignId, "character", "missing")).rejects.toThrow(); await expect(portraitSubject(campaignId, "invalid", characterId)).rejects.toThrow();
});
it("uploads, selects independent age variants, replaces and removes files", async () => {
  await changePortrait(campaignId, "character", characterId, form());
  const first = (await portraits())[0]; expect(first.isDefault).toBe(true); expect(first.storageKey).not.toContain("evil");
  const read = await portraitImage(first.id); expect(read.headers.get("cache-control")).toContain("no-store"); expect(read.headers.get("content-type")).toBe("image/webp");
  await changePortrait(campaignId, "character", characterId, form("UPLOAD", { label: "Kind / Akademie" }));
  const second = (await portraits())[1]; expect(second.isDefault).toBe(false);
  await changePortrait(campaignId, "character", characterId, form("DEFAULT", { id: second.id, version: String(second.version) }));
  let current = (await portraits()).find(p => p.id === first.id)!;
  await changePortrait(campaignId, "character", characterId, form("UPLOAD", { id: current.id, version: String(current.version), label: "Jonin" }));
  await expect(portraitStorage().read(first.storageKey)).rejects.toThrow();
  await expect(changePortrait(campaignId, "character", characterId, form("DELETE", { id: current.id, version: String(current.version) }))).rejects.toThrow("inzwischen");
  current = (await portraits()).find(p => p.id === first.id)!;
  await changePortrait(campaignId, "character", characterId, form("DELETE", { id: current.id, version: String(current.version) }));
  expect(await portraits()).toHaveLength(1); expect((await db.client.character.findUniqueOrThrow({ where: { id: characterId } })).level).toBe(1);
});
it("allows only the owning player to change a player character", async () => {
  actor("PLAYER", campaignId, "other"); await expect(changePortrait(campaignId, "character", characterId, form())).rejects.toThrow("Bearbeitungsrechte");
  actor("PLAYER", campaignId, "owner"); await changePortrait(campaignId, "character", characterId, form("UPLOAD", { label: "Chunin" }));
  const last = (await portraits()).at(-1)!; expect((await portraitImage(last.id)).status).toBe(200);
  actor("PLAYER", foreign, "owner"); await expect(portraitImage(last.id)).rejects.toThrow("nicht verfügbar");
  getSession.mockResolvedValue(null); await expect(portraitImage(last.id)).rejects.toThrow();
});
it("shares linked NPC portraits with the character sheet while protecting secrets", async () => {
  const c = await db.client.character.create({ data: { campaignId, name: "Sensei" } }); await db.client.npc.update({ where: { id: npcId }, data: { characterId: c.id } });
  await changePortrait(campaignId, "character", c.id, form()); const p = await db.client.portrait.findFirstOrThrow({ where: { npcId } });
  expect(p.characterId).toBeNull(); actor("PLAYER", campaignId, "owner"); await expect(portraitImage(p.id)).rejects.toThrow();
  await db.client.npc.update({ where: { id: npcId }, data: { playerVisible: true } }); expect((await portraitImage(p.id)).status).toBe(200);
  await expect(changePortrait(campaignId, "character", c.id, form())).rejects.toThrow();
});
it("keeps own enemies campaign isolated and global templates immutable", async () => {
  await changePortrait(campaignId, "enemy", enemyId, form()); actor("PLAYER"); await expect(portraitSubject(campaignId, "enemy", enemyId)).rejects.toThrow();
  actor(); const global = await db.client.enemyTemplate.create({ data: { ...enemyTemplateSeeds[0].data, name: "Global" } }); await expect(changePortrait(campaignId, "enemy", global.id, form())).rejects.toThrow();
  actor("DM", foreign); await expect(changePortrait(campaignId, "enemy", enemyId, form())).rejects.toThrow();
});
it("returns hashed ownership handles, never session credentials, and validates assignment", async () => {
  const id = randomUUID(); await db.client.campaignAccessSession.create({ data: { id, campaignId, role: "PLAYER", expiresAt: new Date(Date.now() + 3600000) } });
  const response = await collection(new Request("http://localhost"), { params: Promise.resolve({ campaignId, kind: "character", entityId: characterId }) }); const view = await response.json(); expect(JSON.stringify(view)).not.toContain(id);
  await changePortrait(campaignId, "character", characterId, form("OWNER", { owner: view.owners[0].id }));
  actor("PLAYER", campaignId, id); expect((await portraitSubject(campaignId, "character", characterId, true)).canEdit).toBe(true);
  actor(); await expect(changePortrait(campaignId, "character", characterId, form("OWNER", { owner: "foreign" }))).rejects.toThrow();
});
it("rejects cross-origin requests, path traversal and oversized bodies", async () => {
  await expect(portraitForm(new Request("http://localhost", { method: "POST", headers: { origin: "http://other" }, body: "x" }))).rejects.toThrow("Anfrageursprung");
  await expect(portraitForm(new Request("http://localhost", { method: "POST", headers: { origin: "http://localhost" }, body: new Uint8Array(6 * 1024 * 1024 + 1) }))).rejects.toThrow("gross");
  await expect(portraitStorage().read("../../secret")).rejects.toThrow("Bildreferenz");
});
it("merges character portraits into an NPC identity when linking its combat sheet", async () => {
  const c = await db.client.character.create({ data: { campaignId, name: "Before linking" } });
  const n = await db.client.npc.create({ data: { campaignId, name: "Identity" } });
  await changePortrait(campaignId, "character", c.id, form()); await changePortrait(campaignId, "npc", n.id, form());
  await enableNpcCombat(campaignId, n.id, form("LINK", { characterId: c.id }));
  expect(await db.client.portrait.count({ where: { characterId: c.id } })).toBe(0);
  expect(await db.client.portrait.count({ where: { npcId: n.id } })).toBe(2);
  expect(await db.client.portrait.count({ where: { npcId: n.id, isDefault: true } })).toBe(1);
});
