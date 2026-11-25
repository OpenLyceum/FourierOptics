import { Vector2 } from "scenerystack/dot";
import { expect, it } from "vitest";
import { spectrumTransform, zoomCrop } from "../../../src/common/view/spectrumZoom.js";
import { SPECTRUM_ZOOMS } from "../../../src/FourierOpticsConstants.js";

it.each(SPECTRUM_ZOOMS)("aligns mask handles and pixels at ×%i", (zoom) => {
  const draw = 226;
  const crop = zoomCrop(144, zoom);
  const transform = spectrumTransform(draw, crop);
  const handle = new Vector2(4, -3);
  const position = transform.modelToViewPosition(handle);
  expect(position.x).toBeCloseTo(((crop / 2 + 4.5) * draw) / crop);
  expect(position.y).toBeCloseTo(((crop / 2 - 2.5) * draw) / crop);
  const recovered = transform.viewToModelPosition(position);
  expect(recovered.x).toBeCloseTo(handle.x);
  expect(recovered.y).toBeCloseTo(handle.y);
  expect(zoomCrop(80, zoom, 1024)).toBe(4 * zoomCrop(80, zoom, 256));
});
