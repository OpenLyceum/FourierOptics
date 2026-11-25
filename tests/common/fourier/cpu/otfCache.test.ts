import { expect, it, vi } from "vitest";
import { CpuFourierEngine } from "../../../../src/common/fourier/cpu/CpuFourierEngine.js";
import * as transforms from "../../../../src/common/model/fft2d.js";
import { rasterizeMask } from "../../../../src/common/model/masks.js";

it("reuses pupil autocorrelation across objects and invalidates it when pupil parameters change", () => {
  const spy = vi.spyOn(transforms, "fft2d");
  const n = 32;
  const engine = new CpuFourierEngine(n);
  const input = new Float32Array(n * n);
  const output = new Float32Array(n * n);
  const centre = n * (n / 2) + n / 2;
  input[centre] = 1;
  const open = rasterizeMask({ kind: "lowPass", radius: 8 }, n);
  const closed = new Float32Array(open.length);
  const paddedCalls = () => spy.mock.calls.filter(([field]) => field.size === 2 * n).length;

  engine.imageThroughSystem(input, open, output, "4f", "iris=2");
  expect(paddedCalls()).toBe(2);
  const peak = output[centre]!;
  expect(peak).toBeGreaterThan(0.05);
  input[centre] = 0.5;
  engine.imageThroughSystem(input, open, output, "4f", "iris=2");
  expect(paddedCalls()).toBe(2);
  expect(output[centre]).toBeCloseTo(peak / 2, 6);
  engine.imageThroughSystem(input, closed, output, "4f", "iris=0");
  expect(paddedCalls()).toBe(4);
  expect(output[centre]).toBeCloseTo(0, 7);
  engine.dispose();
});
