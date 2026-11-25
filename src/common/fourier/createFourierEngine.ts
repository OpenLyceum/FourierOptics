import { CpuFourierEngine } from "./cpu/CpuFourierEngine.js";
import type { FourierEngine } from "./FourierEngine.js";

export function createFourierEngine(size: number): FourierEngine {
  return new CpuFourierEngine(size);
}
