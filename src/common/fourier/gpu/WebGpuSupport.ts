/// <reference types="@webgpu/types" />

// Adapted from OpenLyceum/HeatTransfer's common/field/gpu/WebGpuSupport.ts.
export async function requestWebGpuDevice(): Promise<GPUDevice | null> {
  try {
    const adapter = await globalThis.navigator?.gpu?.requestAdapter({ powerPreference: "high-performance" });
    return (await adapter?.requestDevice()) ?? null;
  } catch {
    return null;
  }
}
