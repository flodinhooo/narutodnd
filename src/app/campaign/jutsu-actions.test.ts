import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCampaign, revalidatePath, prisma } = vi.hoisted(() => ({ requireCampaign: vi.fn(), revalidatePath: vi.fn(), prisma: {
  chakraNature: { count: vi.fn() },
  jutsu: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  character: { findFirst: vi.fn() },
  characterJutsu: { create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  jutsuChakraNature: { deleteMany: vi.fn() },
  jutsuPrerequisite: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/session", () => ({ requireCampaign }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/rules", () => ({ calculateMaxChakra: vi.fn(), clamp: vi.fn((value: number) => value), getLimitBreakHpCost: vi.fn(), longRestState: vi.fn(), preserveChakra: vi.fn(), shortRestState: vi.fn() }));

import { createCustomJutsu, deleteCustomJutsu, updateCustomJutsu } from "./campaign-actions";
import { toggleJutsu } from "../dm-actions";

const a = "campaign-a", b = "campaign-b";
const nature = { id: "fire", key: "FIRE" };
const global = { id: "global", campaignId: null, origin: "CANON", slug: "global" };
const customA = { id: "custom-a", campaignId: a, origin: "DM_CUSTOM", slug: "custom-a" };
const customB = { id: "custom-b", campaignId: b, origin: "DM_CUSTOM", slug: "custom-b" };
const form = (extra: Record<string, string | string[] | undefined> = {}) => { const fd = new FormData(); for (const [key, value] of Object.entries({ name: "Crimson Thunder", rank: "B", chakraCost: "12", description: "A custom technique", natureIds: [nature.id], ...extra })) for (const v of Array.isArray(value) ? value : [value]) if (v !== undefined) fd.append(key, v); return fd; };

beforeEach(() => { vi.clearAllMocks(); requireCampaign.mockResolvedValue({ campaignId: a, role: "DM" }); prisma.chakraNature.count.mockResolvedValue(1); prisma.jutsu.findMany.mockResolvedValue([]); prisma.jutsu.findFirst.mockResolvedValue(null); prisma.jutsu.create.mockResolvedValue({ id: "created", campaignId: a, origin: "DM_CUSTOM" }); prisma.character.findFirst.mockResolvedValue({ id: "character-a", campaignId: a }); prisma.$transaction.mockImplementation(async (work: unknown) => typeof work === "function" ? work(prisma) : Promise.all(work as Promise<unknown>[])); });

describe("custom jutsu server actions", () => {
  it("creates DM_CUSTOM in the authenticated campaign and ignores form campaign IDs", async () => { await createCustomJutsu(a, form({ campaignId: b })); expect(prisma.jutsu.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ campaignId: a, origin: "DM_CUSTOM" }) })); });
  it("rejects players before touching persistence", async () => { requireCampaign.mockRejectedValueOnce(new Error("Unauthorized")); await expect(createCustomJutsu(a, form())).rejects.toThrow("Unauthorized"); expect(prisma.jutsu.create).not.toHaveBeenCalled(); });
  it("rejects invalid natures and prerequisites", async () => { prisma.chakraNature.count.mockResolvedValueOnce(0); await expect(createCustomJutsu(a, form({ natureIds: "foreign-nature" }))).rejects.toThrow(); prisma.chakraNature.count.mockResolvedValueOnce(1); prisma.jutsu.findMany.mockResolvedValueOnce([]); await expect(createCustomJutsu(a, form({ prerequisiteIds: "foreign-jutsu" }))).rejects.toThrow(); });
  it("accepts global and same-campaign prerequisites but rejects another campaign", async () => { prisma.jutsu.findMany.mockResolvedValueOnce([global, customA]); await createCustomJutsu(a, form({ prerequisiteIds: [global.id, customA.id] })); expect(prisma.jutsu.create).toHaveBeenCalled(); prisma.jutsu.findMany.mockResolvedValueOnce([]); await expect(createCustomJutsu(a, form({ prerequisiteIds: customB.id }))).rejects.toThrow(); });
  it("rejects self prerequisite", async () => { prisma.jutsu.findFirst.mockResolvedValueOnce({ id: "same" }); await expect(updateCustomJutsu(a, "same", form({ id: "same", prerequisiteIds: "same" }))).rejects.toThrow(); });
  it("updates only own custom jutsu", async () => { prisma.jutsu.findFirst.mockResolvedValueOnce(customA); await updateCustomJutsu(a, customA.id, form()); expect(prisma.jutsu.update).toHaveBeenCalled(); prisma.jutsu.findFirst.mockResolvedValueOnce(null); await expect(updateCustomJutsu(a, customB.id, form())).rejects.toThrow(); prisma.jutsu.findFirst.mockResolvedValueOnce(null); await expect(updateCustomJutsu(a, global.id, form())).rejects.toThrow(); });
  it("rejects player update and deletes only own custom jutsu", async () => { requireCampaign.mockRejectedValueOnce(new Error("Unauthorized")); await expect(updateCustomJutsu(a, customA.id, form())).rejects.toThrow(); prisma.jutsu.findFirst.mockResolvedValueOnce(customA); await deleteCustomJutsu(a, customA.id); expect(prisma.characterJutsu.deleteMany).toHaveBeenCalledWith({ where: { jutsuId: customA.id } }); expect(prisma.jutsuChakraNature.deleteMany).toHaveBeenCalledWith({ where: { jutsuId: customA.id } }); expect(prisma.jutsuPrerequisite.deleteMany).toHaveBeenCalled(); expect(prisma.jutsu.delete).toHaveBeenCalledWith({ where: { id: customA.id } }); });
  it("blocks foreign, global, and player deletion", async () => { prisma.jutsu.findFirst.mockResolvedValueOnce(null); await expect(deleteCustomJutsu(a, customB.id)).rejects.toThrow(); prisma.jutsu.findFirst.mockResolvedValueOnce(null); await expect(deleteCustomJutsu(a, global.id)).rejects.toThrow(); requireCampaign.mockRejectedValueOnce(new Error("Unauthorized")); await expect(deleteCustomJutsu(a, customA.id)).rejects.toThrow(); });
  it("allows global and same-campaign assignment but rejects foreign assignment", async () => { prisma.jutsu.findFirst.mockResolvedValueOnce(global); await toggleJutsu(a, "character-a", global.id, "add"); prisma.jutsu.findFirst.mockResolvedValueOnce(customA); await toggleJutsu(a, "character-a", customA.id, "add"); prisma.jutsu.findFirst.mockResolvedValueOnce(null); await expect(toggleJutsu(a, "character-a", customB.id, "add")).rejects.toThrow(); expect(prisma.characterJutsu.create).toHaveBeenCalledTimes(2); });
});

