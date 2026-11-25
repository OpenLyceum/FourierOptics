import { AUTO_GPU_MEDIAN_LIMIT_MS, AUTO_GPU_SAMPLE_COUNT } from "../../FourierOpticsConstants.js";

/** Evaluate just the initial sample window without mutating the caller's measurements. */
export function shouldDemoteGpu(milliseconds: readonly number[]): boolean {
  if (milliseconds.length < AUTO_GPU_SAMPLE_COUNT) {
    return false;
  }
  const samples = milliseconds.slice(0, AUTO_GPU_SAMPLE_COUNT).sort((a, b) => a - b);
  const middle = samples.length / 2;
  return ((samples[middle - 1] ?? 0) + (samples[middle] ?? 0)) / 2 > AUTO_GPU_MEDIAN_LIMIT_MS;
}
