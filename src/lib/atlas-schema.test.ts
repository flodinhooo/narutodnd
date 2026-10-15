import { expect, it } from "vitest";
import { assertAtlasParent, visibleAtlasIds, markerInput } from "./atlas-schema";
it("supports an acyclic map tree and rejects missing parents and all cycles", () => {
  const nodes = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }];
  expect(() => assertAtlasParent(nodes, "d", "c")).not.toThrow();
  for (const [id, parent] of [["a", "c"], ["b", "b"], ["c", "missing"]]) expect(() => assertAtlasParent(nodes, id, parent)).toThrow();
});
it("hides descendants of hidden or archived maps and orphaned/cyclic trees", () => {
  const nodes = [{ id: "a", parentId: null, playerVisible: true, archived: false }, { id: "b", parentId: "a", playerVisible: false, archived: false }, { id: "c", parentId: "b", playerVisible: true, archived: false }, { id: "d", parentId: "missing", playerVisible: true, archived: false }, { id: "e", parentId: "e", playerVisible: true, archived: false }];
  expect([...visibleAtlasIds(nodes)]).toEqual(["a"]); nodes[0].archived = true; expect(visibleAtlasIds(nodes).size).toBe(0);
});
it("accepts only normalized finite coordinates, safe icons and hexadecimal colors", () => {
  const good = { x: 0, y: 1, title: "Marker", description: "", category: "OTHER", icon: "pin", color: "#ffffff", playerVisible: true, locationId: null, childMapId: null };
  expect(markerInput.safeParse(good).success).toBe(true);
  for (const patch of [{ x: -.01 }, { y: 1.01 }, { x: NaN }, { y: Infinity }, { color: "url(x)" }, { icon: "<script>" }]) expect(markerInput.safeParse({ ...good, ...patch }).success).toBe(false);
});
