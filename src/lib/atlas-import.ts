import { prisma } from "./prisma";
import { atlasActor } from "./atlas-library";
import { atlasStorage, processMapImage } from "./atlas-image";
import { PortraitError } from "./portrait-image";
import { shioMaps, shioLocations, shioMarkers, SHIO_ATLAS_KEY } from "../../seeding/world-atlas";
import { validateShioAtlas } from "../../prisma/seed-world-atlas";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export async function importShioAtlas(campaignId: string) {
  await atlasActor(campaignId, true);
  const receipt = await prisma.atlasImport.findUnique({ where: { campaignId_seedKey: { campaignId, seedKey: SHIO_ATLAS_KEY } } });
  if (receipt) return receipt.rootMapId && await prisma.worldMap.findFirst({ where: { id: receipt.rootMapId, campaignId } }) ? receipt.rootMapId : null;
  const template = await prisma.atlasWorldTemplate.findUnique({ where: { seedKey: SHIO_ATLAS_KEY } });
  if (!template || template.manifestHash !== await validateShioAtlas()) throw new PortraitError("Kanonische Atlas-Vorlage fehlt oder hat sich geändert. Bitte den registrierten Seed ausführen.");
  const storage = atlasStorage(), prepared: { key: string; imageKey: string; width: number; height: number; byteSize: number }[] = [];
  let committed = false;
  try {
    for (const m of shioMaps) { const bytes = await readFile(join(process.cwd(), "assets", "world-atlas", "shio", m.asset)); const image = await processMapImage(bytes, "image/png"); prepared.push({ key: m.key, imageKey: await storage.put(image.data), width: image.width, height: image.height, byteSize: image.byteSize }); }
    const result = await prisma.$transaction(async tx => {
      const prior = await tx.atlasImport.findUnique({ where: { campaignId_seedKey: { campaignId, seedKey: SHIO_ATLAS_KEY } } });
      if (prior) return { rootId: prior.rootMapId, used: false };
      const current = await tx.worldMap.aggregate({ where: { campaignId }, _count: true, _sum: { imageBytes: true } });
      if (current._count + shioMaps.length > 100 || (current._sum.imageBytes ?? 0) + prepared.reduce((s, p) => s + p.byteSize, 0) > 512 * 1024 * 1024) throw new PortraitError("Atlas-Speicherlimit erreicht.");
      const locations = new Map<string, string>(), maps = new Map<string, string>();
      for (const l of shioLocations) {
        const parentId = l.parent ? locations.get(l.parent)! : null, seedKey = `${SHIO_ATLAS_KEY}:location:${l.key}`;
        const aliases = l.key === "reigan" ? [l.name, "Reigan", "Shiogakure"] : [l.name];
        const matching = await tx.location.findMany({ where: { campaignId, name: { in: aliases } } });
        const scoped = matching.filter(x => x.parentId === parentId), existing = scoped.length === 1 ? scoped[0] : matching.length === 1 ? matching[0] : null;
        const created = existing || await tx.location.create({ data: { campaignId, name: l.name, type: l.type, description: l.description, shortDescription: "Importiert aus der kanonischen Shio-no-Kuni-Weltvorlage.", parentId, slug: `shio-${l.key}-${randomUUID().slice(0, 8)}`, playerVisible: !l.secret } });
        locations.set(l.key, created.id);
        await tx.atlasLocationSeed.create({ data: { campaignId, seedKey, locationId: created.id } });
      }
      for (const m of shioMaps) {
        const image = prepared.find(p => p.key === m.key)!;
        const created = await tx.worldMap.create({ data: { campaignId, name: m.name, type: m.type, parentId: m.parent ? maps.get(m.parent)! : null, locationId: m.location ? locations.get(m.location)! : null, imageKey: image.imageKey, imageWidth: image.width, imageHeight: image.height, imageBytes: image.byteSize, seedKey: `${SHIO_ATLAS_KEY}:map:${m.key}`, description: m.key === "world" ? "Shio liegt östlich von Konoha, südlich des Blitzreichs und nordwestlich des Wasserreichs." : "Unveränderte kanonische Originalkarte. Sichtbare Rasterbeschriftungen bleiben Bestandteil des Bildes.", dmNotes: "Alle Karten sind zunächst verborgen. Vor Veröffentlichung die bereits im Bild enthaltenen Ortsbeschriftungen prüfen." } }); maps.set(m.key, created.id);
      }
      for (const m of shioMarkers) { const location = shioLocations.find(l => l.key === m.location)!; await tx.mapMarker.create({ data: { mapId: maps.get(m.map)!, x: m.x, y: m.y, title: location.name, description: location.description, category: m.category, icon: m.icon, playerVisible: !location.secret, locationId: locations.get(m.location)!, childMapId: m.child ? maps.get(m.child)! : null, seedKey: m.key } }); }
      const rootId = maps.get("world")!; await tx.atlasImport.create({ data: { campaignId, seedKey: SHIO_ATLAS_KEY, rootMapId: rootId } }); return { rootId, used: true };
    }, { timeout: 60000 });
    committed = result.used; return result.rootId;
  } finally { if (!committed) await Promise.all(prepared.map(p => storage.remove(p.imageKey))); }
}
