import { portraitImage } from "@/lib/portraits";
import { portraitFailure } from "@/lib/portrait-http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ portraitId: string }> }) {
  try { return await portraitImage((await params).portraitId); } catch (e) { return portraitFailure(e); }
}
