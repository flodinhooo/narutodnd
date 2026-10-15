"use client";
export default function AtlasError({ retry }: { retry: () => void }) { return <main className="shell"><h1>Atlas konnte nicht geladen werden.</h1><p>Zugang prüfen und erneut versuchen.</p><button className="button primary" onClick={retry}>Erneut versuchen</button></main>; }
