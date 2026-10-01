"use client";
import {useMemo, useState} from "react";
import {createCharacter} from "@/app/actions";
import {
    calculateBaseArmorClass,
    calculateInitiativeBonus,
    calculateMaxChakra,
    calculateMaxHp,
    getEffectiveHpRoll,
    getHitDieMaximum,
    getFinalAbilityScores,
    getCreationAbilityScores,
    type Ability as RuleAbility,
    type HitDie,
    getAbilityModifier,
    getProficiencyBonus,
    pointBuyCost,
    pointBuyTotal,
    validPointBuy,
    skills,
    standardArray
} from "@/lib/rules";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
const abilities: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];
const names: Record<Ability, string> = {
    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma"
};
const short: Record<Ability, string> = {str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA"};
const skillNames: Record<string, string> = {
    Acrobatics: "Acrobatics",
    AnimalHandling: "Animal Handling",
    Arcana: "Arcana",
    Athletics: "Athletics",
    Deception: "Deception",
    History: "History",
    Insight: "Insight",
    Intimidation: "Intimidation",
    Investigation: "Investigation",
    Medicine: "Medicine",
    Nature: "Nature",
    Perception: "Perception",
    Performance: "Performance",
    Persuasion: "Persuasion",
    Religion: "Religion",
    SleightOfHand: "Sleight of Hand",
    Stealth: "Stealth",
    Survival: "Survival"
};

const steps = ["Shinobi-Typ", "Grundlagen", "Attribute", "Fertigkeiten", "Chakra", "Jutsu", "Kampf", "\u00dcbersicht"];
const label = (x: string) => x.replaceAll("_", " ").toLowerCase().replace(/(^| )\S/g, c => c.toUpperCase());
const signed = (x: number) => `${x >= 0 ? "+" : ""}${x}`;
type State = {
    hitDie: HitDie | null;
    hitDieAbilityBonus: RuleAbility | null;
    name: string;
    level: number;
    background: string;
    alignment: string;
    description: string;
    mode: "MANUAL" | "STANDARD_ARRAY" | "POINT_BUY";
    baseScores: Record<Ability, number>;
    array: Record<Ability, number | null>;
    saving: string[];
    skill: string[];
    nature: string;
    reservoir: string;
    regen: string;
    control: string;
    jutsu: string[];
    hpRolls: Record<number, {mode: "AUTO" | "MANUAL"; raw: string}>;
    speed: number
};
const initial: State = {
    hitDie: null,
    hitDieAbilityBonus: null,
    name: "",
    level: 1,
    background: "",
    alignment: "",
    description: "",
    mode: "MANUAL",
    baseScores: {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10},
    array: {str: null, dex: null, con: null, int: null, wis: null, cha: null},
    saving: [],
    skill: [],
    nature: "",
    reservoir: "AVERAGE",
    regen: "TRAINED",
    control: "TRAINED",
    jutsu: [],
    hpRolls: {},
    speed: 30
};
export default function Creator({campaignId, natures, jutsu}: {
    campaignId: string;
    natures: { key: string; displayName: string }[];
    jutsu: {
        id: string;
        name: string;
        germanName: string | null;
        rank: string;
        chakraCost: number;
        range: string;
        actionType: string;
        natures: { nature: { key: string; displayName: string } }[]
    }[]
}) {
    const [step, setStep] = useState(0);
    const [s, setS] = useState<State>(initial);
    const patch = (p: Partial<State>) => setS(v => ({...v, ...p}));
    const setScore = (a: Ability, v: number) => patch({baseScores: {...s.baseScores, [a]: v}});
    const assign = (a: Ability, v: string) => {
        const n = v ? Number(v) : null;
        patch({array: {...s.array, [a]: n}, baseScores: {...s.baseScores, [a]: n ?? 10}})
    };
    const used = Object.values(s.array).filter((v): v is number => v !== null);
    const available = standardArray.filter(v => !used.includes(v));
    const compatible = useMemo(() => [...jutsu].filter(x => x.natures.some(n => n.nature.key === s.nature)).sort((a, b) => a.rank.localeCompare(b.rank) || a.name.localeCompare(b.name, "de")), [jutsu, s.nature]);
    const finalScores = getFinalAbilityScores(s.baseScores, s.hitDie, s.hitDieAbilityBonus);
    let validCreation = false;
    let validationError = "";
    try { getCreationAbilityScores(s.mode, s.baseScores, s.hitDie, s.hitDieAbilityBonus); validCreation = true; } catch (error) { validationError = error instanceof Error ? error.message : "Invalid character choices"; }
    const scoreLabel = (a: Ability) => `${s.baseScores[a]}${s.hitDie === "d8" && s.hitDieAbilityBonus === short[a] ? ` + 1 = ${finalScores[a]}` : ""}`;
    const max = calculateMaxChakra(s.level, finalScores.con, finalScores.wis, s.reservoir as never);
    const hpLevels = Array.from({length: Math.max(0, Math.min(20, Math.floor(s.level)) - 1)}, (_, i) => i + 2);
    let hpChoicesValid = Number.isInteger(s.level) && s.level >= 1 && s.level <= 20;
    let hasAutomatic = false;
    const previewRolls = hpLevels.flatMap(level => {
        const roll = s.hpRolls[level];
        if (roll?.mode === "AUTO") { hasAutomatic = true; return []; }
        try {
            const rawRoll = Number(roll?.raw);
            const effectiveRoll = getEffectiveHpRoll(s.hitDie, rawRoll);
            return [{level, hitDie: s.hitDie!, rawRoll, effectiveRoll}];
        } catch { hpChoicesValid = false; return []; }
    });
    let maxHp: number | null = null;
    if (validCreation && hpChoicesValid && !hasAutomatic && s.hitDie) maxHp = calculateMaxHp(s.level, finalScores.con, s.hitDie, previewRolls);
    const setHpRoll = (level: number, roll: {mode: "AUTO" | "MANUAL"; raw: string}) => patch({hpRolls: {...s.hpRolls, [level]: roll}});
    const ac = calculateBaseArmorClass(finalScores.dex);
    const remaining = 27 - pointBuyTotal(abilities.map(a => s.baseScores[a]));
    const go = (n: number) => setStep(Math.max(0, Math.min(7, n)));
    const change = (a: Ability, d: number) => {
        const n = s.baseScores[a] + d;
        if (n < 8 || n > 15) return;
        const scores = {...s.baseScores, [a]: n};
        if (pointBuyTotal(abilities.map(k => scores[k])) <= 27) setScore(a, n)
    };
    const canUp = (a: Ability) => s.baseScores[a] < 15 && pointBuyTotal(abilities.map(k => ({
        ...s.baseScores,
        [a]: s.baseScores[a] + 1
    })[k])) <= 27;
    return <main className="shell narrow"><a href={`/campaign/${campaignId}`} className="back"> Kampagne</a>
        <div className="eyebrow">CHARAKTERERSTELLUNG</div>
        <h1>Gestalte deinen Shinobi.</h1>
        <nav className="creator-steps" aria-label="Fortschritt">{steps.map((x, i) => <button type="button"
                                                                                             className={i === step ? "active" : ""}
                                                                                             onClick={() => i <= step && go(i)}
                                                                                             key={x}>{i + 1}. {x}</button>)}</nav>
        <form action={createCharacter.bind(null, campaignId)} className="panel form">{hpLevels.map(level => <span key={level} hidden><input type="hidden" name={`hpRollMode${level}`} value={s.hpRolls[level]?.mode ?? ""}/><input type="hidden" name={`hpRawRoll${level}`} value={s.hpRolls[level]?.raw ?? ""}/></span>)}<input type="hidden" name="hitDie" value={s.hitDie ?? ""}/>{s.hitDieAbilityBonus && <input type="hidden" name="hitDieAbilityBonus" value={s.hitDieAbilityBonus}/>}<input type="hidden" name="mode"
                                                                                            value={s.mode}/><input
            type="hidden" name="name" value={s.name}/><input type="hidden" name="level" value={s.level}/><input
            type="hidden" name="background" value={s.background}/><input type="hidden" name="alignment"
                                                                         value={s.alignment}/><input type="hidden"
                                                                                                     name="description"
                                                                                                     value={s.description}/><input
            type="hidden" name="speed" value={s.speed}/><input type="hidden" name="nature"
                                                                         value={s.nature}/><input type="hidden"
                                                                                                  name="reservoir"
                                                                                                  value={s.reservoir}/>{abilities.map(a =>
            <input type="hidden" name={a} value={s.baseScores[a]} key={a}/>)}{s.saving.map(x => <input type="hidden"
                                                                                                   name="savingThrow"
                                                                                                   value={x}
                                                                                                   key={x}/>)}{s.skill.map(x =>
            <input type="hidden" name="skill" value={x} key={x}/>)}{s.jutsu.map(x => <input type="hidden" name="jutsu"
                                                                                            value={x} key={x}/>)}
            {step === 0 && <><h2>Shinobi-Typ</h2><div className="two">{(["d8", "d10"] as const).map(die => <button type="button" key={die} aria-pressed={s.hitDie === die} className={`hit-die-card ${s.hitDie === die ? "selected" : ""}`} onClick={() => patch({hitDie: die, hitDieAbilityBonus: die === s.hitDie ? s.hitDieAbilityBonus : null, hpRolls: die === s.hitDie ? s.hpRolls : {}})}><strong>{die === "d8" ? "D8 - Talentiert" : "D10 - Robust"}</strong><span>Hit Die: {die}</span><small>{die === "d8" ? "Weniger natürliche Widerstandsfähigkeit, dafür +1 auf ein Attribut deiner Wahl." : "Mehr natürliche Widerstandsfähigkeit und höhere Trefferpunkte."}</small></button>)}</div></>}
            {step === 1 && <><h2>Grundlagen</h2><p className="muted">Name und Stufe sind erforderlich. Die brigen
                Angaben sind optional.</p><label>Name<input required value={s.name}
                                                            onChange={e => patch({name: e.target.value})}/></label><label>Stufe<input
                type="number" min="1" max="20" value={s.level} onChange={e => patch({level: Number(e.target.value)})}/></label><label>Hintergrund<input
                value={s.background}
                onChange={e => patch({background: e.target.value})}/></label><label>Ausrichtung<input
                value={s.alignment}
                onChange={e => patch({alignment: e.target.value})}/></label><label>Beschreibung<textarea
                value={s.description} onChange={e => patch({description: e.target.value})}/></label></>}
            {step === 2 && <><h2>Attribute</h2>
                {s.hitDie === "d8" && <section><h3>Talentbonus</h3><p>Wähle ein Attribut, das durch deinen Shinobi-Typ um +1 erhöht wird.</p><div className="segmented">{abilities.map(a => <button type="button" key={a} aria-pressed={s.hitDieAbilityBonus === short[a]} className={s.hitDieAbilityBonus === short[a] ? "selected" : ""} onClick={() => patch({hitDieAbilityBonus: short[a] as RuleAbility})}>{short[a]}</button>)}</div></section>}
                <div className="segmented">{(["MANUAL", "STANDARD_ARRAY", "POINT_BUY"] as const).map(x => <button
                    type="button" className={s.mode === x ? "selected" : ""} onClick={() => patch({mode: x, baseScores: x === "STANDARD_ARRAY" ? Object.fromEntries(abilities.map(a => [a, s.array[a] ?? 10])) as Record<Ability, number> : x === "POINT_BUY" && !validPointBuy(Object.values(s.baseScores)) ? {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8} : s.baseScores})}
                    key={x}>{x === "MANUAL" ? "Manuell" : x === "STANDARD_ARRAY" ? "Standardwerte" : "Punktekauf"}</button>)}</div>
                {s.mode === "STANDARD_ARRAY" ? <><p className="muted">Nicht zugewiesene
                    Werte: {available.length ? available.join(", ") : "keine"}</p>
                    <div className="ability-grid">{abilities.map(a => <label key={a}>{short[a]} {names[a]}<select
                        value={s.array[a] ?? ""} onChange={e => assign(a, e.target.value)}>
                        <option value="">Wert whlen</option>
                        {[...new Set([...(s.array[a] ? [s.array[a]] : []), ...available])].map(v => <option value={v}
                                                                                                            key={v}>{v} ({signed(getAbilityModifier(v))})</option>)}
                    </select><small>{scoreLabel(a)} / Modifikator {signed(getAbilityModifier(finalScores[a]))}</small></label>)}</div>
                </> : s.mode === "POINT_BUY" ? <><p className="points-remaining">Verbleibende Punkte: {remaining} /
                    27</p>
                    <div className="point-buy-grid">{abilities.map(a => <div className="score-control" key={a}>
                        <strong>{names[a]}</strong><span>{short[a]}</span>
                        <div>
                            <button type="button" disabled={s.baseScores[a] <= 8} onClick={() => change(a, -1)}
                                    aria-label={`${names[a]} senken`}></button>
                            <b>{s.baseScores[a]}</b>
                            <button type="button" disabled={!canUp(a)} onClick={() => change(a, 1)}
                                    aria-label={`${names[a]} erhhen`}>+
                            </button>
                        </div>
                        <small>{scoreLabel(a)} / Modifikator {signed(getAbilityModifier(finalScores[a]))} Kosten {pointBuyCost(s.baseScores[a])}</small>
                    </div>)}</div>
                </> : <><p className="muted">Manuelle Werte folgen den normalen Kampagnen-Grenzen.</p>
                    <div className="ability-grid">{abilities.map(a => <label key={a}>{short[a]} {names[a]}<input
                        type="number" min="1" max="20" value={s.baseScores[a]}
                        onChange={e => setScore(a, Number(e.target.value))}/><small>{scoreLabel(a)} / Modifikator {signed(getAbilityModifier(finalScores[a]))}</small></label>)}</div>
                </>}{!validCreation && <p role="status" className="muted">{validationError}</p>}</>}
            {step === 3 && <><h2>Fertigkeiten</h2><p className="muted">Whle bis zu 3 Fertigkeiten, die deinen
                Hintergrund und deine Ausbildung widerspiegeln.</p><p className="points-remaining">Gewhlte
                Fertigkeiten: {s.skill.length} / 3 bungsbonus {signed(getProficiencyBonus(s.level))}</p>
                <div className="prof-grid">
                    <section><h3>Rettungswrfe</h3>
                        <div className="compact-grid">{abilities.map(a => {
                            const k = a.toUpperCase();
                            return <label className="check" key={k}><input type="checkbox"
                                                                           checked={s.saving.includes(k)}
                                                                           onChange={() => patch({saving: s.saving.includes(k) ? s.saving.filter(x => x !== k) : [...s.saving, k]})}/><span>{names[a]} {signed(getAbilityModifier(finalScores[a]) + (s.saving.includes(k) ? getProficiencyBonus(s.level) : 0))}</span></label>
                        })}</div>
                    </section>
                    <section><h3>Fertigkeiten</h3>
                        <div className="compact-grid">{Object.entries(skills).map(([skill, a]) => {
                            const selected = s.skill.includes(skill);
                            const mod = getAbilityModifier(finalScores[a.toLowerCase() as Ability]) + (selected ? getProficiencyBonus(s.level) : 0);
                            return <label className="check" key={skill}><input type="checkbox" checked={selected}
                                                                               disabled={!selected && s.skill.length >= 3}
                                                                               onChange={() => patch({skill: selected ? s.skill.filter(x => x !== skill) : [...s.skill, skill]})}/><span>{skillNames[skill] ?? skill}<small>{a.toUpperCase()} {signed(mod)}</small></span></label>
                        })}</div>
                    </section>
                </div>
            </>}
            {step === 4 && <><h2>Chakra</h2><label>Primre Chakra-Natur<select required value={s.nature}
                                                                              onChange={e => patch({
                                                                                  nature: e.target.value,
                                                                                  jutsu: []
                                                                              })}>
                <option value="">Eine Natur whlen</option>
                {natures.map(n => <option key={n.key} value={n.key}>{n.displayName}</option>)}</select></label><label>Reservoir<select
                value={s.reservoir}
                onChange={e => patch({reservoir: e.target.value})}>{["VERY_LOW", "LOW", "AVERAGE", "HIGH", "VERY_HIGH", "EXCEPTIONAL", "MONSTER"].map(x =>
                <option key={x}>{label(x)}</option>)}</select></label><label>Chakra-Regeneration<select value={s.regen}
                                                                                                        onChange={e => patch({regen: e.target.value})}>{["NOVICE", "TRAINED", "ADVANCED", "EXPERT", "MASTER"].map(x =>
                <option key={x}>{label(x)}</option>)}</select></label><label>Chakra-Kontrolle<select value={s.control}
                                                                                                     onChange={e => patch({control: e.target.value})}>{["NOVICE", "TRAINED", "ADVANCED", "EXPERT", "MASTER"].map(x =>
                <option key={x}>{label(x)}</option>)}</select></label>
                <div className="preview"><small>MAXIMALES CHAKRA</small><strong>{max}</strong></div>
            </>}
            {step === 5 && <><h2>Jutsu</h2><p>Gewhlt: {s.jutsu.length} / 2</p>{compatible.length === 0 &&
                <div className="empty"><p>Whle zuerst eine Chakra-Natur.</p></div>}{compatible.map(x => <label
                className="check jutsu-choice" key={x.id}><input type="checkbox" checked={s.jutsu.includes(x.id)}
                                                                 disabled={!s.jutsu.includes(x.id) && s.jutsu.length >= 2}
                                                                 onChange={() => patch({jutsu: s.jutsu.includes(x.id) ? s.jutsu.filter(y => y !== x.id) : [...s.jutsu, x.id]})}/><span><strong>{x.name}</strong><small>Rang {x.rank} {x.chakraCost} Chakra {x.actionType} {x.range}</small></span></label>)}</>}
            {step === 6 && <><h2>Kampf</h2>{hpLevels.map(level => <section key={level}><h3>Trefferpunkte für Level {level}</h3><label>HP-Wurf<select value={s.hpRolls[level]?.mode ?? ""} onChange={e => setHpRoll(level, {mode: e.target.value as "AUTO" | "MANUAL", raw: ""})}><option value="">Wählen</option><option value="AUTO">Automatisch beim Erstellen würfeln</option><option value="MANUAL">Selbst würfeln</option></select></label>{s.hpRolls[level]?.mode === "MANUAL" && <label>Gewürfelte Zahl<input type="number" min={1} max={getHitDieMaximum(s.hitDie ?? "d10")} step={1} value={s.hpRolls[level].raw} onChange={e => setHpRoll(level, {...s.hpRolls[level], raw: e.target.value})}/></label>}{s.hpRolls[level]?.mode === "AUTO" && <p className="muted">Ein serverseitiger Wurf wird beim Bestätigen der Erstellung gespeichert.</p>}</section>)}<label>Bewegung<input type="number" min="0" value={s.speed}
                                                                 onChange={e => patch({speed: Number(e.target.value)})}/></label><div className="preview"><small>HIT DIE</small><strong>{s.hitDie ?? "Nicht gewählt"}</strong><small>MAXIMALE TP</small><strong>{maxHp ?? "Rolls ausstehend"}</strong><small>RÜSTUNGSKLASSE</small><strong>{ac}</strong><small>INITIATIVE</small><strong>{signed(calculateInitiativeBonus(finalScores.dex))}</strong></div><p className="muted">HP: {s.hitDie} + CON ({signed(getAbilityModifier(finalScores.con))}){s.level > 1 ? ` + ${s.level - 1} persistente Level-Rolls und CON je Level` : ""}. AC: 12 + DEX. Initiative: DEX.</p></>}
            {step === 7 && <>
                <h2>&Uuml;bersicht</h2>{[["Shinobi-Typ", 0], ["Grundlagen", 1], ["Attribute", 2], ["Fertigkeiten", 3], ["Chakra", 4], ["Jutsu", 5], ["Kampf", 6]].map(([title, target]) =>
                <section className="review-section" key={String(title)}>
                    <div className="section-heading"><h3>{title}</h3>
                        <button type="button" className="button ghost" onClick={() => go(Number(target))}>Bearbeiten
                        </button>
                    </div>
                    {title === "Shinobi-Typ" ? <p>Hit Die: {s.hitDie ?? "Nicht gewählt"}{s.hitDie === "d8" && <><br/>Talentbonus: {s.hitDieAbilityBonus ? `+1 ${s.hitDieAbilityBonus}` : "Bitte wählen"}</>}</p> : title === "Attribute" ? <div className="review-grid">{abilities.map(a => <span
                        key={a}>{short[a]} {names[a]}<strong>{finalScores[a]} ({signed(getAbilityModifier(finalScores[a]))})</strong>{s.hitDie === "d8" && s.hitDieAbilityBonus === short[a] && <small>Base {s.baseScores[a]} + D8 Bonus 1</small>}</span>)}</div> : title === "Kampf" ?
                        <div className="review-grid">
                            <span>Hit Die<strong>{s.hitDie ?? "Nicht gewählt"}</strong></span><span>Maximale TP<strong>{maxHp ?? "Rolls ausstehend"}</strong></span><span>Bewegung<strong>{s.speed} ft</strong></span><span>Initiative<strong>{signed(calculateInitiativeBonus(finalScores.dex))}</strong></span><span>bungsbonus<strong>{signed(getProficiencyBonus(s.level))}</strong></span><span>Rstungsklasse<strong>{ac}</strong></span>
                        </div> : title === "Chakra" ? <div className="review-grid">
                                <span>Natur<strong>{natures.find(n => n.key === s.nature)?.displayName || "Nicht gewhlt"}</strong></span><span>Reservoir<strong>{label(s.reservoir)}</strong></span><span>Maximales Chakra<strong>{max}</strong></span>
                            </div> :
                            <p>{title === "Grundlagen" ? `${s.name || "Nicht angegeben"}  Stufe ${s.level}` : title === "Fertigkeiten" ? `${s.skill.length} / 3 gewhlt` : title === "Jutsu" ? `${s.jutsu.length} Jutsu gewhlt` : ""}</p>}
                </section>)}
                {!hpChoicesValid && <p role="status">Bitte für jedes Level ab 2 einen gültigen HP-Wurf wählen.</p>}
                {!validCreation && <p role="status" className="muted">{validationError}</p>}
                <button className="button primary" type="submit" disabled={!validCreation || !hpChoicesValid}>Charakter erstellen</button>
            </>}
            <div className="creator-nav">{step > 0 ?
                <button type="button" className="button ghost" onClick={() => go(step - 1)}> Zurck</button> :
                <span/>}{step < 7 ?
                <button type="button" className="button primary" disabled={(step === 0 && !s.hitDie) || (step === 2 && !validCreation)} onClick={() => go(step + 1)}>Weiter </button> :
                <span/>}</div>
        </form>
    </main>;
}


