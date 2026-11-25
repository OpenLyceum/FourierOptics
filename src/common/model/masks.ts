import { ComplexField } from "./ComplexField.js";

/** Lengths are in Fourier bins. Slit angle is its normal, from +x toward +y in radians. */
export type MaskSpec =
  | { readonly kind: "open" }
  | { readonly kind: "lowPass"; readonly radius: number }
  | { readonly kind: "highPass"; readonly radius: number }
  | { readonly kind: "dcBlock"; readonly radius: number }
  | { readonly kind: "bandPass"; readonly inner: number; readonly outer: number }
  | { readonly kind: "slit"; readonly width: number; readonly angle: number }
  | { readonly kind: "phaseDot"; readonly radius: number; readonly phase?: number }
  | { readonly kind: "painted"; readonly transmission: Float32Array };

function radialBand(inner: number, outer: number, includeInner: boolean): (x: number, y: number) => boolean {
  const innerSquared = inner * inner;
  const outerSquared = outer * outer;
  return (x, y) => {
    const rSquared = x * x + y * y;
    return rSquared <= outerSquared && (includeInner ? rSquared >= innerSquared : rSquared > innerSquared);
  };
}

function passesBin(spec: Exclude<MaskSpec, { kind: "painted" }>): (x: number, y: number) => boolean {
  switch (spec.kind) {
    case "open":
      return () => true;
    case "lowPass":
    case "phaseDot":
      return radialBand(0, spec.radius, true);
    case "highPass":
    case "dcBlock":
      return radialBand(spec.radius, Infinity, false);
    case "bandPass":
      return radialBand(spec.inner, spec.outer, true);
    case "slit": {
      const cos = Math.cos(spec.angle);
      const sin = Math.sin(spec.angle);
      const halfWidth = spec.width / 2;
      return (x, y) => Math.abs(x * cos + y * sin) <= halfWidth;
    }
  }
}

/** Returns a snapshot of the complex transmission, with DC at (floor(N/2), floor(N/2)). */
export function rasterizeMask(spec: MaskSpec, size: number): Float32Array {
  const field = new ComplexField(size);
  if (spec.kind === "painted") {
    field.fill(1);
    field.multiplyByMask(spec.transmission);
    return field.data;
  }

  const phase = spec.kind === "phaseDot" ? (spec.phase ?? Math.PI / 2) : 0;
  const insideReal = Math.cos(phase);
  const insideImaginary = Math.sin(phase);
  const outsideReal = spec.kind === "phaseDot" ? 1 : 0;
  const passes = passesBin(spec);
  const centre = Math.floor(size / 2);
  let i = 0;
  for (let y = -centre; y < size - centre; y++) {
    for (let x = -centre; x < size - centre; x++) {
      const inside = passes(x, y);
      field.data[i++] = inside ? insideReal : outsideReal;
      field.data[i++] = inside ? insideImaginary : 0;
    }
  }
  return field.data;
}

/**
 * Multiplies one or more equally sized interleaved complex transmissions.
 * @internal Exported for unit tests; not part of the application API.
 */
export function compose(masks: readonly Float32Array[]): Float32Array {
  const [first, ...rest] = masks;
  if (!first) {
    throw new RangeError("At least one mask is required to infer the grid size.");
  }

  const result = new ComplexField(Math.sqrt(first.length / 2), first);
  for (const mask of rest) {
    if (mask.length !== first.length) {
      throw new RangeError("Complex masks must have matching lengths.");
    }
    result.multiplyByMask(mask);
  }
  return result.data;
}
