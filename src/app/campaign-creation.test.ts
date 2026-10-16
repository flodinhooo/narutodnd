import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), setSession: vi.fn(), setCreationHandoff: vi.fn(), redirect: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { campaign: { create: mocks.create } } }));
vi.mock("@/lib/session", () => ({
  makeCode: (prefix: string) => `${prefix}-TEST`,
  hashCode: (value: string) => `hash:${value}`,
  accessCodeLookup: (value: string) => `lookup:${value}`,
  setSession: mocks.setSession,
  setCreationHandoff: mocks.setCreationHandoff,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/rules", async () => await import("../lib/rules"));
import { createCampaign } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ id: "new-campaign" });
});

it("authenticates the creator before redirecting into the protected access page", async () => {
  const form = new FormData();
  form.set("name", "Shio no Kuni");
  await createCampaign(form);
  expect(mocks.setSession).toHaveBeenCalledWith("new-campaign", "DM");
  expect(mocks.setCreationHandoff).toHaveBeenCalledWith("new-campaign", "DM-TEST", "P-TEST");
  expect(mocks.redirect).toHaveBeenCalledWith("/campaign/new-campaign/access");
  expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.setSession.mock.invocationCallOrder[0]);
  expect(mocks.setSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.redirect.mock.invocationCallOrder[0]);
});

it("does not grant a session when campaign creation fails", async () => {
  mocks.create.mockRejectedValueOnce(new Error("Database unavailable"));
  const form = new FormData();
  form.set("name", "Shio no Kuni");
  await expect(createCampaign(form)).rejects.toThrow("Database unavailable");
  expect(mocks.setSession).not.toHaveBeenCalled();
  expect(mocks.setCreationHandoff).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
