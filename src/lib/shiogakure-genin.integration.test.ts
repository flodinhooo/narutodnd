import { afterAll, beforeAll, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { seedShiogakureGenin, geninNpcId } from "../../prisma/seed-shiogakure-genin";
import { SHIOGAKURE_GENIN } from "../../seeding/shiogakure-genin.seed";

let directory: string, db: PrismaClient;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "narutodnd-genin-tests-"));
  db = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.sqlite").replaceAll("\\", "/")}` });
  for (const name of (await readdir("prisma/migrations")).filter(n => /^\d/.test(n)).sort()) {
    const sql = (await readFile(join("prisma/migrations", name, "migration.sql"), "utf8")).replace(/^\s*--.*$/gm, "");
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement);
  }
  for (const key of ["FIRE", "WATER", "WIND", "EARTH", "NIKKOTON"]) await db.chakraNature.create({ data: { key, displayName: key, description: "" } });
}, 30000);
afterAll(async () => {
  await db?.$disconnect();
  if (directory) {
    const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("narutodnd-genin-tests-")) throw new Error("Unexpected cleanup path");
    await rm(target, { recursive: true, force: true });
  }
});

it("seeds ten unique NPCs per campaign and preserves edits on rerun", async () => {
  expect(new Set(SHIOGAKURE_GENIN.map(g => g.seedKey)).size).toBe(10);
  const campaign = await db.campaign.create({ data: { name: "Test", dmCodeHash: "dm", playerCodeHash: "player" } });
  await seedShiogakureGenin(db, campaign.id);
  const sora = await db.npc.findUniqueOrThrow({ where: { id: geninNpcId(campaign.id, SHIOGAKURE_GENIN[0].seedKey) } });
  await db.npc.update({ where: { id: sora.id }, data: { name: "Edited", archived: true } });
  await db.character.update({ where: { id: sora.characterId! }, data: { level: 4, currentHp: 2 } });
  const before = await db.npc.findMany({ include: { character: true }, orderBy: { id: "asc" } });
  await seedShiogakureGenin(db, campaign.id);
  expect(await db.npc.findMany({ include: { character: true }, orderBy: { id: "asc" } })).toEqual(before);
  expect(await db.npc.count()).toBe(10);
  expect(await db.character.count()).toBe(10);
  expect(await db.characterJutsu.count()).toBe(0);
  const akito = await db.npc.findFirstOrThrow({ where: { name: "Akito Kurogawa" }, include: { character: { include: { natureLinks: { include: { nature: true } } } } } });
  expect(akito.character!.natureLinks.map(n => n.nature.key)).toEqual(["FIRE"]);
  for (const name of ["Takumi Itohara", "Yui Itohara"]) {
    const npc = await db.npc.findFirstOrThrow({ where: { name } });
    expect(await db.characterChakraNature.count({ where: { characterId: npc.characterId! } })).toBe(0);
  }
  expect((await db.npc.findFirstOrThrow({ where: { name: "Nagi Shiranami" } })).dmSecrets).toContain("vorläufig");
  const second = await db.campaign.create({ data: { name: "Other", dmCodeHash: "dm2", playerCodeHash: "player2" } });
  const jutsu = await db.jutsu.create({ data: { slug: "candidate", name: "Existing approved technique", description: "", rank: "E", chakraCost: 1, range: "Self", duration: "Instantaneous", actionType: "Action" } });
  const genin = SHIOGAKURE_GENIN[0];
  await seedShiogakureGenin(db, second.id, { [genin.seedKey]: { [genin.startingJutsuNames[0]]: jutsu.id } });
  expect(await db.npc.count({ where: { campaignId: second.id } })).toBe(10);
  expect(await db.characterJutsu.findMany()).toMatchObject([{ jutsuId: jutsu.id }]);
  expect(await db.jutsu.count()).toBe(1);
});
