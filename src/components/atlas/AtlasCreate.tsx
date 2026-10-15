"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import type { AtlasCatalog } from "@/lib/atlas-library";
import AtlasMapForm from "./AtlasMapForm";
export default function AtlasCreate({ campaignId, catalog }: { campaignId: string; catalog: AtlasCatalog }) {
  const [pending, setPending] = useState(false), [error, setError] = useState(""), router = useRouter(), busy = useRef(false), retry = useRef<{ fingerprint: string; requestId: string } | null>(null);
  async function send(op: string, data: unknown = {}) {
    if (busy.current) return; busy.current = true; setPending(true); setError("");
    const fingerprint = JSON.stringify({ op, data }); if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, requestId: crypto.randomUUID() };
    const fd = new FormData(); fd.set("op", op); fd.set("requestId", retry.current!.requestId); fd.set("data", JSON.stringify(data));
    try { const r = await fetch(`/api/campaign/${campaignId}/atlas`, { method: "POST", body: fd }), result = await r.json(); if (!r.ok) { retry.current = null; throw new Error(result.error); } toast.success("Atlas gespeichert."); router.push(result.mapId ? `/campaign/${campaignId}/atlas/${result.mapId}` : `/campaign/${campaignId}/atlas`); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Antwort nicht erhalten. Erneut versuchen."); }
    finally { busy.current = false; setPending(false); }
  }
  return <section>{error && <p className="accent" role="alert">{error}</p>}<details className="panel form"><summary>Eigene Karte erstellen</summary><AtlasMapForm catalog={catalog} pending={pending} save={data => send("CREATE_MAP", data)} /></details><section className="panel form"><h2>Shio no Kuni als Welt importieren</h2><p>Sechs Originalkarten, benannte Orte und Marker aus den kanonischen Bildern. Karten bleiben zunächst verborgen; bestehende Orte werden nach Möglichkeit ohne Änderungen wiederverwendet.</p><p>Wiederholter Import öffnet die vorhandene Welt und überschreibt keine Bearbeitungen.</p><button className="button primary" disabled={pending} onClick={() => { if (window.confirm("Shio no Kuni mit Karten, Orten und Markern in diese Kampagne importieren?")) void send("IMPORT_SHIO"); }}>{pending ? "Wird verarbeitet …" : "Shio no Kuni als Welt importieren"}</button></section></section>;
}
