import type { MissionStatus, ObjectiveStatus } from "@prisma/client";
import { EncounterError } from "../encounters";

export const missionTransitions: Record<MissionStatus, MissionStatus[]> = { DRAFT: ["AVAILABLE", "CANCELLED"], AVAILABLE: ["DRAFT", "ACCEPTED", "CANCELLED"], ACCEPTED: ["AVAILABLE", "ACTIVE", "CANCELLED"], ACTIVE: ["COMPLETED", "FAILED", "CANCELLED"], COMPLETED: [], FAILED: [], CANCELLED: [] };
export function assertMissionTransition(from: MissionStatus, to: MissionStatus) { if (!missionTransitions[from].includes(to)) throw new EncounterError("Dieser Missionsstatus-Übergang ist nicht erlaubt."); }
type GraphObjective = { id: string; dependencyIds: string[] };
export function validateObjectiveGraph(objectives: readonly GraphObjective[]) {
  const nodes = new Map(objectives.map(o => [o.id, o]));
  if (nodes.size !== objectives.length) throw new EncounterError("Ziel-IDs müssen eindeutig sein.");
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new EncounterError("Ziel-Abhängigkeiten dürfen keine Zyklen enthalten.");
    if (visited.has(id)) return;
    const node = nodes.get(id); if (!node) throw new EncounterError("Voraussetzung gehört nicht zu dieser Mission.");
    visiting.add(id); for (const dependency of node.dependencyIds) visit(dependency); visiting.delete(id); visited.add(id);
  }
  for (const node of objectives) visit(node.id);
}
export function assertObjectiveChange(objectives: { id: string; status: ObjectiveStatus; enabled: boolean; optional: boolean; dependencyIds: string[] }[], id: string, next: ObjectiveStatus) {
  const objective = objectives.find(o => o.id === id); if (!objective) throw new EncounterError("Ziel gehört nicht zu dieser Mission.");
  if (!objective.enabled) throw new EncounterError("Dieses Ziel wurde noch nicht freigeschaltet.");
  if (next === "SKIPPED" && !objective.optional) throw new EncounterError("Pflichtziele dürfen nicht übersprungen werden.");
  if (["ACTIVE", "COMPLETED"].includes(next) && objective.dependencyIds.some(id => objectives.find(o => o.id === id)?.status !== "COMPLETED")) throw new EncounterError("Zuerst alle Voraussetzungen erfüllen.");
  if (next !== "COMPLETED" && objectives.some(o => ["ACTIVE", "COMPLETED"].includes(o.status) && o.dependencyIds.includes(id))) throw new EncounterError("Dieses Ziel ist Voraussetzung eines bereits begonnenen oder abgeschlossenen Ziels.");
}
export function missionCanComplete(objectives: { optional: boolean; status: ObjectiveStatus }[]) { return objectives.every(o => o.optional || o.status === "COMPLETED"); }
export function missionIsTerminal(status: MissionStatus) { return ["COMPLETED", "FAILED", "CANCELLED"].includes(status); }
