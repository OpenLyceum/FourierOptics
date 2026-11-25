// Backend selection adapted from OpenLyceum/HeatTransfer’s common/field/createFieldEngine.ts.
import { DEFAULT_CPU_RESOLUTION, DEFAULT_GPU_RESOLUTION, MAX_CPU_RESOLUTION } from "../../FourierOpticsConstants.js";
import type { BackendChoice, ResolutionChoice } from "../../preferences/FourierOpticsPreferencesModel.js";
import { CpuFourierEngine } from "./cpu/CpuFourierEngine.js";
import type { FourierEngine } from "./FourierEngine.js";
import { gpuContextProperty } from "./gpu/GpuContext.js";
import { WebGpuFourierEngine } from "./gpu/WebGpuFourierEngine.js";

type Request = { backend: BackendChoice; resolution: ResolutionChoice };
export type FourierEngineInfo = {
  backend: FourierEngine["backend"];
  size: number;
  degraded: boolean;
};

/** Numeric calls keep the direct CPU reference API for numerical clients. */
export function createFourierEngine(size: number): CpuFourierEngine;
export function createFourierEngine(request: Request): { engine: FourierEngine; info: FourierEngineInfo };
export function createFourierEngine(
  request: number | Request,
): CpuFourierEngine | { engine: FourierEngine; info: FourierEngineInfo } {
  if (typeof request === "number") {
    return new CpuFourierEngine(request);
  }

  const context = request.backend === "cpu" ? null : gpuContextProperty.value;
  if (context) {
    const size = Math.min(request.resolution || DEFAULT_GPU_RESOLUTION, context.maxGridSize);
    return { engine: new WebGpuFourierEngine(size, context), info: { backend: "webgpu", size, degraded: false } };
  }
  const size = Math.min(request.resolution || DEFAULT_CPU_RESOLUTION, MAX_CPU_RESOLUTION);
  return {
    engine: new CpuFourierEngine(size),
    info: { backend: "cpu", size, degraded: request.backend !== "cpu" },
  };
}
