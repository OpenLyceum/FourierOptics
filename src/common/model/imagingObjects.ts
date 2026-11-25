import { FILTER_PARAMETERS as F, GRATING_PARAMETERS } from "../../FourierOpticsConstants.js";
import { rasterizeAperture } from "./apertures.js";
import type { ComplexField } from "./ComplexField.js";

export const FILTER_OBJECTS = ["letterF", "grating", "mesh", "letterMesh", "phaseDisk", "sinusoids"] as const;
export type FilterObject = (typeof FILTER_OBJECTS)[number];

export function rasterizeImagingObject(kind: FilterObject, field: ComplexField, scratch: ComplexField): void {
  switch (kind) {
    case "letterF":
      rasterizeAperture({ kind, ...F.letter }, field);
      break;
    case "phaseDisk":
      rasterizeAperture({ kind, radius: F.phaseRadius, phase: F.weakPhase }, field);
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
