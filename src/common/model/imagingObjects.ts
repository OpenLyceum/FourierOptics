import { FILTER_PARAMETERS as F, GRATING_PARAMETERS, OPTICAL_PARAMETERS } from "../../FourierOpticsConstants.js";
import { rasterizeAperture, sampleCoverage } from "./apertures.js";
import type { ComplexField } from "./ComplexField.js";

export const FILTER_OBJECTS = ["letterF", "grating", "mesh", "letterMesh", "phaseCells", "sinusoids"] as const;
export type FilterObject = (typeof FILTER_OBJECTS)[number];

/** Draw non-overlapping transparent ellipses over a unit background. */
function rasterizePhaseCells(field: ComplexField): void {
  const scale = field.size / OPTICAL_PARAMETERS.gridSize.default;
  const centre = Math.floor(field.size / 2);
  field.fill(1);
  for (const cell of F.phaseCells) {
    const cx = centre + cell.x * scale;
    const cy = centre + cell.y * scale;
    const rx = cell.radiusX * scale;
    const ry = cell.radiusY * scale;
    const realDelta = Math.cos(cell.phase) - 1;
    const imaginary = Math.sin(cell.phase);
    const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let y = Math.max(0, Math.ceil(cy - ry - 0.5)); y <= Math.min(field.size - 1, cy + ry + 0.5); y++) {
      for (let x = Math.max(0, Math.ceil(cx - rx - 0.5)); x <= Math.min(field.size - 1, cx + rx + 0.5); x++) {
        const coverage = sampleCoverage(inside, x, y);
        field.set(x, y, 1 + coverage * realDelta, coverage * imaginary);
      }
    }
  }
}

export function rasterizeImagingObject(kind: FilterObject, field: ComplexField, scratch: ComplexField): void {
  switch (kind) {
    case "letterF":
      rasterizeAperture({ kind, ...F.letter }, field);
      break;
    case "phaseCells":
      rasterizePhaseCells(field);
      break;
    case "sinusoids":
      rasterizeAperture(
        {
          kind,
          bias: GRATING_PARAMETERS.bias,
          gratings: GRATING_PARAMETERS.defaults.map((grating) => ({
            ...grating,
            angle: (grating.angle * Math.PI) / 180,
            phase: 0,
          })),
        },
        field,
      );
      break;
    case "grating":
    case "mesh":
    case "letterMesh":
      rasterizeAperture({ kind: "grating", period: F.gratingPeriod, angle: 0 }, field);
      if (kind !== "grating") {
        rasterizeAperture({ kind: "grating", period: F.gratingPeriod, angle: Math.PI / 2 }, scratch);
        field.multiplyByMask(scratch.data);
      }
      if (kind === "letterMesh") {
        rasterizeAperture({ kind: "letterF", ...F.letter }, scratch);
        field.multiplyByMask(scratch.data);
      }
      break;
  }
}
