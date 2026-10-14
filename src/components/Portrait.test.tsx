// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import Portrait from "./Portrait";
afterEach(cleanup);
it("shows an accessible fallback and retries after its portrait changes", () => {
  const { container } = render(<Portrait campaignId="campaign" kind="npc" entityId="npc" name="Kakashi" />);
  const original = container.querySelector("img")!.src;
  fireEvent.error(container.querySelector("img")!); expect(screen.getByRole("img", { name: "Portrait: Kakashi" }).textContent).toBe("KA");
  act(() => window.dispatchEvent(new CustomEvent("shio:portrait-changed", { detail: { campaignId: "other", kind: "npc", entityId: "npc" } })));
  expect(container.querySelector("img")).toBeNull();
  act(() => window.dispatchEvent(new CustomEvent("shio:portrait-changed", { detail: { campaignId: "campaign", kind: "npc", entityId: "npc" } })));
  expect(container.querySelector("img")!.src).not.toBe(original);
});
