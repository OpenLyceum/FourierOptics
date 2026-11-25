// biome-ignore-all lint/style/noNonNullAssertion: FFT strides, butterfly offsets and twiddle indices stay within the validated power-of-two buffers.
/**
 * In-place radix-2 DFTs on interleaved complex samples. Forward uses exp(-2πikn/N)
 * with unit scale. Inverse uses the positive sign and divides by N (1D) or N² (2D).
 * The raw FFTs use index zero as origin. For a centred 2D transform, apply ifftshift
 * before the FFT and fftshift after it. Centred index floor(N/2) represents zero
 * in each axis, with the negative Nyquist bin at index zero for even N.
 */

import { ComplexField } from "./ComplexField.js";

type Plan = {
  readonly reversed: Uint32Array;
  readonly real: Float64Array;
  readonly imaginary: Float64Array;
};

const plans = new Map<number, Plan>();

function planFor(size: number): Plan {
  const cached = plans.get(size);
  if (cached) {
    return cached;
  }

  const reversed = new Uint32Array(size);
  for (let i = 1; i < size; i++) {
    reversed[i] = (reversed[i >>> 1]! >>> 1) + (i % 2) * (size / 2);
  }

  const real = new Float64Array(size / 2);
  const imaginary = new Float64Array(size / 2);
  for (let i = 0; i < real.length; i++) {
    const angle = (-2 * Math.PI * i) / size;
    real[i] = Math.cos(angle);
    imaginary[i] = Math.sin(angle);
  }

  const plan = { reversed, real, imaginary };
  plans.set(size, plan);
  return plan;
}

/** Transforms one row or column. Offset and stride count Float32 entries. */
function transformLine(data: Float32Array, offset: number, stride: number, plan: Plan, inverse: boolean): void {
  const size = plan.reversed.length;
  for (let i = 0; i < size; i++) {
    const j = plan.reversed[i]!;
    if (i < j) {
      swapSamples(data, offset + i * stride, offset + j * stride);
    }
  }

  const sign = inverse ? -1 : 1;
  for (let width = 2; width <= size; width *= 2) {
    const half = width / 2;
    const twiddleStride = size / width;
    for (let start = 0; start < size; start += width) {
      for (let j = 0; j < half; j++) {
        const a = offset + (start + j) * stride;
        const b = a + half * stride;
        const twiddleIndex = j * twiddleStride;
        const wr = plan.real[twiddleIndex]!;
        const wi = sign * plan.imaginary[twiddleIndex]!;
        const ar = data[a]!;
        const ai = data[a + 1]!;
        const br = data[b]! * wr - data[b + 1]! * wi;
        const bi = data[b]! * wi + data[b + 1]! * wr;
        data[a] = ar + br;
        data[a + 1] = ai + bi;
        data[b] = ar - br;
        data[b + 1] = ai - bi;
      }
    }
  }
}

function scale(data: Float32Array, divisor: number): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i]! / divisor;
  }
}

export function fft1d(data: Float32Array, inverse = false): void {
  const size = data.length / 2;
  ComplexField.checkSize(size);

  transformLine(data, 0, 2, planFor(size), inverse);
  if (inverse) {
    scale(data, size);
  }
}

export function fft2d(field: ComplexField, inverse = false): void {
  const { size, data } = field;
  const plan = planFor(size);
  const rowStride = 2 * size;
  for (let y = 0; y < size; y++) {
    transformLine(data, y * rowStride, 2, plan, inverse);
  }
  for (let x = 0; x < size; x++) {
    transformLine(data, 2 * x, rowStride, plan, inverse);
  }
  if (inverse) {
    scale(data, size * size);
  }
}

function swapSamples(data: Float32Array, a: number, b: number): void {
  const real = data[a]!;
  const imaginary = data[a + 1]!;
  data[a] = data[b]!;
  data[a + 1] = data[b + 1]!;
  data[b] = real;
  data[b + 1] = imaginary;
}

export function fftshift(field: ComplexField): void {
  const { size, data } = field;
  const half = Math.floor(size / 2);
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < size; x++) {
      swapSamples(data, 2 * (y * size + x), 2 * ((y + half) * size + ((x + half) % size)));
    }
  }
}

/** Identical to fftshift on an even grid, and the identity for size one. */
export function ifftshift(field: ComplexField): void {
  fftshift(field);
}
