// Adapted from OpenLyceum/HeatTransfer's common/field/gpu/GpuContext.ts.
import { Property } from "scenerystack/axon";
import { DISPLAY_SHADER, FFT_SHADER, FIELD_SHADER, REDUCE_SHADER } from "./shaders.js";
import { requestWebGpuDevice } from "./WebGpuSupport.js";

const sources = { fft: FFT_SHADER, field: FIELD_SHADER, reduce: REDUCE_SHADER, display: DISPLAY_SHADER };
type Kernel = keyof typeof sources;

export type GpuContext = {
  device: GPUDevice;
  layout: GPUBindGroupLayout;
  pipelines: Record<Kernel, GPUComputePipeline>;
  maxGridSize: number;
  fallback: boolean;
};

export const gpuContextProperty = new Property<GpuContext | null>(null);
let initialization: Promise<boolean> | undefined;
let forcedInitialization: Promise<boolean> | undefined;

/** One acquisition for the simulation. Explicit CPU startup does not probe WebGPU. */
export async function initializeGpuContext(backend: "auto" | "cpu" | "gpu"): Promise<void> {
  if (backend === "cpu") {
    return;
  }
  initialization ??= acquire(backend === "gpu");
  const skippedFallback = await initialization;
  if (backend === "gpu" && skippedFallback) {
    forcedInitialization ??= acquire(true);
    await forcedInitialization;
  }
}

export function demoteGpuContext(context: GpuContext): void {
  if (gpuContextProperty.value === context) {
    gpuContextProperty.value = null;
    context.device.destroy();
  }
}

async function acquire(allowFallback: boolean): Promise<boolean> {
  const result = await requestWebGpuDevice(allowFallback);
  if (!result || result === "fallback") {
    return result === "fallback";
  }
  const { device, fallback } = result;
  let lost = false;
  device.lost.then(() => {
    lost = true;
    if (gpuContextProperty.value?.device === device) {
      gpuContextProperty.value = null;
    }
  });
  try {
    const maxBytes = Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize);
    // Incoherent imaging uses a complex 2N x 2N work grid.
    const maxGridSize = 2 ** Math.floor(Math.log2(Math.sqrt(maxBytes / 32)));
    if (maxGridSize < 256) {
      device.destroy();
      return false;
    }
    const layout = device.createBindGroupLayout({
      entries: (["read-only-storage", "read-only-storage", "storage", "storage", "uniform"] as const).map(
        (type, binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type } }),
      ),
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const compile = async (label: Kernel): Promise<GPUComputePipeline> => {
      const module = device.createShaderModule({ label, code: sources[label] });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter((message) => message.type === "error");
      if (errors.length > 0) {
        throw new Error(errors.map((error) => `${label}:${error.lineNum} ${error.message}`).join("\n"));
      }
      return device.createComputePipelineAsync({ label, layout: pipelineLayout, compute: { module } });
    };
    const [fft, field, reduce, display] = await Promise.all([
      compile("fft"),
      compile("field"),
      compile("reduce"),
      compile("display"),
    ]);
    if (!lost) {
      const context = { device, layout, pipelines: { fft, field, reduce, display }, maxGridSize, fallback };
      device.addEventListener("uncapturederror", (event) => {
        event.preventDefault();
        // biome-ignore lint/suspicious/noConsole: Preserve the WebGPU diagnostic when a driver falls back.
        console.info("Fourier Optics WebGPU runtime failure", event.error);
        demoteGpuContext(context);
      });
      gpuContextProperty.value = context;
    }
  } catch (error) {
    device.destroy();
    // biome-ignore lint/suspicious/noConsole: Report the driver or shader diagnostic before CPU fallback.
    console.info("Fourier Optics WebGPU initialization failed", error);
  }
  return false;
}
