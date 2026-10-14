"use client";

import Link from "next/link";
export default function EncounterErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="shell"><h1>Begegnung nicht verfügbar</h1><p role="alert">Prüfe deinen DM-Zugang zur Kampagne und versuche es erneut.</p><div className="actions"><button className="button primary" onClick={retry}>Erneut versuchen</button><Link className="button ghost" href="/campaigns/access">Kampagnenzugang öffnen</Link></div></main>;
}
