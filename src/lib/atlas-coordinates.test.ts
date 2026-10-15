import { expect, it } from "vitest";
import { imagePoint, normalizedPoint } from "./atlas-coordinates";
it("maps image pixels to normalized coordinates independent of screen size or zoom", () => {
  for (const [w, h] of [[1536, 1024], [12000, 6000], [320, 200]]) { const [lat, lng] = imagePoint(.25, .75, w, h); expect(normalizedPoint(lat, lng, w, h)).toEqual({ x: .25, y: .75 }); }
  expect(imagePoint(0, 0, 100, 100)).toEqual([100, 0]); expect(imagePoint(1, 1, 100, 100)).toEqual([0, 100]);
});
it("rejects positions outside the image and invalid dimensions", () => { expect(normalizedPoint(1, -1, 100, 100)).toBeNull(); expect(normalizedPoint(101, 10, 100, 100)).toBeNull(); expect(normalizedPoint(1, 1, 0, 0)).toBeNull(); });
