import { clamp } from "./index";
import { EncounterError } from "../encounters";
type InitiativeParticipant = { id: string; ordinal: number; initiative: number | null; initiativeBonus: number; maxHp: number | null; currentHp: number | null; defeated: boolean; unconscious: boolean };
export function initiativeOrder<T extends InitiativeParticipant>(participants: readonly T[]): T[] {
  return [...participants].sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity) || b.initiativeBonus - a.initiativeBonus || a.ordinal - b.ordinal || a.id.localeCompare(b.id));
}
export function canTakeTurn(p: InitiativeParticipant) { return p.maxHp !== null && p.currentHp !== null && p.currentHp > 0 && !p.defeated && !p.unconscious; }
export function nextEncounterTurn(participants: readonly InitiativeParticipant[], activeId: string | null, round: number) {
  const ordered = initiativeOrder(participants.filter(p => p.maxHp !== null));
  if (!ordered.some(canTakeTurn)) throw new EncounterError("Keine handlungsfähigen Kampfteilnehmer. Begegnung abschliessen oder Teilnehmer wiederherstellen.");
  const index = ordered.findIndex(p => p.id === activeId);
  if (index < 0) throw new EncounterError("Aktiver Teilnehmer fehlt. Bitte neu laden.");
  for (let step = 1; step <= ordered.length; step++) {
    const position = (index + step) % ordered.length;
    if (canTakeTurn(ordered[position])) return { activeParticipantId: ordered[position].id, round: round + (index + step >= ordered.length ? 1 : 0) };
  }
  throw new EncounterError("Kein nächster Zug verfügbar.");
}
export function encounterHpChange(current: number | null, max: number | null, amount: number, healing: boolean) {
  if (current === null || max === null) throw new EncounterError("Dieser Teilnehmer besitzt keine Kampf-HP.");
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) throw new EncounterError("Ungültige HP-Änderung.");
  const hp = clamp(current + (healing ? amount : -amount), 0, max);
  return { currentHp: hp, unconscious: hp === 0, ...(healing && current === 0 && hp > 0 ? { severelyWounded: true } : {}) };
}
export function encounterChakraChange(current: number | null, max: number | null, amount: number, restore: boolean) {
  if (current === null || max === null) throw new EncounterError("Dieser Teilnehmer nutzt kein Chakra.");
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) throw new EncounterError("Ungültige Chakra-Änderung.");
  if (!restore && amount > current) throw new EncounterError("Nicht genügend Chakra.");
  return clamp(current + (restore ? amount : -amount), 0, max);
}
