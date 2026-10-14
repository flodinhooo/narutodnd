// Deterministic extraction of the supplied original. No redraw or AI variation.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const original = "public/branding/shiogakure-original.png";
const standard = await sharp(original).extract({ left: 220, top: 20, width: 650, height: 560 }).toBuffer();
const engraved = await sharp(original).extract({ left: 1092, top: 86, width: 145, height: 145 }).toBuffer();
await sharp(standard).resize(512, 512, { fit: "contain", background: "#e9e1d2" }).png().toFile("public/branding/logo-light.png");
await sharp(engraved).resize(256, 256).png().toFile("public/branding/logo-dark.png");
for (const size of [32, 180, 192, 512]) await sharp(standard).resize(size, size, { fit: "contain", background: "#e9e1d2" }).png().toFile(`public/branding/icon-${size}.png`);
const png = await sharp(standard).resize(32, 32, { fit: "contain", background: "#e9e1d2" }).ensureAlpha().png().toBuffer();
const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[6] = 32; header[7] = 32; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile("src/app/favicon.ico", Buffer.concat([header, png]));
await sharp(standard).resize(500, 500, { fit: "contain", background: "#e9e1d2" }).extend({ left: 350, right: 350, top: 65, bottom: 65, background: "#e9e1d2" }).png().toFile("public/branding/social.png");
