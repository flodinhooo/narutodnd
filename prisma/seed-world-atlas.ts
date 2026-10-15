import type { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { shioBlueprint, shioMaps, shioLocations, shioMarkers, SHIO_ATLAS_KEY } from "../seeding/world-atlas";
import { assertAtlasParent, markerInput } from "../src/lib/atlas-schema";
export async function validateShioAtlas() {
  for (const items of [shioMaps, shioLocations, shioMarkers]) if (new Set(items.map(i => i.key)).size !== items.length) throw new Error("Doppelte Atlas-Seed-Keys.");
  for (const m of shioMaps) assertAtlasParent(shioMaps.map(x => ({ id: x.key, parentId: x.parent })), m.key, m.parent);
  for (const l of shioLocations) assertAtlasParent(shioLocations.map(x => ({ id: x.key, parentId: x.parent })), l.key, l.parent);
  for (const m of shioMarkers) {
    const l = shioLocations.find(l => l.key === m.location); if (!l || !shioMaps.some(map => map.key === m.map) || (m.child && !shioMaps.some(map => map.key === m.child && map.parent === m.map))) throw new Error("Ungültige Atlas-Seed-Referenz.");
    markerInput.parse({ x: m.x, y: m.y, category: m.category, icon: m.icon, title: l.name, description: "", locationId: m.location, childMapId: m.child, color: "#d7ae68", playerVisible: !l.secret });
  }
  const assets = await Promise.all(shioMaps.map(async map => {
    const data = await readFile(join(process.cwd(), "assets", "world-atlas", "shio", map.asset)); const m = await sharp(data).metadata();
    if (m.format !== "png" || m.width !== map.width || m.height !== map.height) throw new Error(`Kanonisches Kartenasset ungültig: ${map.asset}`);
    return { key: map.key, sha256: createHash("sha256").update(data).digest("hex") };
  }));
  return createHash("sha256").update(JSON.stringify({ blueprint: shioBlueprint, assets })).digest("hex");
}
export async function seedWorldAtlas(prisma: PrismaClient) {
  const manifestHash = await validateShioAtlas(); const old = await prisma.atlasWorldTemplate.findUnique({ where: { seedKey: SHIO_ATLAS_KEY } });
  if (old?.manifestHash === manifestHash) return 1;
  const data = { name: "Shio no Kuni", description: "Sechs Originalkarten mit Ortsstruktur und bildbasierten Markern. Import erfolgt ausschliesslich auf DM-Anweisung.", manifestHash, blueprint: shioBlueprint };
  await prisma.atlasWorldTemplate.upsert({ where: { seedKey: SHIO_ATLAS_KEY }, create: { seedKey: SHIO_ATLAS_KEY, ...data }, update: data }); return 1;
}
