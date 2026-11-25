import { Vector2 } from "scenerystack/dot";
import { expect, it } from "vitest";
import { spectrumTransform, zoomCrop } from "../../../src/common/view/spectrumZoom.js";
import { SPECTRUM_ZOOMS } from "../../../src/FourierOpticsConstants.js";

it.each(SPECTRUM_ZOOMS)("aligns mask handles and pixels at ×%i", (zoom) => {
  const draw = 226;
  const crop = zoomCrop(144, zoom);
  const transform = spectrumTransform(draw, crop);
  const handle = new Vector2(1, -1);
  const position = transform.modelToViewPosition(handle);
  expect(position.x).toBeCloseTo(((crop / 2 + 1.5) * draw) / crop);
  expect(position.y).toBeCloseTo(((crop / 2 - 0.5) * draw) / crop);
  const recovered = transform.viewToModelPosition(position);
  expect(recovered.x).toBeCloseTo(handle.x);
  expect(recovered.y).toBeCloseTo(handle.y);
  expect(crop % 2).toBe(0);
  expect(transform.modelToViewDeltaX(2)).toBeCloseTo((2 * draw) / crop);
  expect(Math.abs(zoomCrop(144, zoom, 1024) / 4 - crop)).toBeLessThanOrEqual(1);
});
