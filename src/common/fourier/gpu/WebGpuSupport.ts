/// <reference types="@webgpu/types" />

// Adapted from OpenLyceum/HeatTransfer's common/field/gpu/WebGpuSupport.ts.
export async function requestWebGpuDevice(
  allowFallback: boolean,
): Promise<{ device: GPUDevice; fallback: boolean } | "fallback" | null> {
  try {
    const adapter = await globalThis.navigator?.gpu?.requestAdapter();
    if (!adapter) {
      return null;
    }
    const fallback = adapter.info?.isFallbackAdapter === true;
    return fallback && !allowFallback ? "fallback" : { device: await adapter.requestDevice(), fallback };
  } catch {
    return null;
  }
}
