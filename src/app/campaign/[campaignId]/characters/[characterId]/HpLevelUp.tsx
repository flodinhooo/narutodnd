"use client";
import {useState} from "react";
import {confirmHpLevelUp, previewAutomaticHpRoll} from "@/app/hp-actions";
import {calculateHpContribution, getAbilityModifier, getEffectiveHpRoll, getHitDieMaximum, getHitDieMinimum, type HpLevelRoll} from "@/lib/rules";

export default function HpLevelUp({campaignId, characterId, character}: {
 campaignId: string; characterId: string;
 character: {level: number; hitDie: string; con: number; maxHp: number; currentHp: number; hpLegacyLevel: number | null; hpLevels: HpLevelRoll[]};
}) {
 const [current, setCurrent] = useState({level: character.level, maxHp: character.maxHp, currentHp: character.currentHp});
 const [target, setTarget] = useState(Math.min(20, character.level + 1));
 const [mode, setMode] = useState<"AUTO" | "MANUAL" | null>(null);
 const [raw, setRaw] = useState("");
 const [automatic, setAutomatic] = useState<Awaited<ReturnType<typeof previewAutomaticHpRoll>> | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const next = current.level + 1;
 const saved = character.hpLevels.find(item => item.level === next);
 const legacy = next <= (character.hpLegacyLevel ?? 1);
 let effective: number | null = null;
 const rawRoll = saved?.rawRoll ?? (mode === "AUTO" ? automatic?.rawRoll : raw === "" ? null : Number(raw));
 try { if (rawRoll != null) effective = getEffectiveHpRoll(saved?.hitDie ?? character.hitDie, rawRoll); } catch {}
 const minimum = getHitDieMinimum(saved?.hitDie ?? character.hitDie);
 const con = getAbilityModifier(character.con);
 const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
 const canConfirm = !busy && Number.isInteger(target) && target >= next && target <= 20 && (legacy || effective !== null);
 const run = async (work: () => Promise<void>) => {
  setBusy(true); setError("");
  try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Level-Up fehlgeschlagen"); }
  finally { setBusy(false); }
 };
 if (current.level >= 20) return <p className="muted">Maximales Level erreicht.</p>;
 return <section className="form panel">
  <h3>Level-Up · Trefferpunkte für Level {next}</h3>
  <p>Hit Die: {saved?.hitDie ?? character.hitDie} · Aktuell {current.currentHp} / {current.maxHp} HP</p>
  <label>Ziel-Level<input type="number" min={next} max={20} value={target} disabled={busy} onChange={e => setTarget(Number(e.target.value))}/></label>
  <p className="muted">Jedes fehlende Level wird einzeln bestätigt. Bestehender Schaden bleibt erhalten.</p>
  {legacy ? <p>Dieses Level ist bereits in der Legacy-Baseline enthalten. Es wird kein historischer Wurf erfunden.</p> : saved ? <p>Bestätigter Wurf wird wiederverwendet. Kein erneutes Würfeln.</p> : <>
   <div className="segmented">
    <button type="button" className={mode === "AUTO" ? "selected" : ""} disabled={busy} onClick={() => void run(async () => {setMode("AUTO"); if (!automatic) setAutomatic(await previewAutomaticHpRoll(campaignId, characterId, next));})}>Automatisch würfeln</button>
    <button type="button" className={mode === "MANUAL" ? "selected" : ""} disabled={busy} onClick={() => setMode("MANUAL")}>Selbst würfeln</button>
   </div>
   {mode === "MANUAL" && <label>Gewürfelte Zahl<input type="number" min={1} max={getHitDieMaximum(character.hitDie)} step={1} value={raw} disabled={busy} onChange={e => setRaw(e.target.value)}/></label>}
  </>}
  {effective !== null && rawRoll != null && <div className="review-grid">
   <span>Gewürfelt<strong>{rawRoll}</strong></span><span>Mindestwert<strong>{minimum}</strong></span>
   <span>Gewerteter Wurf<strong>{effective}</strong></span><span>CON-Modifikator<strong>{signed(con)}</strong></span>
   <span>HP-Zuwachs<strong>{signed(calculateHpContribution(saved?.hitDie ?? character.hitDie, rawRoll, character.con))}</strong></span>
  </div>}
  {error && <p role="alert">{error}</p>}
  <button type="button" className="button primary" disabled={!canConfirm} onClick={() => void run(async () => {
   const fd = new FormData(); fd.set("level", String(next));
   if (!saved && !legacy) {fd.set("mode", mode ?? ""); if (mode === "AUTO") fd.set("token", automatic?.token ?? ""); else fd.set("rawRoll", raw);}
   const result = await confirmHpLevelUp(campaignId, characterId, fd);
   setCurrent(result); setRaw(""); setAutomatic(null); setMode(null);
   if (result.level >= target) location.reload();
  })}>{busy ? "Bitte warten …" : `Level ${next} bestätigen`}</button>
 </section>;
}
