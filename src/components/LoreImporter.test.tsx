// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("react-toastify", () => ({ toast: { success: vi.fn() } }));
import LoreImporter from "./LoreImporter";
import { loreBundleSchema } from "@/lib/lore-bundle";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("previews private techniques and the reserved player team with explicit selections", async () => {
  const source = { path: "Fixture.md", sha: "b".repeat(40) };
  const packet = loreBundleSchema.parse({ format: 1, key: "private-technique-fixture:v1", revision: "a".repeat(40), npcs: [{ key: "teacher", name: "Fixture Teacher", category: "SHINOBI", sources: [source] }],
    organizations: [{ key: "reserved", name: "Fixture Player Team", type: "TEAM", reservedPlayerTeam: true, sources: [source], members: [] }], relationships: [],
    jutsu: [{ key: "technique", slug: "fixture-technique", name: "Fixture Technique", description: "Fixture effect", rank: "B", category: "Ninjutsu", pool: "CHARACTER_SIGNATURE", status: "DRAFT", assumptions: "All mechanic values require explicit DM approval.", chakraCost: 20, range: "30 ft", duration: "1 round", actionType: "Action", natureKeys: [], allowedNpcKeys: ["teacher"], sources: [source] }],
  });
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => packet }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Fixture preview response" }) }); vi.stubGlobal("fetch", fetch);
  render(<LoreImporter campaignId="fixture" campaignName="Fixture campaign" packages={[{ id: "fixture.json", key: "Fixture Teams", npcs: 1, organizations: 1, missions: 0 }]} />);
  fireEvent.change(screen.getByLabelText("Privates Importpaket"), { target: { value: "fixture.json" } }); await screen.findByText(/PLAYER TEAM – Reserved/);
  const technique = screen.getByRole("checkbox", { name: /Fixture Technique/ }) as HTMLInputElement; expect(technique.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /Homebrew-Vorschläge/ })); fireEvent.click(technique);
  fireEvent.click(screen.getByRole("checkbox", { name: /Fixture Player Team/ })); fireEvent.click(screen.getByText("Auswahl prüfen und vergleichen"));
  await screen.findByText("Fixture preview response");
  const sent = fetch.mock.calls[1][1].body as FormData; const selected = JSON.parse(String(sent.get("selection")));
  expect(selected.jutsu).toEqual(["technique"]); expect(selected.organizations).toEqual(["reserved"]); expect(selected.npcs).toEqual([]); expect(sent.get("op")).toBe("PREVIEW");
});
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
