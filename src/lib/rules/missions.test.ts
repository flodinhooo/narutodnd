import { expect, it } from "vitest";
import { assertMissionTransition, assertObjectiveChange, missionCanComplete, validateObjectiveGraph } from "./missions";
it("accepts a branched acyclic graph independent of display order", () => { expect(() => validateObjectiveGraph([{ id: "end", dependencyIds: ["a", "b"] }, { id: "a", dependencyIds: ["start"] }, { id: "b", dependencyIds: ["start"] }, { id: "start", dependencyIds: [] }])).not.toThrow(); });
it.each([
  [{ id: "a", dependencyIds: ["a"] }],
  [{ id: "a", dependencyIds: ["b"] }, { id: "b", dependencyIds: ["a"] }],
  [{ id: "a", dependencyIds: ["b"] }, { id: "b", dependencyIds: ["c"] }, { id: "c", dependencyIds: ["a"] }],
  [{ id: "a", dependencyIds: ["missing"] }],
  [{ id: "a", dependencyIds: [] }, { id: "a", dependencyIds: [] }],
].map(graph => ({ graph })))("rejects invalid dependency graph %#", ({ graph }) => { expect(() => validateObjectiveGraph(graph)).toThrow(); });
it("requires every prerequisite, not just one branch", () => {
  const g = [{ id: "a", status: "COMPLETED" as const, enabled: true, optional: false, dependencyIds: [] }, { id: "b", status: "PENDING" as const, enabled: true, optional: false, dependencyIds: [] }, { id: "end", status: "PENDING" as const, enabled: true, optional: false, dependencyIds: ["a", "b"] }];
  expect(() => assertObjectiveChange(g, "end", "COMPLETED")).toThrow();
});
it("ignores optional completion goals but includes locked mandatory goals", () => {
  expect(missionCanComplete([{ optional: false, status: "COMPLETED" }, { optional: true, status: "PENDING" }])).toBe(true);
  expect(missionCanComplete([{ optional: false, status: "PENDING" }])).toBe(false);
});
it("validates lifecycle and keeps terminal missions terminal", () => {
  expect(() => assertMissionTransition("DRAFT", "AVAILABLE")).not.toThrow(); expect(() => assertMissionTransition("ACTIVE", "FAILED")).not.toThrow();
  expect(() => assertMissionTransition("DRAFT", "COMPLETED")).toThrow(); expect(() => assertMissionTransition("COMPLETED", "ACTIVE")).toThrow();
});
