// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PortraitManager from "./PortraitManager";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn() } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens a compact modal, lets the user select a bundled portrait and saves only on confirmation", async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.open = false; } });
  const fetcher = vi.fn().mockImplementation((_url, init) => Promise.resolve({ ok: true, json: async () => init?.method === "POST" ? { ok: true } : { portraits: [], owners: [], canEdit: true, canAssignOwner: false, accessHandle: "handle" } }));
  vi.stubGlobal("fetch", fetcher);
  await act(async () => { render(<PortraitManager campaignId="campaign" kind="npc" entityId="npc" name="Mika" />); });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Bild auswählen" }));
  expect(screen.getByRole("dialog", { name: "Mika" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^Kunoichi/ }));
  expect(fetcher.mock.calls.some(call => call[1]?.method === "POST")).toBe(false);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Vorlage übernehmen" })); });
  const body = fetcher.mock.calls.find(call => call[1]?.method === "POST")![1].body as FormData;
  expect(body.get("op")).toBe("PRESET"); expect(body.get("preset")).toBe("kunoichi");
  fireEvent.click(screen.getByRole("button", { name: "Portrait-Auswahl schliessen" })); expect(screen.queryByRole("dialog")).toBeNull();
});
