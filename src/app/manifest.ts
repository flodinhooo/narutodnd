import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Shio no Kuni – Naruto D&D", short_name: "Shiogakure", description: "Naruto-D&D-Kampagnenverwaltung", lang: "de", start_url: "/", display: "standalone", background_color: "#111314", theme_color: "#db7656", icons: [192, 512].map(size => ({ src: `/branding/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })) };
}
