// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PeopleForm from "./PeopleForm";
const { refresh, push, success } = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("react-toastify", () => ({ toast: { success } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("retains uncontrolled fields and focuses the validation error for correction", async () => {
  const action = vi.fn().mockResolvedValue({ error: "Bitte Auswahl korrigieren." });
  const { container } = render(<PeopleForm action={action}><label>Name<input name="name" defaultValue="Alt" /></label><label>Notizen<textarea name="notes" /></label><label>Freigabe<input name="visible" type="checkbox" /></label><button>Speichern</button></PeopleForm>);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Kakashi" } });
  fireEvent.change(screen.getByLabelText("Notizen"), { target: { value: "Nicht verlieren" } });
  fireEvent.click(screen.getByLabelText("Freigabe"));
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Kakashi");
  expect((screen.getByLabelText("Notizen") as HTMLTextAreaElement).value).toBe("Nicht verlieren");
  expect((screen.getByLabelText("Freigabe") as HTMLInputElement).checked).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("alert"));
  expect(success).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  action.mockResolvedValue(undefined);
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  expect(action.mock.calls[1][0].get("name")).toBe("Kakashi"); expect(success).toHaveBeenCalledOnce();
});
it("does not submit when confirmation is cancelled", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false), action = vi.fn();
  const { container } = render(<PeopleForm action={action} confirm="Entfernen?"><button>Entfernen</button></PeopleForm>);
  fireEvent.submit(container.querySelector("form")!); expect(action).not.toHaveBeenCalled(); confirm.mockRestore();
});
