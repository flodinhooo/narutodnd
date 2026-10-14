// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MissionForm from "./MissionForm";
import MissionCommandButton from "./MissionCommandButton";
import ConsequenceForm from "./ConsequenceForm";
import { SessionContentForm } from "./MissionSessionForms";
const { performMissionAction, push, refresh, success } = vi.hoisted(() => ({ performMissionAction: vi.fn(), push: vi.fn(), refresh: vi.fn(), success: vi.fn() }));
vi.mock("@/app/campaign/mission-actions", () => ({ performMissionAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("react-toastify", () => ({ toast: { success } }));
const options = { npcs: [{ id: "npc", name: "Mika" }], locations: [{ id: "location", name: "Hafen" }], encounters: [{ id: "encounter", name: "Hinterhalt" }] };
beforeEach(() => { vi.clearAllMocks(); }); afterEach(cleanup);
it("edits and persists a dependency graph plus ordered optional encounters", () => {
  const { container } = render(<MissionForm action={vi.fn()} options={options} />);
  fireEvent.click(screen.getByRole("button", { name: "Ziel hinzufügen" })); fireEvent.change(screen.getByLabelText("Zieltitel"), { target: { value: "Spuren finden" } });
  fireEvent.click(screen.getByRole("button", { name: "Ziel hinzufügen" })); fireEvent.change(screen.getAllByLabelText("Zieltitel")[1], { target: { value: "Boten bergen" } });
  fireEvent.click(screen.getByLabelText("Spuren finden")); fireEvent.click(screen.getByRole("button", { name: "Encounter verknüpfen" }));
  fireEvent.change(screen.getByLabelText("Encounter 1"), { target: { value: "encounter" } }); fireEvent.click(screen.getByLabelText("Optionaler Encounter"));
  const data = new FormData(container.querySelector("form")!), graph = JSON.parse(String(data.get("objectives")));
  expect(graph[1].dependencyIds).toEqual([graph[0].id]); expect(JSON.parse(String(data.get("encounters")))[0]).toMatchObject({ encounterId: "encounter", optional: true });
});
it("shows safe server validation without resetting input or reporting success", async () => {
  const { container } = render(<MissionForm action={vi.fn().mockResolvedValue({ error: "Ziel-Abhängigkeiten dürfen keine Zyklen enthalten." })} options={options} />);
  fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Mein Auftrag" } });
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  expect(screen.getByRole("alert").textContent).toContain("Zyklen"); expect((screen.getByLabelText("Titel") as HTMLInputElement).value).toBe("Mein Auftrag"); expect(push).not.toHaveBeenCalled(); expect(success).not.toHaveBeenCalled();
});
it("requires explicit confirmation before a consequence command", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<MissionCommandButton campaignId="campaign" missionId="mission" version={4} command={{ kind: "CONSEQUENCE", consequenceId: "c", confirmed: true }} confirmation="Anwenden?">Konsequenz anwenden</MissionCommandButton>);
  fireEvent.click(screen.getByRole("button", { name: "Konsequenz anwenden" })); expect(performMissionAction).not.toHaveBeenCalled(); confirm.mockReturnValue(true); performMissionAction.mockResolvedValue({ ok: true });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Konsequenz anwenden" })); }); expect(performMissionAction).toHaveBeenCalledOnce(); confirm.mockRestore();
});
it("retries uncertain mission actions with exactly the same request ID", async () => {
  performMissionAction.mockRejectedValueOnce(new Error("Network")); render(<MissionCommandButton campaignId="campaign" missionId="mission" version={2} command={{ kind: "STATUS", status: "ACCEPTED" }}>Mission annehmen</MissionCommandButton>);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mission annehmen" })); }); expect(screen.getByRole("alert").textContent).toContain("dieselbe Anfrage");
  performMissionAction.mockResolvedValue({ ok: true }); await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mission annehmen" })); }); expect(performMissionAction.mock.calls[0]).toEqual(performMissionAction.mock.calls[1]);
});
it("does not automatically execute a prepared consequence and resets targets on kind changes", () => {
  const action = vi.fn(), { container } = render(<ConsequenceForm action={action} options={{ npcs: options.npcs, organizations: [{ id: "org", name: "Fraktion" }], missions: [{ id: "mission", title: "Folgeauftrag" }], objectives: [{ id: "objective", title: "Alternativer Weg" }] }} />);
  fireEvent.change(screen.getByLabelText("Ziel"), { target: { value: "npc" } }); fireEvent.change(screen.getByLabelText("Konsequenztyp"), { target: { value: "UNLOCK_MISSION" } }); expect((screen.getByLabelText("Ziel") as HTMLSelectElement).value).toBe(""); expect(action).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Ziel"), { target: { value: "mission" } }); expect(new FormData(container.querySelector("form")!).get("targetMissionId")).toBe("mission");
});
it("selects mission or existing Run for session assignment without stale IDs", () => {
  const { container } = render(<SessionContentForm action={vi.fn()} missions={[{ id: "m", title: "Mission" }]} runs={[{ id: "r", name: "Run", status: "ACTIVE" }]} />);
  fireEvent.change(screen.getByLabelText("Inhalt"), { target: { value: "m" } }); fireEvent.change(screen.getByLabelText("Zuordnung"), { target: { value: "RUN" } }); expect((screen.getByLabelText("Inhalt") as HTMLSelectElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Inhalt"), { target: { value: "r" } }); const data = new FormData(container.querySelector("form")!); expect(data.get("id")).toBe("r"); expect(data.get("assigned")).toBe("true");
});
