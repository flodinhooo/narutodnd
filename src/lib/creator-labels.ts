import type {Ability, skills} from "./rules";
export const abilityLabels: Record<Lowercase<Ability>, string> = {
 str: "Stärke", dex: "Geschicklichkeit", con: "Konstitution", int: "Intelligenz", wis: "Weisheit", cha: "Charisma",
};
export const skillLabels: Record<keyof typeof skills, string> = {
 Acrobatics: "Akrobatik", "Animal Handling": "Mit Tieren umgehen", Arcana: "Arkane Kunde", Athletics: "Athletik",
 Deception: "Täuschen", History: "Geschichte", Insight: "Motiv erkennen", Intimidation: "Einschüchtern",
 Investigation: "Nachforschungen", Medicine: "Heilkunde", Nature: "Naturkunde", Perception: "Wahrnehmung",
 Performance: "Auftreten", Persuasion: "Überzeugen", Religion: "Religion", "Sleight of Hand": "Fingerfertigkeit",
 Stealth: "Heimlichkeit", Survival: "Überleben",
};
export const creatorOptionLabels: Record<string,string> = {
 VERY_LOW: "Sehr niedrig", LOW: "Niedrig", AVERAGE: "Durchschnittlich", HIGH: "Hoch", VERY_HIGH: "Sehr hoch",
 EXCEPTIONAL: "Außergewöhnlich", MONSTER: "Monströs", NOVICE: "Anfänger", TRAINED: "Geschult",
 ADVANCED: "Fortgeschritten", EXPERT: "Experte", MASTER: "Meister",
};
