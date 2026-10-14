// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EncounterForm from "./EncounterForm";
import EncounterParticipantForm from "./EncounterParticipantForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn() } }));
afterEach(cleanup);
it("edits, reorders and removes prepared events as structured persistent data", () => {
  const { container } = render(<EncounterForm action={vi.fn()} locations={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Ereignis hinzufügen" }));
  fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Erstes Ereignis" } });
  fireEvent.click(screen.getByRole("button", { name: "Ereignis hinzufügen" }));
  fireEvent.change(screen.getAllByLabelText("Titel")[1], { target: { value: "Zweites Ereignis" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Nach oben" })[1]);
  let data = new FormData(container.querySelector("form")!);
  expect(JSON.parse(String(data.get("events"))).map((e: { title: string }) => e.title)).toEqual(["Zweites Ereignis", "Erstes Ereignis"]);
  fireEvent.click(screen.getAllByRole("button", { name: "Ereignis entfernen" })[0]);
  data = new FormData(container.querySelector("form")!);
  expect(JSON.parse(String(data.get("events")))).toHaveLength(1);
});
it("keeps unsaved encounter metadata after a rejected server validation", async () => {
  const { container } = render(<EncounterForm action={vi.fn().mockRejectedValue(new Error("Zuerst Teilnehmer hinzufügen."))} locations={[]} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mein Encounter" } });
  fireEvent.change(screen.getByLabelText("DM-Notizen"), { target: { value: "Nicht verlieren" } });
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  expect(screen.getByRole("alert").textContent).toContain("Teilnehmer");
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Mein Encounter");
  expect((screen.getByLabelText("DM-Notizen") as HTMLTextAreaElement).value).toBe("Nicht verlieren");
});
it("supports enemy quantities but resets selection and quantity when choosing an individual NPC", () => {
  const options = { enemies: [{ id: "enemy", name: "Wolf" }], characters: [{ id: "pc", name: "Spieler" }], npcs: [{ id: "npc", name: "Händler" }] };
  const { container } = render(<EncounterParticipantForm action={vi.fn()} options={options} />);
  fireEvent.change(screen.getByLabelText("Teilnehmer"), { target: { value: "enemy" } });
  fireEvent.change(screen.getByLabelText("Anzahl"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Quelle"), { target: { value: "NPC" } });
  expect((screen.getByLabelText("Anzahl") as HTMLInputElement).value).toBe("1");
  expect((screen.getByLabelText("Teilnehmer") as HTMLSelectElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Teilnehmer"), { target: { value: "npc" } });
  fireEvent.change(screen.getByLabelText("Seite"), { target: { value: "NEUTRAL" } });
  const data = new FormData(container.querySelector("form")!);
  expect(data.get("sourceId")).toBe("npc"); expect(data.get("side")).toBe("NEUTRAL"); expect(data.get("quantity")).toBe("1");
});
