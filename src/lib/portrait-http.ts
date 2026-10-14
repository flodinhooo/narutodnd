import { Prisma } from "@prisma/client";
import { PortraitError } from "./portrait-image";
export function portraitFailure(error: unknown) {
  if (error instanceof PortraitError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) return Response.json({ error: "Gleichzeitige Änderung oder ungültige Verknüpfung. Bitte neu laden." }, { status: 409 });
  console.error("Portrait-Anfrage fehlgeschlagen.");
  return Response.json({ error: "Bild konnte nicht verarbeitet werden." }, { status: 500 });
}
export async function portraitForm(request: Request) {
  const origin = request.headers.get("origin");
  // Next may use localhost internally even when the browser connects through
  // a public hostname/reverse proxy. Compare with the actual HTTP Host header.
  const host = request.headers.get("host") || new URL(request.url).host;
  if (!origin || new URL(origin).host !== host || !["http:", "https:"].includes(new URL(origin).protocol)) throw new PortraitError("Ungültiger Anfrageursprung.", 403);
  const reader = request.body?.getReader(); if (!reader) throw new PortraitError("Keine Formulardaten.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 6 * 1024 * 1024) { await reader.cancel(); throw new PortraitError("Upload ist zu gross.", 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") || "" }, body: bytes }).formData(); }
  catch { throw new PortraitError("Ungültiger Bild-Upload."); }
}
