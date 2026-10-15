// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("react-toastify", () => ({ toast: { success: vi.fn() } }));
import LoreImporter from "./LoreImporter";
import { loreBundleSchema } from "@/lib/lore-bundle";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("retains NPC choices and search input when preview validation fails", async () => {
  const packet = loreBundleSchema.parse({ format: 1, key: "ui-fixture:v1", revision: "a".repeat(40), npcs: [{ key: "teacher", name: "Fixture Teacher", category: "SHINOBI", status: "CONFIRMED", occupation: "Teacher", sources: [{ path: "Fixture.md", sha: "b".repeat(40) }] }], organizations: [], relationships: [] });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => packet }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Ein Ort fehlt. Auswahl bleibt erhalten." }) }));
  render(<LoreImporter campaignId="fixture" campaignName="Fixture campaign" packages={[{ id: "fixture.json", key: packet.key, npcs: 1, organizations: 0, missions: 0 }]} />);
  fireEvent.change(screen.getByLabelText("Privates Importpaket"), { target: { value: "fixture.json" } }); await screen.findByText("Fixture Teacher");
  const checkbox = screen.getByRole("checkbox", { name: /Fixture Teacher/ }) as HTMLInputElement; fireEvent.click(checkbox);
  const search = screen.getByLabelText("NPC-Suche nach Name, Dorf oder Beruf") as HTMLInputElement; fireEvent.change(search, { target: { value: "Teacher" } });
  fireEvent.click(screen.getByText("Auswahl prüfen und vergleichen")); await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Ein Ort fehlt"));
  expect(search.value).toBe("Teacher"); expect(checkbox.checked).toBe(true);
});
