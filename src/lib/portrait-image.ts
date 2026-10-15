import sharp from "sharp";
import { PortraitError } from "./private-image-error";
export { PortraitError } from "./private-image-error";
export const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024;
export async function processPortrait(bytes: Uint8Array, mime: string, crop?: { x: number; y: number }) {
  if (!bytes.length || bytes.length > MAX_PORTRAIT_BYTES) throw new PortraitError("Das Bild darf höchstens 5 MB gross sein.", 413);
  const formats: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" };
  if (!formats[mime]) throw new PortraitError("Bitte PNG, JPEG oder WebP auswählen.");
  try {
    const image = sharp(bytes, { limitInputPixels: 16_777_216, failOn: "warning", animated: true });
    const metadata = await image.metadata();
    if (metadata.format !== formats[mime] || (metadata.pages ?? 1) > 1 || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096) throw new Error();
    // Decode and re-encode; discard EXIF, embedded payloads and original filename.
    const oriented = await image.rotate().toBuffer();
    let output = sharp(oriented);
    if (crop) {
      if (![crop.x, crop.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error();
      const m = await output.metadata(), side = Math.min(m.width!, m.height!);
      output = output.extract({ left: Math.round((m.width! - side) * crop.x / 100), top: Math.round((m.height! - side) * crop.y / 100), width: side, height: side });
    }
    const { data, info } = await output.resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, byteSize: data.length, mimeType: "image/webp" };
  } catch { throw new PortraitError("Das Bild ist beschädigt, animiert, zu gross oder entspricht nicht dem angegebenen Format."); }
}
