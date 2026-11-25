import { expect, it } from "vitest";
import { shouldDemoteGpu } from "../../../src/common/fourier/shouldDemoteGpu.js";

it("waits for eight completed submissions", () => {
  expect(shouldDemoteGpu(new Array<number>(7).fill(250))).toBe(false);
});

it("ignores single outliers and accepts the threshold", () => {
  expect(shouldDemoteGpu([250, 3, 4, 30, 30, 30, 30, 30])).toBe(false);
});

it("demotes a consistently slow GPU using the median of the first eight submissions", () => {
  expect(shouldDemoteGpu([300, 250, 7, 125, 250, 290, 250, 300, 5])).toBe(true);
});
