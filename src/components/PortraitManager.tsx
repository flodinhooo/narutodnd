"use client";
/* eslint-disable @next/next/no-img-element -- local previews and authenticated image endpoint */
import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Portrait from "./Portrait";
type Item = { id: string; label: string; version: number; isDefault: boolean; width: number; height: number };
type View = { portraits: Item[]; canEdit: boolean; owners: { id: string }[] };
export default function PortraitManager({ campaignId, kind, entityId, name }: { campaignId: string; kind: string; entityId: string; name: string }) {
  const endpoint = `/api/campaign/${campaignId}/portraits/${kind}/${entityId}`;
  const router = useRouter(), labelId = useId();
  const [view, setView] = useState<View | null>(null), [error, setError] = useState("");
  const [pending, setPending] = useState(false), [revision, setRevision] = useState(0), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState("");
  const [label, setLabel] = useState("Genin"), [replace, setReplace] = useState(""), [crop, setCrop] = useState(false), [x, setX] = useState(50), [y, setY] = useState(50);
  const load = useCallback(async () => { const r = await fetch(endpoint, { cache: "no-store" }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Portraits nicht verfügbar."); setView(data); }, [endpoint]);
  useEffect(() => { let active = true; fetch(endpoint, { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); if (active) setView(data); }).catch(() => { if (active) setError("Portraits konnten nicht geladen werden."); }); return () => { active = false; }; }, [endpoint]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function send(fd: FormData) {
    if (pending) return; setPending(true); setError("");
    try {
      const r = await fetch(endpoint, { method: "POST", body: fd }); const result = await r.json(); if (!r.ok) throw new Error(result.error || "Speichern fehlgeschlagen.");
      await load(); setRevision(v => v + 1); setFile(null); setPreview(""); setReplace(""); toast.success("Portrait gespeichert."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen."); }
    finally { setPending(false); }
  }
  function action(op: string, item: Item) { const fd = new FormData(); fd.set("op", op); fd.set("id", item.id); fd.set("version", String(item.version)); void send(fd); }
  return <details className="panel portrait-manager"><summary>Portraits und Varianten verwalten</summary><Portrait campaignId={campaignId} kind={kind} entityId={entityId} name={name} revision={revision} />
    {!view && !error && <p role="status">Portraits werden geladen …</p>}{error && <p role="alert">{error} <button type="button" onClick={() => void load().catch(() => setError("Laden fehlgeschlagen."))}>Neu laden</button></p>}
    {view && <><div className="portrait-variants">{view.portraits.map(p => <article key={`${p.id}:${p.version}`}><img src={`/api/portraits/${p.id}?v=${p.version}`} alt={`${name}: ${p.label}`} width={100} height={100} /><p>{p.label}{p.isDefault && " · Standard"}</p>{view.canEdit && <div className="combat-buttons"><button type="button" disabled={pending || p.isDefault} onClick={() => action("DEFAULT", p)}>Als Standard</button><button type="button" disabled={pending} onClick={() => { setReplace(p.id); setLabel(p.label); }}>Ersetzen</button><button type="button" disabled={pending} onClick={() => { if (window.confirm(`Portrait „${p.label}“ entfernen?`)) action("DELETE", p); }}>Entfernen</button></div>}</article>)}</div>
    {!view.portraits.length && <p>Noch kein Portrait. Bis dahin werden Initialen angezeigt.</p>}
    {view.canEdit && <form className="form" aria-busy={pending} onSubmit={e => {
      e.preventDefault(); if (!file) return; const fd = new FormData(); fd.set("op", "UPLOAD"); fd.set("file", file); fd.set("label", label); fd.set("crop", String(crop)); fd.set("x", String(x)); fd.set("y", String(y));
      if (replace) { const item = view.portraits.find(p => p.id === replace); if (!item) return; fd.set("id", item.id); fd.set("version", String(item.version)); } void send(fd);
    }}><fieldset disabled={pending} className="people-fields"><p>{replace ? "Vorhandenes Portrait ersetzen" : "Neue Variante hinzufügen"} · PNG, JPEG oder WebP, maximal 5 MB und 4096 × 4096 Pixel.</p>
      <label>Variante<input value={label} onChange={e => setLabel(e.target.value)} required maxLength={80} list={labelId} /></label><datalist id={labelId}>{["Kind / Akademie", "Genin", "Chunin", "Jonin", "Individuell"].map(v => <option key={v}>{v}</option>)}</datalist>
      <label>Bild vom Gerät<input key={revision} type="file" accept="image/png,image/jpeg,image/webp" required onChange={e => { const f = e.target.files?.[0]; if (f && f.size > 5 * 1024 * 1024) { setError("Das Bild darf höchstens 5 MB gross sein."); setFile(null); } else { setFile(f ?? null); setPreview(f ? URL.createObjectURL(f) : ""); setError(""); } }} /></label>
      {file && preview && <><label className="check"><input type="checkbox" checked={crop} onChange={e => setCrop(e.target.checked)} />Quadratischen Bildausschnitt speichern</label><img className={crop ? "portrait-preview cropped" : "portrait-preview"} src={preview} alt="Vorschau vor dem Speichern" style={{ objectPosition: `${x}% ${y}%` }} />{crop && <><label>Ausschnitt horizontal<input type="range" min={0} max={100} value={x} onChange={e => setX(Number(e.target.value))} /></label><label>Ausschnitt vertikal<input type="range" min={0} max={100} value={y} onChange={e => setY(Number(e.target.value))} /></label></>}</>}
      <p>Varianten ändern weder Rang noch Charakterwerte. Maximal zehn Portraits pro Person.</p><div className="actions"><button className="button primary" disabled={!file}>{pending ? "Wird gespeichert …" : replace ? "Portrait ersetzen" : "Portrait hochladen"}</button>{replace && <button type="button" onClick={() => setReplace("")}>Ersetzen abbrechen</button>}</div></fieldset></form>}
    {view.owners.length > 0 && <form className="form" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("op", "OWNER"); void send(fd); }}><label>Portrait-Verwaltung einem Spielerzugang zuweisen<select name="owner"><option value="">Nur DM</option>{view.owners.map(o => <option key={o.id} value={o.id}>Spielerzugang {o.id.slice(0, 8)}</option>)}</select></label><button disabled={pending}>Bearbeitungsrecht zuweisen</button><p>Zugänge sind browsergebunden. Nach einer neuen Anmeldung kann der DM die Zuordnung erneuern.</p></form>}</>}
  </details>;
}
