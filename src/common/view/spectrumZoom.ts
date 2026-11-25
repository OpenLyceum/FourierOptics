import { Vector2 } from "scenerystack/dot";
import { ModelViewTransform2 } from "scenerystack/phetcommon";
import { OPTICAL_PARAMETERS, type SpectrumZoom } from "../../FourierOpticsConstants.js";

import { evenCrop } from "../model/opticalSystem.js";

export function zoomCrop(
  base: number,
  zoom: SpectrumZoom,
  size = OPTICAL_PARAMETERS.gridSize.default as number,
): number {
  return evenCrop(Math.min(size, (base * size) / OPTICAL_PARAMETERS.gridSize.default) / zoom, size);
}

/** DC sits at the centre of its sample pixel, half a bin beyond the crop midpoint. */
export function spectrumTransform(drawSize: number, crop: number): ModelViewTransform2 {
  const scale = drawSize / crop;
  const dc = drawSize / 2 + scale / 2;
  return ModelViewTransform2.createSinglePointScaleMapping(Vector2.ZERO, new Vector2(dc, dc), scale);
}
