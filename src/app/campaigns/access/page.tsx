import Link from "next/link";
import { enterCampaign } from "@/app/actions";

export default function Access() {
  return <main className="shell narrow"><Link href="/" className="back">← Startseite</Link><div className="eyebrow">KAMPAGNENZUGANG</div><h1>Kampagne beitreten</h1><p className="muted">Gib deinen Zugangscode ein.</p><p className="muted">Der Code bestimmt automatisch, welcher Kampagne du beitrittst und ob du als Spielleitung oder Spieler eintrittst.</p><form action={enterCampaign} className="panel form"><label>Zugangscode<input name="code" required /></label><button className="button primary">Kampagne betreten <span>→</span></button></form></main>;
}
