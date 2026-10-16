import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
const { db, getSession } = vi.hoisted(() => ({ db: { client: null as unknown as PrismaClient }, getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return db.client; } }));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { mutateAtlas } from "@/lib/atlas-write";
import { atlasDetail } from "@/lib/atlas-library";
import { atlasLocationDetail } from "@/lib/atlas-location";
import { atlasStorage, processMapImage } from "@/lib/atlas-image";
import { importShioAtlas } from "@/lib/atlas-import";
import { seedWorldAtlas } from "../../../prisma/seed-world-atlas";
import { SHIO_ATLAS_KEY, shioMaps, shioLocations, shioMarkers } from "../../../seeding/world-atlas";
import { GET as imageRoute } from "@/app/api/campaign/[campaignId]/atlas/[mapId]/image/route";
import { GET as catalogRoute, POST as mutateRoute } from "@/app/api/campaign/[campaignId]/atlas/route";
let directory: string, campaignId: string, foreignId: string, locationId: string, secretLocation: string, foreignLocation: string, png: Buffer;
function actor(role = "DM", campaign = campaignId) { getSession.mockResolvedValue({ id: "actor", role, campaignId: campaign }); }
const mapData = (patch = {}) => ({ name: "Map", description: "Public description", dmNotes: "PRIVATE_NOTES", type: "CITY", parentId: null, locationId: null, playerVisible: false, archived: false, sortOrder: 0, ...patch });
const markerData = (patch = {}) => ({ title: "Academy", description: "Marker description", x: .2, y: .7, category: "SHINOBI", icon: "tower", color: "#abcdef", playerVisible: true, locationId: null, childMapId: null, ...patch });
function request(op: string, mapId = "", version = 1, data: unknown = {}, id = "", requestId = randomUUID()) { const fd = new FormData(); for (const [k, v] of Object.entries({ op, mapId, version: String(version), data: JSON.stringify(data), id, requestId })) fd.set(k, v); return fd; }
async function create(patch = {}) { return (await mutateAtlas(campaignId, request("CREATE_MAP", "", 1, mapData(patch)))).mapId!; }
async function current(id: string) { return db.client.worldMap.findUniqueOrThrow({ where: { id } }); }
async function image(id: string) { const fd = request("IMAGE", id, (await current(id)).version); fd.set("file", new File([new Uint8Array(png)], "../../map.png", { type: "image/png" })); return mutateAtlas(campaignId, fd); }
async function addMarker(mapId: string, patch = {}) { await mutateAtlas(campaignId, request("SAVE_MARKER", mapId, (await current(mapId)).version, markerData(patch))); return db.client.mapMarker.findFirstOrThrow({ where: { mapId }, orderBy: { id: "desc" } }); }
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "file:atlas-integration.sqlite");
  directory = await mkdtemp(join(tmpdir(), "shio-atlas-")); vi.stubEnv("ATLAS_STORAGE_ROOT", join(directory, "storage")); db.client = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  for (const name of (await readdir("prisma/migrations")).filter(n => /^\d/.test(n)).sort()) { const sql = (await readFile(join("prisma/migrations", name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, ""); for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.client.$executeRawUnsafe(statement); }
  campaignId = (await db.client.campaign.create({ data: { name: "Atlas", dmCodeHash: "dm", playerCodeHash: "pc" } })).id;
  foreignId = (await db.client.campaign.create({ data: { name: "Foreign", dmCodeHash: "dm2", playerCodeHash: "pc2" } })).id;
  locationId = (await db.client.location.create({ data: { campaignId, name: "Academy", slug: "academy", type: "BUILDING", playerVisible: true } })).id;
  secretLocation = (await db.client.location.create({ data: { campaignId, name: "SECRET_LOCATION", slug: "secret", playerVisible: false } })).id;
  foreignLocation = (await db.client.location.create({ data: { campaignId: foreignId, name: "FOREIGN_LOCATION", slug: "foreign" } })).id;
  png = await sharp({ create: { width: 90, height: 60, channels: 3, background: "#c0c0c0" } }).png().toBuffer();
}, 60000);
beforeEach(() => actor());
afterAll(async () => { await db.client.$disconnect(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
it("creates, edits and archives own maps with optimistic versions and scoped references", async () => {
  const id = await create({ locationId }); expect((await current(id)).name).toBe("Map");
  await mutateAtlas(campaignId, request("SAVE_MAP", id, 1, mapData({ name: "Edited", archived: true })));
  await expect(mutateAtlas(campaignId, request("SAVE_MAP", id, 1, mapData()))).rejects.toThrow("inzwischen");
  await expect(create({ locationId: foreignLocation })).rejects.toThrow("Kampagne"); expect((await current(id)).name).toBe("Edited");
});
it("enforces parent hierarchy and rejects self, longer cycles and foreign parents", async () => {
  const a = await create(), b = await create({ parentId: a }), c = await create({ parentId: b });
  for (const parentId of [a, c, "missing"]) await expect(mutateAtlas(campaignId, request("SAVE_MAP", a, 1, mapData({ parentId })))).rejects.toThrow();
  actor("DM", foreignId); const f = (await mutateAtlas(foreignId, request("CREATE_MAP", "", 1, mapData()))).mapId!; actor(); await expect(create({ parentId: f })).rejects.toThrow();
});
it("decodes maps without resizing, strips metadata, bounds input and rejects fake images", async () => {
  const p = await processMapImage(png, "image/png"); expect([p.width, p.height]).toEqual([90, 60]); expect((await sharp(p.data).metadata()).format).toBe("webp");
  for (const [data, mime] of [[png, "image/jpeg"], [Buffer.from("<svg/>"), "image/png"], [Buffer.alloc(25 * 1024 * 1024 + 1), "image/png"]] as const) await expect(processMapImage(data, mime)).rejects.toThrow();
});
it("uploads, replaces and removes private images with version checks and cleanup", async () => {
  const id = await create(); await image(id); const first = await current(id); expect(first.imageWidth).toBe(90);
  const r = await imageRoute(new Request("http://localhost"), { params: Promise.resolve({ campaignId, mapId: id }) }); expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toContain("no-store");
  await image(id); await expect(atlasStorage().read(first.imageKey!)).rejects.toThrow();
  const m = await current(id); await mutateAtlas(campaignId, request("REMOVE_IMAGE", id, m.version)); expect((await current(id)).imageKey).toBeNull();
});
it("persists marker CRUD, normalized movement and Location/detail-map references", async () => {
  const id = await create(); await image(id); const child = await create({ parentId: id }); const marker = await addMarker(id, { locationId, childMapId: child });
  expect(marker.x).toBe(.2); await mutateAtlas(campaignId, request("MOVE_MARKER", id, (await current(id)).version, { x: .91, y: .04 }, marker.id));
  expect((await atlasDetail(campaignId, id)).markers[0]).toMatchObject({ x: .91, y: .04, locationId, childMapId: child });
  await mutateAtlas(campaignId, request("SAVE_MARKER", id, (await current(id)).version, markerData({ title: "Edited", locationId }), marker.id));
  await mutateAtlas(campaignId, request("DELETE_MARKER", id, (await current(id)).version, {}, marker.id)); expect((await atlasDetail(campaignId, id)).markers).toHaveLength(0);
});
it("rejects invalid coordinates, cross-map marker IDs and non-child/foreign links", async () => {
  const id = await create(); await image(id); const marker = await addMarker(id); const other = await create(); await image(other);
  for (const patch of [{ x: 1.01 }, { y: -.1 }, { locationId: foreignLocation }, { childMapId: other }]) await expect(mutateAtlas(campaignId, request("SAVE_MARKER", id, (await current(id)).version, markerData(patch)))).rejects.toThrow();
  await expect(mutateAtlas(campaignId, request("MOVE_MARKER", other, (await current(other)).version, { x: .2, y: .2 }, marker.id))).rejects.toThrow();
});
it("prevents parallel stale writes and replays identical requests without duplication", async () => {
  const fd = request("CREATE_MAP", "", 1, mapData()), first = await mutateAtlas(campaignId, fd); expect(await mutateAtlas(campaignId, fd)).toEqual(first);
  fd.set("data", JSON.stringify(mapData({ name: "different" }))); await expect(mutateAtlas(campaignId, fd)).rejects.toThrow("Request-ID");
  const results = await Promise.allSettled([mutateAtlas(campaignId, request("SAVE_MAP", first.mapId!, 1, mapData({ name: "one" }))), mutateAtlas(campaignId, request("SAVE_MAP", first.mapId!, 1, mapData({ name: "two" })))]); expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
});
it("projects public data without secrets, private links or hidden-ancestor maps", async () => {
  const root = await create({ playerVisible: true }), child = await create({ parentId: root, name: "SECRET_MAP" }), grandchild = await create({ parentId: child, playerVisible: true, name: "SECRET_DESCENDANT" }); await image(root);
  await addMarker(root, { title: "PUBLIC", locationId }); await addMarker(root, { title: "SECRET_MARKER", playerVisible: false }); await addMarker(root, { title: "SECRET_REFERENCE", locationId: secretLocation }); await addMarker(root, { title: "SECRET_CHILD_LINK", childMapId: child });
  actor("PLAYER"); const data = await atlasDetail(campaignId, root), output = JSON.stringify(data); expect(output).toContain("PUBLIC"); for (const word of ["PRIVATE_NOTES", "SECRET_", "dmNotes", "imageKey"]) expect(output).not.toContain(word);
  await expect(atlasDetail(campaignId, grandchild)).rejects.toThrow(); expect((await imageRoute(new Request("http://localhost"), { params: Promise.resolve({ campaignId, mapId: child }) })).status).toBe(404);
});
it("protects private files, API payloads and mutations from other campaigns/players", async () => {
  const id = await create(); await image(id); actor("PLAYER"); await expect(mutateAtlas(campaignId, request("CREATE_MAP", "", 1, mapData()))).rejects.toThrow("DM-Rechte");
  expect((await catalogRoute(new Request(`http://localhost?map=${id}`), { params: Promise.resolve({ campaignId }) })).status).toBe(404);
  actor("DM", foreignId); await expect(atlasDetail(campaignId, id)).rejects.toThrow(); expect((await imageRoute(new Request("http://localhost"), { params: Promise.resolve({ campaignId, mapId: id }) })).status).toBe(404);
  getSession.mockResolvedValue(null); expect((await imageRoute(new Request("http://localhost"), { params: Promise.resolve({ campaignId, mapId: id }) })).status).toBe(404);
});
it("returns only visible NPCs, organizations, missions and maps in Location information", async () => {
  await db.client.npc.create({ data: { campaignId, name: "PUBLIC_NPC", locationId, playerVisible: true } }); await db.client.npc.create({ data: { campaignId, name: "SECRET_NPC", locationId } });
  await db.client.organization.create({ data: { campaignId, name: "SECRET_ORG", type: "TEAM", locationId } }); await db.client.mission.create({ data: { campaignId, title: "SECRET_MISSION", rank: "S", locationId, status: "DRAFT", playerVisible: true } });
  await db.client.encounter.create({ data: { campaignId, name: "SECRET_ENCOUNTER", locationId } });
  actor("PLAYER"); const details = await atlasLocationDetail(campaignId, locationId); expect(JSON.stringify(details)).toContain("PUBLIC_NPC"); expect(JSON.stringify(details)).not.toContain("SECRET_"); expect(details?.encounters).toHaveLength(0); expect(await atlasLocationDetail(campaignId, secretLocation)).toBeNull();
});
it("allows safe confirmed deletion only after archival and preserves Locations", async () => {
  const id = await create({ locationId }); await image(id); const imageKey = (await current(id)).imageKey!;
  await expect(mutateAtlas(campaignId, request("DELETE_MAP", id, (await current(id)).version))).rejects.toThrow();
  await mutateAtlas(campaignId, request("SAVE_MAP", id, (await current(id)).version, mapData({ archived: true })));
  const fd = request("DELETE_MAP", id, (await current(id)).version); fd.set("confirmation", "Map"); await mutateAtlas(campaignId, fd);
  expect(await db.client.location.findUnique({ where: { id: locationId } })).not.toBeNull(); await expect(atlasStorage().read(imageKey)).rejects.toThrow();
});
it("checks upload origins before mutations", async () => {
  const fd = request("CREATE_MAP", "", 1, mapData()); const response = await mutateRoute(new Request("http://localhost/api", { method: "POST", headers: { origin: "http://other" }, body: fd }), { params: Promise.resolve({ campaignId }) }); expect(response.status).toBe(403);
});
it("seeds only a global template and imports the canonical world once without overwriting manual data", async () => {
  const baseline = await db.client.location.count({ where: { campaignId } }); await seedWorldAtlas(db.client); const template = await db.client.atlasWorldTemplate.findUniqueOrThrow({ where: { seedKey: SHIO_ATLAS_KEY } }); await seedWorldAtlas(db.client);
  expect(await db.client.atlasWorldTemplate.findUnique({ where: { seedKey: SHIO_ATLAS_KEY } })).toEqual(template); expect(await db.client.location.count({ where: { campaignId } })).toBe(baseline);
  const reused = await db.client.location.create({ data: { campaignId, name: "Reigan", slug: "manual-reigan", description: "MANUAL", playerVisible: false } });
  const beforeMaps = await db.client.worldMap.count({ where: { campaignId } }), root = await importShioAtlas(campaignId); expect(root).toBeTruthy(); expect(await db.client.worldMap.count({ where: { campaignId } })).toBe(beforeMaps + shioMaps.length);
  expect(await db.client.atlasLocationSeed.count({ where: { campaignId } })).toBe(shioLocations.length); expect(await db.client.mapMarker.count({ where: { map: { campaignId, seedKey: { not: null } } } })).toBe(shioMarkers.length);
  expect(await db.client.location.findUnique({ where: { id: reused.id } })).toEqual(reused);
  await db.client.worldMap.update({ where: { id: root! }, data: { name: "Manually customized" } }); const count = await db.client.location.count({ where: { campaignId } }); expect(await importShioAtlas(campaignId)).toBe(root); expect(await db.client.location.count({ where: { campaignId } })).toBe(count); expect((await current(root!)).name).toBe("Manually customized");
  actor("PLAYER"); await expect(importShioAtlas(campaignId)).rejects.toThrow("DM-Rechte"); expect(await db.client.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
}, 120000);
