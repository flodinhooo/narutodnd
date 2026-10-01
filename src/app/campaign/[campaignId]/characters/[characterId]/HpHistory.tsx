import {getDerivedCharacterHp} from "@/lib/character-hp";
import {calculateHpContribution, getAbilityModifier, getHitDieMaximum, getHitDieMinimum, type HpLevelRoll} from "@/lib/rules";

export default function HpHistory({character: c}: {character: {
 level: number; con: number; hitDie: string; maxHp: number; hpOverrideOffset: number | null;
 hpLegacyLevel: number | null; hpLegacyBase: number | null; hpLevels: HpLevelRoll[];
}}) {
 const modifier = getAbilityModifier(c.con);
 const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
 return <details className="panel hp-history"><summary>HP-Entwicklung</summary>
  {c.hpLegacyBase !== null ? <p>Legacy-Baseline bis Level {c.hpLegacyLevel}: {c.hpLegacyBase} HP ohne CON. Frühere Würfe sind nicht bekannt; die Baseline bleibt auch bei niedrigeren Levels erhalten.</p> : <p>Level 1 — {c.hitDie} Maximum: {getHitDieMaximum(c.hitDie)}</p>}
  <ul>{[...c.hpLevels].sort((a,b) => a.level - b.level).map(roll => <li key={roll.level} className={roll.level > c.level ? "muted" : ""}>
   Level {roll.level} — {roll.hitDie}: Wurf {roll.rawRoll} → {roll.rawRoll < getHitDieMinimum(roll.hitDie) ? `Minimum ${roll.effectiveRoll}` : roll.effectiveRoll}; CON {signed(modifier)}; HP {signed(calculateHpContribution(roll.hitDie, roll.rawRoll, c.con))}{roll.level > c.level ? " (inaktiv)" : ""}
  </li>)}</ul>
  <p>Aktueller CON-Anteil: {signed(modifier)} × {c.level} Level = {signed(modifier * c.level)} HP</p>
  <p>Regelbasierte HP: <strong>{getDerivedCharacterHp(c)}</strong>{c.hpOverrideOffset !== null && <> · DM-Override-Aufschlag: {signed(c.hpOverrideOffset)}</>}</p>
  <p>Maximum: <strong>{c.maxHp} HP</strong></p>
 </details>;
}
