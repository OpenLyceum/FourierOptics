import type { ComplexField } from "./ComplexField.js";

type Sinusoid = {
  readonly period: number;
  readonly angle: number;
  readonly contrast: number;
  readonly phase: number;
};

/**
 * Lengths are in samples, centred at (floor(N/2), floor(N/2)). Angles are radians
 * from +x toward +y (down the rows). A grating angle points along its modulation.
 */
export type ApertureSpec =
  | { readonly kind: "slit"; readonly width: number; readonly height?: number }
  | { readonly kind: "doubleSlit"; readonly width: number; readonly separation: number; readonly height?: number }
  | { readonly kind: "rectangle"; readonly width: number; readonly height: number }
  | { readonly kind: "circle"; readonly radius: number }
  | { readonly kind: "annulus"; readonly inner: number; readonly outer: number }
  | { readonly kind: "grating"; readonly period: number; readonly angle: number; readonly dutyCycle?: number }
  | { readonly kind: "cross"; readonly width: number; readonly height: number; readonly thickness: number }
  | { readonly kind: "letterF"; readonly width: number; readonly height: number; readonly thickness: number }
  | {
      readonly kind: "sinusoids";
      readonly bias: number;
      readonly gratings: readonly Sinusoid[];
    }
  | { readonly kind: "phaseDisk"; readonly radius: number; readonly phase: number };

const EDGE_SUBSAMPLES = 4;

function radial(r: number): (x: number, y: number) => boolean {
  const radiusSquared = r * r;
  return (x, y) => x * x + y * y <= radiusSquared;
}

function insideAperture(spec: Exclude<ApertureSpec, { kind: "sinusoids" }>): (x: number, y: number) => boolean {
  switch (spec.kind) {
    case "slit":
    case "rectangle": {
      const halfWidth = spec.width / 2;
      const halfHeight = (spec.height ?? Infinity) / 2;
      return (x, y) => Math.abs(x) <= halfWidth && Math.abs(y) <= halfHeight;
    }
    case "doubleSlit": {
      const halfWidth = spec.width / 2;
      const halfHeight = (spec.height ?? Infinity) / 2;
      const halfSeparation = spec.separation / 2;
      return (x, y) => Math.abs(Math.abs(x) - halfSeparation) <= halfWidth && Math.abs(y) <= halfHeight;
    }
    case "circle":
    case "phaseDisk":
      return radial(spec.radius);
    case "annulus": {
      const innerSquared = spec.inner * spec.inner;
      const outerSquared = spec.outer * spec.outer;
      return (x, y) => {
        const distanceSquared = x * x + y * y;
        return distanceSquared >= innerSquared && distanceSquared <= outerSquared;
      };
    }
    case "grating": {
      const xRate = Math.cos(spec.angle) / spec.period;
      const yRate = Math.sin(spec.angle) / spec.period;
      const duty = spec.dutyCycle ?? 0.5;
      return (x, y) => {
        const cycle = xRate * x + yRate * y + duty / 2;
        return cycle - Math.floor(cycle) < duty;
      };
    }
    case "cross": {
      const halfStroke = spec.thickness / 2;
      const halfWidth = spec.width / 2;
      const halfHeight = spec.height / 2;
      return (x, y) =>
        (Math.abs(x) <= halfStroke && Math.abs(y) <= halfHeight) ||
        (Math.abs(y) <= halfStroke && Math.abs(x) <= halfWidth);
    }
    case "letterF": {
      const { width, height, thickness } = spec;
      return (x, y) => {
        const fromLeft = x + width / 2;
        const fromTop = y + height / 2;
        return (
          fromLeft >= 0 &&
          fromLeft <= width &&
          fromTop >= 0 &&
          fromTop <= height &&
          (fromLeft <= thickness ||
            fromTop <= thickness ||
            (Math.abs(y) <= thickness / 2 && fromLeft <= (2 * width) / 3))
        );
      };
    }
  }
}

function rasterizeSinusoids(spec: Extract<ApertureSpec, { kind: "sinusoids" }>, field: ComplexField): void {
  if (spec.gratings.length > 3) {
    throw new RangeError("At most three sinusoidal gratings can be combined.");
  }
  const gratings = spec.gratings.map(({ period, angle, contrast, phase }) => ({
    xRate: (2 * Math.PI * Math.cos(angle)) / period,
    yRate: (2 * Math.PI * Math.sin(angle)) / period,
    contrast,
    phase,
  }));
  const { size, data } = field;
  const centre = Math.floor(size / 2);
  let i = 0;
  for (let y = -centre; y < size - centre; y++) {
    for (let x = -centre; x < size - centre; x++) {
      let modulation = 1;
      for (const grating of gratings) {
        modulation += grating.contrast * Math.cos(grating.xRate * x + grating.yRate * y + grating.phase);
      }
      data[i++] = spec.bias * modulation;
      data[i++] = 0;
    }
  }
}

/** Fraction of a sample covered by a hard-edged shape, estimated on a subpixel grid. */
export function sampleCoverage(inside: (x: number, y: number) => boolean, x: number, y: number): number {
  let hits = 0;
  for (let sy = 0; sy < EDGE_SUBSAMPLES; sy++) {
    const sampleY = y - 0.5 + (sy + 0.5) / EDGE_SUBSAMPLES;
    for (let sx = 0; sx < EDGE_SUBSAMPLES; sx++) {
      const sampleX = x - 0.5 + (sx + 0.5) / EDGE_SUBSAMPLES;
      hits += Number(inside(sampleX, sampleY));
    }
  }
  return hits / (EDGE_SUBSAMPLES * EDGE_SUBSAMPLES);
}

/** Smooth sinusoids are point sampled. Hard edges average 4×4 subpixel transmissions. */
export function rasterizeAperture(spec: ApertureSpec, field: ComplexField): void {
  if (spec.kind === "sinusoids") {
    rasterizeSinusoids(spec, field);
    return;
  }

  const inside = insideAperture(spec);
  const outsideReal = spec.kind === "phaseDisk" ? 1 : 0;
  const realDelta = spec.kind === "phaseDisk" ? Math.cos(spec.phase) - 1 : 1;
  const imaginaryDelta = spec.kind === "phaseDisk" ? Math.sin(spec.phase) : 0;
  const { size, data } = field;
  const centre = Math.floor(size / 2);
  let i = 0;
  for (let y = -centre; y < size - centre; y++) {
    for (let x = -centre; x < size - centre; x++) {
      const coverage = sampleCoverage(inside, x, y);
      data[i++] = outsideReal + coverage * realDelta;
      data[i++] = coverage * imaginaryDelta;
    }
  }
}
