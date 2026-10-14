import type { EnemyTemplateInput } from "../src/lib/enemy-templates";
import { getAbilityModifier, getProficiencyBonus } from "../src/lib/rules";

type SeedInput = Omit<EnemyTemplateInput, "natureIds" | "jutsuIds">;
type EnemySeed = { key: string; data: SeedInput; natureKeys: string[]; jutsuSlugs: string[] };
const descriptions: Record<string, string> = {
  cat: "Eine flinke Hauskatze, die in den Gassen und auf den Dächern der Hafenstadt unterwegs ist.",
  dog: "Ein aufmerksamer Hofhund, der Fremde früh bemerkt und seine Bezugsperson verteidigt.",
  wolf: "Ein ausdauernder Rudeljäger aus den Wäldern entlang der Handelswege.",
  boar: "Ein kräftiges Wildschwein mit scharfen Hauern, das sein Revier und seine Jungen schützt.",
  "great-wolf": "Ein ungewöhnlich grosser Rudelführer mit dichtem Fell und einem gefährlichen Biss.",
  "street-robber": "Ein verzweifelter Gelegenheitstäter, der Reisende in abgelegenen Gassen bedroht.",
  bandit: "Ein bewaffneter Wegelagerer, der Karawanen gemeinsam mit seiner Bande überfällt.",
  "bandit-leader": "Ein erfahrener Bandenchef, der seine Gefolgsleute durch Einschüchterung und Beuteversprechen führt.",
  mercenary: "Ein disziplinierter Kämpfer ohne Chakra-Ausbildung, der für die Sicherheit zahlender Auftraggeber sorgt.",
  smuggler: "Ein ortskundiger Hafenkrimineller mit versteckter Klinge und Verbindungen zum Schwarzmarkt.",
  academy: "Ein junger Ninja in Ausbildung mit ersten Grundlagen der Chakra-Manipulation.",
  genin: "Ein frisch ernannter Shinobi, der einfache Aufträge unter Anleitung eines Teams übernimmt.",
  "veteran-genin": "Ein felderprobter Genin mit guter Beweglichkeit und ersten taktischen Feuertechniken.",
  chunin: "Ein verantwortungsbewusster Teamführer, der Wassertechniken mit solider Nahkampfausbildung kombiniert.",
  "chunin-specialist": "Ein analytischer Chunin, dessen Ausbildung auf Blitztechniken und Kontrolle des Kampffelds ausgerichtet ist.",
  jonin: "Ein vielseitiger Elite-Shinobi mit zwei Chakra-Naturen und langjähriger Erfahrung im Schutz seines Teams.",
  "nukenin-scout": "Ein abtrünniger Aufklärer, der Wege ausspäht und Informationen an seine Auftraggeber verkauft.",
  "nukenin-assassin": "Ein gesuchter Attentäter, der mit Windtechniken, Tarnung und gezielten Klingenangriffen arbeitet.",
  "nukenin-suiton": "Ein abtrünniger Wasserspezialist, der Küsten und Häfen zu seinem bevorzugten Jagdgebiet gemacht hat.",
  "elite-missing-nin": "Ein hochgefährlicher Nukenin mit aussergewöhnlichem Chakra und Erfahrung gegen organisierte Shinobi-Teams.",
};
function enemy(key: string, name: string, category: SeedInput["category"], difficulty: SeedInput["difficulty"], level: number, hp: number,
  scores: [number, number, number, number, number, number], weapon: string, dice: string, tactics: string,
  extra: Partial<SeedInput> = {}, natureKeys: string[] = [], jutsuSlugs: string[] = []): EnemySeed {
  const [str, dex, con, int, wis, cha] = scores;
  return { key: `bestiary:v1:${key}`, natureKeys, jutsuSlugs, data: {
    name, category, difficulty, level, description: descriptions[key],
    recommendedLevelMin: Math.max(1, level - 1), recommendedLevelMax: Math.min(20, level + 2),
    ninjaRank: null, maxHp: hp, acOverride: null, initiativeOverride: null, speed: 30,
    str, dex, con, int, wis, cha, hasChakra: natureKeys.length > 0,
    reservoir: "AVERAGE", customReservoirMultiplier: null, maxChakraOverride: null, controlRank: "TRAINED", regenRank: "TRAINED",
    attacks: [{ name: weapon, bonus: getProficiencyBonus(level) + getAbilityModifier(Math.max(str, dex)), damageDice: dice, damageType: "Stich", range: "5 ft", description: "Eine Aktion; ein Ziel." }],
    abilities: [], skills: [], savingThrows: [], resistances: "", tactics, rewards: "", experience: Math.max(10, level * level * 25), ...extra,
  } };
}
const keen = { name: "Wachsame Sinne", description: "Vorteil auf Weisheit (Wahrnehmung), wenn Geruch oder Gehör entscheidend sind." };
const pack = { name: "Rudeltaktik", description: "Vorteil auf einen Nahkampfangriff, wenn ein handlungsfähiger Verbündeter innerhalb von 5 ft zum Ziel steht." };
const multi = (count: number) => ({ name: "Mehrfachangriff", description: `Als Aktion ${count} Waffenangriffe gegen erreichbare Ziele. Ersetzt die normale Angriffsaktion; kein zusätzliches Jutsu in derselben Aktion.` });
const stealth = [{ skill: "Stealth", proficiency: "PROFICIENT" }] as const;
const waterD = ["suiton-mizudama-no-jutsu", "suiton-mizu-tate-no-jutsu"];
export const enemyTemplateSeeds: EnemySeed[] = [
  enemy("cat", "Katze", "ANIMAL", "TRIVIAL", 1, 3, [3,15,8,3,12,7], "Krallen", "1d2", "Flieht vor Gefahr, versteckt sich auf Dächern.", { speed: 40, experience: 5, abilities: [keen], skills: [...stealth], attacks: [{ name: "Krallen", bonus: 4, damageDice: "1d2", damageType: "Hieb", range: "5 ft", description: "Kratzt nur, wenn sie bedrängt wird." }] }),
  enemy("dog", "Hund", "ANIMAL", "TRIVIAL", 1, 7, [12,13,12,3,12,7], "Biss", "1d4+1", "Warnt durch Bellen und schützt seinen Halter.", { abilities: [keen], experience: 15 }),
  enemy("wolf", "Wolf", "ANIMAL", "EASY", 2, 14, [12,15,12,3,13,6], "Biss", "2d4+2", "Umschliesst isolierte Ziele und zieht sich bei schweren Verletzungen zurück.", { speed: 40, abilities: [keen, pack], skills: [{skill:"Perception",proficiency:"PROFICIENT"}] }),
  enemy("boar", "Wildschwein", "ANIMAL", "EASY", 2, 20, [15,10,14,2,10,5], "Hauer", "1d6+2", "Greift frontal an, wenn Fluchtwege versperrt sind.", { speed: 40, abilities: [{ name: "Ansturm", description: "Nach mindestens 20 ft gerader Bewegung zum Ziel: bei einem Treffer mit Hauern zusätzlich 1d6 Schaden; STR-Rettungswurf SG 12 verhindert den Zustand liegend." }] }),
  enemy("great-wolf", "Grosser Wolf", "ANIMAL", "MODERATE", 4, 42, [17,15,15,3,14,7], "Biss", "2d6+3", "Führt ein Rudel und bindet den gefährlichsten Nahkämpfer.", { speed: 50, abilities: [keen, pack], acOverride: 14 }),
  enemy("street-robber", "Strassenräuber", "HUMANOID", "TRIVIAL", 1, 8, [10,12,10,9,10,10], "Messer", "1d4+1", "Droht mit dem Messer und flieht nach dem ersten schweren Treffer.", { rewards: "Einige Ryo und gestohlene Alltagsgegenstände." }),
  enemy("bandit", "Bandit", "HUMANOID", "EASY", 2, 16, [12,12,12,10,10,10], "Kurzschwert", "1d6+1", "Nutzt Deckung und kämpft gemeinsam mit anderen Banditen.", { acOverride: 13, attacks: [{ name: "Kurzschwert", bonus: 3, damageDice: "1d6+1", damageType: "Hieb", range: "5 ft", description: "Eine Aktion." }, { name: "Kurzbogen", bonus: 3, damageDice: "1d6+1", damageType: "Stich", range: "80/320 ft", description: "Eine Aktion; benötigt freie Schusslinie." }] }),
  enemy("bandit-leader", "Banditenanführer", "HUMANOID", "HARD", 5, 58, [15,14,14,12,11,14], "Säbel", "1d8+2", "Schickt Untergebene vor, fokussiert angeschlagene Gegner und bietet bei Niederlage ein Geschäft an.", { acOverride: 15, abilities: [multi(2)], skills: [{skill:"Intimidation",proficiency:"PROFICIENT"}] }),
  enemy("mercenary", "Söldner", "HUMANOID", "MODERATE", 4, 38, [16,12,14,10,12,10], "Speer", "1d8+3", "Hält Engstellen und schützt den Auftraggeber.", { acOverride: 16, savingThrows: ["STR", "CON"] }),
  enemy("smuggler", "Bewaffneter Schmuggler", "HUMANOID", "EASY", 3, 25, [11,15,12,12,12,12], "Dolch", "1d4+2", "Verwendet Hafenkisten als Deckung und versucht mit der Ware zu entkommen.", { skills: [...stealth, {skill:"Deception",proficiency:"PROFICIENT"}], abilities: [{name:"Ortskenntnis",description:"Vorteil auf Weisheit (Überleben), um im eigenen Hafenviertel Fluchtwege zu finden."}] }),
  enemy("academy", "Akademieschüler", "SHINOBI", "TRIVIAL", 1, 10, [8,12,10,11,10,10], "Übungskunai", "1d4+1", "Sucht Schutz bei Ausbildern; nur für beaufsichtigte Trainingskämpfe.", { ninjaRank: "ACADEMY", reservoir: "VERY_LOW", rewards: "Trainingsfortschritt statt Beute." }, ["WATER"], ["suiton-mizudama-no-jutsu"]),
  enemy("genin", "Genin", "SHINOBI", "EASY", 2, 22, [10,14,12,12,11,10], "Kunai", "1d6+2", "Agiert im Team und nutzt Wassertechniken, um Abstand herzustellen.", { ninjaRank: "GENIN", skills: [...stealth], savingThrows: ["DEX"] }, ["WATER"], waterD),
  enemy("veteran-genin", "Erfahrener Genin", "SHINOBI", "MODERATE", 4, 38, [12,16,13,12,13,10], "Kunai", "1d6+3", "Lockt Gegner in einen Hinterhalt und nutzt Feuer für Raumkontrolle.", { ninjaRank: "GENIN", controlRank: "ADVANCED", skills: [...stealth, {skill:"Perception",proficiency:"PROFICIENT"}] }, ["FIRE"], ["katon-hinotama-no-jutsu", "katon-hibana-no-jutsu"]),
  enemy("chunin", "Chunin", "SHINOBI", "HARD", 6, 62, [13,16,14,14,14,12], "Tanto", "1d8+3", "Koordiniert Teamangriffe und hält eine Wasserdeckung für den Rückzug bereit.", { ninjaRank: "CHUNIN", abilities: [multi(2)], controlRank: "ADVANCED", regenRank: "ADVANCED", savingThrows: ["DEX", "WIS"] }, ["WATER"], [...waterD, "suiton-suitai-no-jutsu"]),
  enemy("chunin-specialist", "Chunin-Spezialist", "SHINOBI", "HARD", 7, 66, [10,16,14,17,14,11], "Leitfähiger Kunai", "1d6+3", "Kontrolliert Gruppen mit Blitzketten; vermeidet lange Nahkämpfe.", { ninjaRank: "CHUNIN", reservoir: "HIGH", controlRank: "EXPERT", savingThrows: ["INT", "DEX"], skills: [{skill:"Investigation",proficiency:"EXPERTISE"}] }, ["LIGHTNING"], ["raiton-raidan-no-jutsu", "raiton-rensa-raiko"]),
  enemy("jonin", "Jonin", "SHINOBI", "DEADLY", 10, 108, [16,18,16,16,16,13], "Chakraklinge", "1d10+4", "Bewertet gegnerische Fähigkeiten und kombiniert Deckung, Distanzjutsu und präzise Nahkampfangriffe.", { ninjaRank: "JONIN", acOverride: 18, reservoir: "HIGH", controlRank: "EXPERT", regenRank: "EXPERT", abilities: [multi(2)], savingThrows: ["DEX", "WIS", "CON"], skills: [...stealth, {skill:"Perception",proficiency:"EXPERTISE"}] }, ["WATER", "LIGHTNING"], [...waterD, "suiton-suitai-no-jutsu", "raiton-rensa-raiko"]),
  enemy("nukenin-scout", "Nukenin-Späher", "MISSING_NIN", "MODERATE", 4, 34, [11,17,12,13,15,10], "Kunai", "1d6+3", "Beobachtet aus der Distanz, meldet Feindpositionen und flieht über Wasser.", { ninjaRank: "GENIN", speed: 40, skills: [{skill:"Stealth",proficiency:"EXPERTISE"},{skill:"Perception",proficiency:"PROFICIENT"}] }, ["WATER"], waterD),
  enemy("nukenin-assassin", "Nukenin-Assassine", "MISSING_NIN", "DEADLY", 8, 76, [12,19,14,14,14,10], "Tanto", "1d8+4", "Beginnt aus dem Verborgenen, isoliert ein Ziel und zieht sich nach einem Fehlschlag zurück.", { ninjaRank: "CHUNIN", acOverride: 17, skills: [{skill:"Stealth",proficiency:"EXPERTISE"}], abilities: [multi(2), {name:"Präzisionsangriff",description:"Einmal pro eigenem Zug zusätzlich 3d6 Schaden bei einem Waffentreffer mit Vorteil. Gilt nicht für Jutsu."}], savingThrows:["DEX","INT"] }, ["WIND"], ["futon-fujin-no-jutsu"]),
  enemy("nukenin-suiton", "Nukenin-Suiton-Spezialist", "MISSING_NIN", "HARD", 7, 70, [12,15,15,16,16,11], "Kunai", "1d6+2", "Wählt Ufer und Hafenbecken als Kampfplatz; trennt die Gruppe mit Wasserkontrolle.", { ninjaRank: "CHUNIN", reservoir:"VERY_HIGH", controlRank:"EXPERT", regenRank:"ADVANCED", savingThrows:["WIS","CON"] }, ["WATER"], [...waterD,"suiton-suitai-no-jutsu"]),
  enemy("elite-missing-nin", "Elite-Missing-Nin", "MISSING_NIN", "ELITE", 13, 156, [18,20,18,17,17,14], "Nukenin-Klinge", "1d10+5", "Kämpft nie ohne Rückzugsweg. Bindet die Front mit Klingenangriffen und zwingt Fernkämpfer mit Blitzjutsu aus der Deckung.", { ninjaRank:"JONIN", acOverride:19, speed:40, reservoir:"EXCEPTIONAL", controlRank:"MASTER", regenRank:"EXPERT", abilities:[multi(3), {name:"Eiserner Wille",description:"Einmal pro Begegnung einen misslungenen WIS-Rettungswurf wiederholen; das neue Ergebnis gilt."}], savingThrows:["DEX","CON","WIS"], skills:[{skill:"Stealth",proficiency:"EXPERTISE"},{skill:"Perception",proficiency:"EXPERTISE"}], rewards:"Hinweise auf Auftraggeber und ein versiegeltes Kopfgelddossier." }, ["WATER","LIGHTNING"], [...waterD,"suiton-suitai-no-jutsu","raiton-raidan-no-jutsu","raiton-rensa-raiko"]),
];
