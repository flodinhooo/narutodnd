import { expect, it } from "vitest";
import { canTakeTurn, encounterChakraChange, encounterHpChange, initiativeOrder, nextEncounterTurn } from "./encounters";

const participant = (id: string, ordinal: number, extra = {}) => ({ id, ordinal, initiative: 12, initiativeBonus: 2, maxHp: 10, currentHp: 10, defeated: false, unconscious: false, ...extra });
it("breaks initiative ties by bonus then stable ordinal without mutating input", () => {
  const a = participant("a", 0), b = participant("b", 1, { initiativeBonus: 3 }), c = participant("c", 2), input = [c, a, b];
  expect(initiativeOrder(input).map(p => p.id)).toEqual(["b", "a", "c"]); expect(input).toEqual([c, a, b]);
});
it("orders unrolled participants after rolled ones, including negative initiatives", () => {
  const a = participant("a", 0, { initiative: null }), b = participant("b", 1, { initiative: -4 });
  expect(initiativeOrder([a, b]).map(p => p.id)).toEqual(["b", "a"]);
});
it("skips downed participants and advances one round only when crossing the end", () => {
  const a = participant("a", 0), b = participant("b", 1, { unconscious: true }), c = participant("c", 2);
  expect(nextEncounterTurn([a, b, c], "a", 1)).toEqual({ activeParticipantId: "c", round: 1 });
  expect(nextEncounterTurn([a, b, c], "c", 1)).toEqual({ activeParticipantId: "a", round: 2 });
});
it("wraps a single surviving actor correctly and excludes narrative actors", () => {
  const a = participant("a", 0), b = participant("b", 1, { maxHp: null, currentHp: null });
  expect(canTakeTurn(b)).toBe(false); expect(nextEncounterTurn([a, b], "a", 4)).toEqual({ activeParticipantId: "a", round: 5 });
});
it("rejects missing active actor and fully incapacitated rosters", () => {
  expect(() => nextEncounterTurn([participant("a", 0)], "missing", 1)).toThrow();
  expect(() => nextEncounterTurn([participant("a", 0, { currentHp: 0 })], "a", 1)).toThrow();
});
it("clamps HP and applies the existing severe-wound rule on healing from zero", () => {
  expect(encounterHpChange(10, 15, 100, false)).toMatchObject({ currentHp: 0, unconscious: true });
  expect(encounterHpChange(0, 15, 100, true)).toEqual({ currentHp: 15, unconscious: false, severelyWounded: true });
  expect(() => encounterHpChange(null, null, 1, false)).toThrow();
  expect(() => encounterHpChange(10, 15, -1, false)).toThrow();
});
it("refuses chakra for ordinary actors and prevents overspending", () => {
  expect(() => encounterChakraChange(null, null, 1, true)).toThrow();
  expect(() => encounterChakraChange(10, 20, 11, false)).toThrow();
  expect(encounterChakraChange(10, 20, 10, false)).toBe(0);
  expect(encounterChakraChange(10, 20, 50, true)).toBe(20);
});
