import { expect, it } from "vitest";
import sharp from "sharp";
import { MAX_PORTRAIT_BYTES, processPortrait } from "./portrait-image";
it.each(["png", "jpeg", "webp"] as const)("decodes %s and re-encodes a bounded WebP", async format => {
  const input = await sharp({ create: { width: 1600, height: 800, channels: 3, background: "red" } }).toFormat(format).toBuffer();
  const p = await processPortrait(input, format === "jpeg" ? "image/jpeg" : `image/${format}`);
  expect(p.mimeType).toBe("image/webp"); expect(p.width).toBe(1024); expect(p.height).toBe(512);
  expect((await sharp(p.data).metadata()).exif).toBeUndefined();
});
it("supports an optional square focal crop without changing input", async () => {
  const input = await sharp({ create: { width: 200, height: 100, channels: 3, background: "blue" } }).png().toBuffer();
  const p = await processPortrait(input, "image/png", { x: 100, y: 0 }); expect(p.width).toBe(100); expect(p.height).toBe(100);
  await expect(processPortrait(input, "image/png", { x: NaN, y: 0 })).rejects.toThrow();
});
it("rejects spoofed MIME, SVG, executable data, truncated images and oversized files", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
  for (const [data, mime] of [[png, "image/jpeg"], [Buffer.from('<svg onload="alert(1)"/>'), "image/svg+xml"], [Buffer.from("MZ executable"), "image/png"], [png.subarray(0, 12), "image/png"], [Buffer.alloc(MAX_PORTRAIT_BYTES + 1), "image/png"]] as const) await expect(processPortrait(data, mime)).rejects.toThrow();
});
it("rejects images with excessive dimensions", async () => { const input = await sharp({ create: { width: 4097, height: 1, channels: 3, background: "red" } }).png().toBuffer(); await expect(processPortrait(input, "image/png")).rejects.toThrow(); });
