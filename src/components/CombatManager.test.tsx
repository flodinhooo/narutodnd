// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RunView } from "@/lib/encounters";
import { combatSnapshotSchema } from "@/lib/encounters";
import { enemyTemplateSeeds } from "../../seeding/enemy-templates";
import CombatManager from "./CombatManager";

const { performCombatAction, reloadEncounterRun } = vi.hoisted(() => ({ performCombatAction: vi.fn(), reloadEncounterRun: vi.fn() }));
vi.mock("@/app/campaign/combat-actions", () => ({ performCombatAction, reloadEncounterRun }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn() } }));
const snapshot = combatSnapshotSchema.parse({ ...enemyTemplateSeeds[6].data, schemaVersion: 1, maxChakra: null, ac: 13, initiative: 1, attributes: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }, reservoir: null, controlRank: null, regenRank: null, skills: [], savingThrows: [], natures: [], jutsu: [] });
function fixture(): RunView {
  return { id: "run", campaignId: "campaign", encounterId: "encounter", templateVersion: 1, startRequestId: "start", startHash: "hash", name: "Hafenüberfall", description: "Kai", type: "COMBAT", difficulty: "MODERATE", locationName: "Hafen", dmNotes: "Geheim", notes: "", summary: "", events: [], status: "ACTIVE", round: 1, activeParticipantId: "p1", version: 1, createdAt: new Date(), startedAt: new Date(), endedAt: null,
    participants: [1, 2].map(i => ({ id: `p${i}`, runId: "run", sourcePlanId: "plan", sourceKind: "ENEMY", sourceId: "enemy", ordinal: i, name: `Bandit ${i}`, side: "HOSTILE", snapshot, maxHp: 16, currentHp: 16, maxChakra: null, currentChakra: null, ac: 13, initiativeBonus: 1, initiative: 15 - i, conditions: [], defeated: false, unconscious: false, severelyWounded: false, notes: "" })),
  };
}
const card = (name: string) => within(screen.getByRole("heading", { name }).closest("article")!);
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
it("renders round, active actor and independent nonchakra statblocks", () => {
  render(<CombatManager initial={fixture()} />);
  expect(screen.getByRole("heading", { name: "Runde 1 · Bandit 1 ist am Zug" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Chakra verbrauchen" })).toBeNull();
  expect(card("Bandit 1").getByRole("button", { name: "Schaden" })).toBeTruthy();
  expect(card("Bandit 2").getByRole("button", { name: "Schaden" })).toBeTruthy();
});
it("applies persisted damage only to the selected actor and uses a versioned request", async () => {
  const initial = fixture(), updated = fixture(); updated.version = 2; updated.participants[0].currentHp = 11;
  performCombatAction.mockResolvedValue({ ok: true, run: updated });
  render(<CombatManager initial={initial} />);
  fireEvent.change(card("Bandit 1").getByLabelText("Betrag"), { target: { value: "5" } });
  await act(async () => { fireEvent.click(card("Bandit 1").getByRole("button", { name: "Schaden" })); });
  expect(performCombatAction).toHaveBeenCalledWith("campaign", "run", expect.objectContaining({ expectedVersion: 1, requestId: expect.any(String), command: { kind: "DAMAGE", participantId: "p1", amount: 5 } }));
  expect(card("Bandit 1").getByText("11")).toBeTruthy(); expect(initial.participants[0].currentHp).toBe(16);
});
it("updates active participant and round from the server response", async () => {
  const updated = fixture(); updated.version = 2; updated.round = 2; updated.activeParticipantId = "p2";
  performCombatAction.mockResolvedValue({ ok: true, run: updated }); render(<CombatManager initial={fixture()} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Nächster Zug" })); });
  expect(screen.getByRole("heading", { name: "Runde 2 · Bandit 2 ist am Zug" })).toBeTruthy();
});
it("prevents repeated UI clicks while a request is pending", async () => {
  let finish: (result: unknown) => void = () => {};
  performCombatAction.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<CombatManager initial={fixture()} />);
  const next = screen.getByRole("button", { name: "Nächster Zug" });
  await act(async () => { fireEvent.click(next); fireEvent.click(next); });
  expect(performCombatAction).toHaveBeenCalledOnce(); expect((next as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { finish({ ok: true, run: fixture() }); });
});
it("retries an uncertain network response with the identical request ID and payload", async () => {
  performCombatAction.mockRejectedValueOnce(new Error("Network lost")); render(<CombatManager initial={fixture()} />);
  await act(async () => { fireEvent.click(card("Bandit 1").getByRole("button", { name: "Schaden" })); });
  expect(screen.getByRole("alert").textContent).toContain("Antwort nicht erhalten");
  performCombatAction.mockResolvedValue({ ok: true, run: fixture() });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Letzte Anfrage erneut senden" })); });
  expect(performCombatAction.mock.calls[1]).toEqual(performCombatAction.mock.calls[0]);
});
it("shows conflicts without changing values and reloads persisted server state", async () => {
  performCombatAction.mockResolvedValue({ ok: false, error: "Bitte Stand aktualisieren." }); render(<CombatManager initial={fixture()} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Nächster Zug" })); });
  expect(screen.getByRole("alert").textContent).toContain("Stand aktualisieren");
  const updated = fixture(); updated.version = 5; updated.round = 4;
  reloadEncounterRun.mockResolvedValue(updated);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stand aktualisieren" })); });
  expect(screen.getByRole("heading", { name: "Runde 4 · Bandit 1 ist am Zug" })).toBeTruthy();
});
it("renders completed history read-only and confirms destructive run completion", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const view = render(<CombatManager initial={fixture()} />);
  fireEvent.click(screen.getByRole("button", { name: "Begegnung abschliessen" })); expect(performCombatAction).not.toHaveBeenCalled();
  confirm.mockRestore(); view.unmount();
  const done = fixture(); done.status = "COMPLETED"; done.activeParticipantId = null; done.summary = "Erfolg";
  render(<CombatManager initial={done} />);
  expect(card("Bandit 1").getByRole("button", { name: "Schaden" }).matches(":disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Nächster Zug" })).toBeNull(); expect(screen.getByText("Erfolg")).toBeTruthy();
});
