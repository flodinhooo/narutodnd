// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import EnemyBuilder from "./EnemyBuilder";

const { push, refresh, success } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("react-toastify", () => ({ toast: { success } }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
const options = { natures: [{ id: "water", displayName: "Wasser" }], jutsu: [{ id: "water-jutsu", name: "Water shot", germanName: "Wasserschuss", rank: "D", chakraCost: 10 }, { id: "fire-jutsu", name: "Fire shot", germanName: "Feuerschuss", rank: "D", chakraCost: 10 }] };
it("edits structured attacks and abilities without exposing JSON fields to the DM", () => {
  const { container } = render(<EnemyBuilder action={vi.fn()} {...options} />);
  fireEvent.click(screen.getByRole("button", { name: "Angriff hinzufügen" }));
  expect(screen.getAllByText(/Angriff [12] entfernen/)).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Angriff 1 entfernen" }));
  fireEvent.click(screen.getByRole("button", { name: "Fähigkeit hinzufügen" }));
  fireEvent.change(screen.getByLabelText("Effekt, Kosten und Begrenzungen"), { target: { value: "Nur einmal pro Runde." } });
  const data = new FormData(container.querySelector("form")!);
  expect(JSON.parse(String(data.get("attacks")))).toHaveLength(1);
  expect(JSON.parse(String(data.get("abilities")))[0].description).toBe("Nur einmal pro Runde.");
  expect(container.querySelector('textarea[name="attacks"]')).toBeNull();
});
it("keeps selected Jutsu in the submission when searching and excludes all chakra fields when disabled", () => {
  const { container } = render(<EnemyBuilder action={vi.fn()} {...options} />);
  fireEvent.click(screen.getByLabelText("Dieser Gegner nutzt Chakra"));
  fireEvent.click(screen.getByText(/Chakra-Naturen/)); fireEvent.click(screen.getByLabelText("Wasser"));
  fireEvent.click(screen.getByText(/Jutsu auswählen/)); fireEvent.click(screen.getByLabelText(/Wasserschuss/));
  fireEvent.change(screen.getByLabelText("Jutsu suchen"), { target: { value: "Feuer" } });
  let data = new FormData(container.querySelector("form")!);
  expect(data.getAll("jutsuIds")).toEqual(["water-jutsu"]); expect(data.getAll("natureIds")).toEqual(["water"]);
  fireEvent.click(screen.getByLabelText("Dieser Gegner nutzt Chakra"));
  data = new FormData(container.querySelector("form")!);
  expect(data.getAll("jutsuIds")).toEqual([]); expect(data.getAll("natureIds")).toEqual([]);
  expect(data.get("maxChakraOverride")).toBe(""); expect(data.get("hasChakra")).toBeNull();
});
it("updates live AC and initiative previews and keeps category separate from difficulty", () => {
  render(<EnemyBuilder action={vi.fn()} {...options} />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "DEX" }), { target: { value: "18" } });
  expect(screen.getByText(/AC: 16 · Initiative: \+4/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Kategorie"), { target: { value: "ANIMAL" } });
  fireEvent.change(screen.getByLabelText("Schwierigkeit"), { target: { value: "ELITE" } });
  expect((screen.getByLabelText("Kategorie") as HTMLSelectElement).value).toBe("ANIMAL");
  expect((screen.getByLabelText("Schwierigkeit") as HTMLSelectElement).value).toBe("ELITE");
});
it("shows server validation errors and preserves entered data", async () => {
  const action = vi.fn().mockRejectedValue(new Error("Chakra-Natur fehlt für Jutsu."));
  const { container } = render(<EnemyBuilder action={action} {...options} />);
  fireEvent.change(screen.getAllByLabelText(/^Name$/)[0], { target: { value: "Mein Gegner" } });
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  expect((await screen.findByRole("alert")).textContent).toContain("Chakra-Natur fehlt");
  expect((screen.getAllByLabelText(/^Name$/)[0] as HTMLInputElement).value).toBe("Mein Gegner"); expect(push).not.toHaveBeenCalled();
});
it("disables the builder while saving and navigates only after success", async () => {
  let finish: (url: string) => void = () => {};
  const action = vi.fn().mockImplementation(() => new Promise<string>(resolve => { finish = resolve; }));
  const { container } = render(<EnemyBuilder action={action} {...options} />);
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  expect(container.querySelector("fieldset")?.disabled).toBe(true); expect(screen.getByRole("status").textContent).toContain("gespeichert");
  await act(async () => { finish("/campaign/test/bestiary/new-id"); });
  await waitFor(() => expect(push).toHaveBeenCalledWith("/campaign/test/bestiary/new-id")); expect(refresh).toHaveBeenCalled();
});
