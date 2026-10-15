"use client";
export default function ErrorPage({ retry }: { retry: () => void }) { return <main className="shell"><h1>Lore-Import nicht verfügbar</h1><p role="alert">Zugang und private Speicherkonfiguration prüfen.</p><button className="button" onClick={retry}>Erneut versuchen</button></main>; }