describe("campaign visibility and library filters", () => {
  const visible = (item: { campaignId: string | null }, campaignId: string) => item.campaignId === null || item.campaignId === campaignId;
  const filter = (items: Array<{ campaignId: string | null; name: string; rank: string; origin: string; nature: string }>, q: string, rank: string, nature: string, origin: string, campaignId: string) => items.filter(x => visible(x, campaignId) && x.name.toLowerCase().includes(q.toLowerCase()) && x.rank === rank && x.nature === nature && x.origin === origin);
  const items = [{ campaignId: null, name: "Global Fire", rank: "B", origin: "CANON", nature: "FIRE" }, { campaignId: a, name: "Crimson Thunder", rank: "B", origin: "DM_CUSTOM", nature: "LIGHTNING" }, { campaignId: b, name: "Crimson Thunder", rank: "B", origin: "DM_CUSTOM", nature: "LIGHTNING" }];
  it("keeps global and own custom records while excluding foreign records", () => { expect(items.filter(x => visible(x, a))).toEqual([items[0], items[1]]); expect(items.filter(x => visible(x, b))).toEqual([items[0], items[2]]); });
  it("combines search, rank, nature, and origin filters", () => { expect(filter(items, "crimson", "B", "LIGHTNING", "DM_CUSTOM", a)).toEqual([items[1]]); expect(filter(items, "crimson", "B", "LIGHTNING", "DM_CUSTOM", b)).toEqual([items[2]]); });
  it("protects direct detail and prerequisite visibility through the same predicate", () => { expect(visible(customA, a)).toBe(true); expect(visible(customB, a)).toBe(false); expect([global, customA, customB].filter(x => visible(x, a))).not.toContain(customB); });
});
