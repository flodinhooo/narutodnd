import { afterEach, expect, it, vi } from "vitest";
const { images } = vi.hoisted(() => ({ images: {
  create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(),
} }));
vi.mock("./prisma", () => ({ prisma: { privateImage: images } }));
import { privateImageStorage } from "./portrait-storage";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("persists PostgreSQL images without requiring a local production directory", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  vi.stubEnv("ATLAS_STORAGE_ROOT", "");
  const storage = privateImageStorage("ATLAS_STORAGE_ROOT", ".atlas-storage");
  const data = new Uint8Array([1, 2, 3]);
  const key = await storage.put(data);
  expect(images.create).toHaveBeenCalledWith({ data: { key, namespace: "ATLAS_STORAGE_ROOT", data: Buffer.from(data) } });
  images.findFirst.mockResolvedValue({ data });
  expect(await storage.read(key)).toEqual(data);
  expect(images.findFirst).toHaveBeenCalledWith({ where: { key, namespace: "ATLAS_STORAGE_ROOT" } });
  await storage.remove(key);
  expect(images.deleteMany).toHaveBeenCalledWith({ where: { key, namespace: "ATLAS_STORAGE_ROOT" } });
});

it("rejects invalid keys and missing images without exposing another namespace", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://test:test@localhost/test");
  const storage = privateImageStorage("PORTRAIT_STORAGE_ROOT", ".portrait-storage");
  await expect(storage.read("../../secret")).rejects.toThrow("Bildreferenz");
  expect(images.findFirst).not.toHaveBeenCalled();
  images.findFirst.mockResolvedValue(null);
  const key = "00000000-0000-0000-0000-000000000000.webp";
  await expect(storage.read(key)).rejects.toThrow("Bild fehlt");
  expect(images.findFirst).toHaveBeenCalledWith({ where: { key, namespace: "PORTRAIT_STORAGE_ROOT" } });
});
