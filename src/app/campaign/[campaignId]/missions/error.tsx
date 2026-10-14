"use client";
export default function MissionError({ retry }: { error: Error; retry: () => void }) { return <main className="shell"><h1>Mission nicht verfügbar</h1><p role="alert">Bitte Kampagnenzugang prüfen und erneut versuchen.</p><button className="button primary" onClick={retry}>Erneut versuchen</button></main>; }
