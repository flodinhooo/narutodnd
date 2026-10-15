import sharp from "sharp";
import { PortraitError } from "./portrait-image";
import { privateImageStorage } from "./portrait-storage";
export const atlasStorage = () => privateImageStorage("ATLAS_STORAGE_ROOT", ".atlas-storage");
export async function processMapImage(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new PortraitError("Kartenbilder dürfen höchstens 25 MiB gross sein.", 413);
  const formats: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" };
  if (!formats[mime]) throw new PortraitError("Bitte PNG, JPEG oder WebP auswählen.");
  try {
    const image = sharp(bytes, { limitInputPixels: 64_000_000, animated: true, failOn: "warning" }); const m = await image.metadata();
    if (m.format !== formats[mime] || (m.pages ?? 1) !== 1 || !m.width || !m.height || m.width > 12000 || m.height > 12000) throw new Error();
    const { data, info } = await image.rotate().webp({ lossless: true, effort: 4 }).toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, byteSize: data.length };
  } catch { throw new PortraitError("Kartenbild ist beschädigt, animiert, zu gross oder hat ein falsches Format."); }
}
