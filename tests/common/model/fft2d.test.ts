import { describe, expect, it } from "vitest";
import { ComplexField } from "../../../src/common/model/ComplexField.js";
import { fft1d, fft2d, fftshift, ifftshift } from "../../../src/common/model/fft2d.js";
import { OPTICAL_PARAMETERS } from "../../../src/FourierOpticsConstants.js";

function sampleField(size: number): ComplexField {
  const field = new ComplexField(size);
  let state = 17;
  for (let i = 0; i < field.data.length; i++) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    field.data[i] = state / 2 ** 31 - 1;
  }
  return field;
}

function relativeError(actual: ComplexField, expected: ComplexField): number {
  let squaredError = 0;
  for (let i = 0; i < actual.data.length; i++) {
    squaredError += (actual.data[i]! - expected.data[i]!) ** 2;
  }
  return Math.sqrt(squaredError / expected.totalPower());
}

describe("FFT reference transforms", () => {
  it("matches a four-sample 1D DFT and its inverse", () => {
    const data = Float32Array.of(0, 0, 1, 0, 0, 0, 0, 0);
    fft1d(data);
    const expected = [1, 0, 0, -1, -1, 0, 0, 1];
    data.forEach((value, i) => {
      expect(value).toBeCloseTo(expected[i]!, 7);
    });
    fft1d(data, true);
    data.forEach((value, i) => {
      expect(value).toBeCloseTo(i === 2 ? 1 : 0, 7);
    });
    expect(() => fft1d(new Float32Array(6))).toThrow(RangeError);
  });

  it.each([OPTICAL_PARAMETERS.gridSize.min, OPTICAL_PARAMETERS.gridSize.max])(
    "round-trips a %i² field with relative error below 1e-5",
    (size) => {
      const input = sampleField(size);
      const actual = input.copy();
      fft2d(actual);
      fft2d(actual, true);
      expect(relativeError(actual, input)).toBeLessThan(1e-5);
    },
  );

  it("satisfies Parseval with the unscaled forward convention", () => {
    const size = 64;
    const field = sampleField(size);
    const power = field.totalPower();
    fft2d(field);
    expect(field.totalPower() / (size * size * power)).toBeCloseTo(1, 6);
  });

  it("is linear for complex-weighted sums", () => {
    const a = sampleField(64);
    const b = new ComplexField(64);
    b.set(17, 29, -2, 1);
    const sum = a.copy();
    for (let i = 0; i < sum.data.length; i += 2) {
      sum.data[i] = a.data[i]! - 2 * b.data[i + 1]!;
      sum.data[i + 1] = a.data[i + 1]! + 2 * b.data[i]!;
    }

    fft2d(sum);
    fft2d(a);
    fft2d(b);
    for (let i = 0; i < a.data.length; i += 2) {
      a.data[i] = a.data[i]! - 2 * b.data[i + 1]!;
      a.data[i + 1] = a.data[i + 1]! + 2 * b.data[i]!;
    }
    expect(relativeError(sum, a)).toBeLessThan(1e-6);
  });

  it("moves the raw origin to the centre and reverses the shift", () => {
    const field = new ComplexField(64);
    field.set(0, 0, 2, -3);
    field.set(32, 32, -4, 1);
    const original = field.copy();
    fftshift(field);
    expect(field.get(32, 32)).toEqual([2, -3]);
    expect(field.get(0, 0)).toEqual([-4, 1]);
    ifftshift(field);
    expect(relativeError(field, original)).toBe(0);
  });

  it("runs a 256² forward and inverse transform", () => {
    const size = OPTICAL_PARAMETERS.gridSize.default;
    const input = sampleField(size);
    const actual = input.copy();
    const start = performance.now();
    fft2d(actual);
    fft2d(actual, true);
    // biome-ignore lint/suspicious/noConsole: Report the performance sanity check without a time limit.
    console.log(`FFT ${size}² forward + inverse: ${performance.now() - start} ms`);
    expect(relativeError(actual, input)).toBeLessThan(1e-5);
  });
});
