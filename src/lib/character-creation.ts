export type CharacterCreationResult =
 | {ok: true; destination: string}
 | {ok: false; code: string; message: string; field?: string};
export const creationFailureMessage = "Der Charakter konnte nicht erstellt werden. Bitte überprüfe deine Angaben.";
export const natureUnavailableMessage = "Diese Chakra-Natur steht bei der Charaktererstellung nicht zur Verfügung.";
export const jutsuUnavailableMessage = "Deine Jutsu-Auswahl ist nicht mehr gültig. Bitte überprüfe sie.";

const ruleMessages: Record<string, string> = {
 "Choose d8 or d10": "Wähle d8 oder d10 als Hit Die.",
 "D8 requires exactly one valid ability bonus": "Wähle ein Attribut für deinen +1-Talentbonus.",
 "D10 cannot have an ability bonus": "Ein robuster Shinobi mit d10 erhält keinen Talentbonus.",
 "Invalid ability score mode": "Wähle eine gültige Methode für deine Attribute.",
 "Ability scores must be whole numbers between 1 and 20": "Attributwerte müssen ganze Zahlen zwischen 1 und 20 sein.",
 "Invalid Standard Array": "Verteile die Standardwerte 15, 14, 13, 12, 10 und 8 jeweils genau einmal.",
 "Point Buy requires base scores 8-15 costing at most 27 points": "Die Basiswerte im Punktekauf müssen zwischen 8 und 15 liegen und dürfen höchstens 27 Punkte kosten.",
 "Final ability scores cannot exceed 20": "Attributwerte dürfen einschließlich Talentbonus höchstens 20 betragen.",
};
export const creationRuleMessage = (error: unknown) => error instanceof Error ? ruleMessages[error.message] ?? creationFailureMessage : creationFailureMessage;

export type StartingJutsu = {
 rank: string; campaignId: string | null; requiredNatureKeys: string | null;
 natures: {nature: {key: string; playerSelectable: boolean}}[];
};
// Use the same eligibility predicate in the Creator loader and authoritative action.
export function isStartingJutsuAllowed(jutsu: StartingJutsu, campaignId: string, natureKey?: string) {
 if (jutsu.rank === "S" || (jutsu.campaignId !== null && jutsu.campaignId !== campaignId)) return false;
 if (!jutsu.natures.length || jutsu.natures.some(link => !link.nature.playerSelectable)) return false;
 if (natureKey && !jutsu.natures.some(link => link.nature.key === natureKey)) return false;
 if (jutsu.requiredNatureKeys) {
  try {
   const required: unknown = JSON.parse(jutsu.requiredNatureKeys);
   if (!Array.isArray(required) || required.some(key => typeof key !== "string" || !jutsu.natures.some(link => link.nature.key === key && link.nature.playerSelectable))) return false;
  } catch { return false; }
 }
 return true;
}
