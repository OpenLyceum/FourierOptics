import { DerivedProperty, Emitter, Multilink, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { AUTO_GPU_SAMPLE_COUNT } from "../../FourierOpticsConstants.js";
import type { FourierOpticsPreferencesModel } from "../../preferences/FourierOpticsPreferencesModel.js";
import type { CpuFourierEngine } from "./cpu/CpuFourierEngine.js";
import { createFourierEngine, type FourierEngineInfo } from "./createFourierEngine.js";
import type { FourierEngine, FourierOperations } from "./FourierEngine.js";
import { gpuContextProperty } from "./gpu/GpuContext.js";
import { shouldDemoteGpu } from "./shouldDemoteGpu.js";

/** Shared engine lifetime. Screens replace their own field sets when the effective grid changes. */
export abstract class FourierScreenModel {
  public readonly inputsChangedEmitter = new Emitter();
  public readonly engineInfoProperty: Property<FourierEngineInfo>;
  public readonly sizeProperty: TReadOnlyProperty<number> & { dispose(): void };
  public readonly preferences: FourierOpticsPreferencesModel | undefined;
  private engine: FourierEngine;
  private readonly gpuSamples: number[] = [];
  private readonly settingsLink: ReturnType<typeof Multilink.lazyMultilinkAny> | undefined;

  protected constructor(preferences?: FourierOpticsPreferencesModel) {
    this.preferences = preferences;
    const create = () =>
      createFourierEngine({
        backend: preferences?.backendProperty.value ?? "cpu",
        resolution: preferences?.resolutionProperty.value ?? 0,
        gpuTooSlow: preferences?.gpuTooSlowProperty.value ?? false,
      });
    const initial = create();
    this.engine = initial.engine;
    this.engineInfoProperty = new Property(initial.info);
    this.sizeProperty = new DerivedProperty([this.engineInfoProperty], (info) => info.size);
    this.settingsLink =
      preferences &&
      Multilink.lazyMultilinkAny(
        [
          preferences.backendProperty,
          preferences.resolutionProperty,
          preferences.gpuTooSlowProperty,
          gpuContextProperty,
        ],
        () => {
          const next = create();
          const current = this.engineInfoProperty.value;
          if (next.info.backend === current.backend && next.info.size === current.size) {
            next.engine.dispose();
          } else {
            this.engine.dispose();
            this.engine = next.engine;
            this.gpuSamples.length = 0;
          }
          this.engineInfoProperty.value = next.info;
          this.inputsChangedEmitter.emit();
        },
      );
  }

  public get size(): number {
    return this.sizeProperty.value;
  }

  protected get cpu(): CpuFourierEngine {
    if (this.engine.backend !== "cpu") {
      throw new Error("Submit WebGPU operations through the asynchronous frame contract.");
    }
    return this.engine as CpuFourierEngine;
  }

  public submit<T>(work: (operations: FourierOperations) => T): T | Promise<T> {
    const engine = this.engine;
    const preferences = this.preferences;
    if (
      engine.backend !== "webgpu" ||
      preferences?.backendProperty.value !== "auto" ||
      this.gpuSamples.length >= AUTO_GPU_SAMPLE_COUNT
    ) {
      return engine.submit(work);
    }
    const start = performance.now();
    return Promise.resolve(engine.submit(work)).then((result) => {
      if (
        this.engine === engine &&
        preferences.backendProperty.value === "auto" &&
        this.gpuSamples.length < AUTO_GPU_SAMPLE_COUNT
      ) {
        this.gpuSamples.push(performance.now() - start);
        if (shouldDemoteGpu(this.gpuSamples)) {
          preferences.gpuTooSlowProperty.value = true;
        }
      }
      return result;
    });
  }

  public dispose(): void {
    this.gpuSamples.length = AUTO_GPU_SAMPLE_COUNT;
    this.settingsLink?.dispose();
    this.engine.dispose();
    this.sizeProperty.dispose();
    this.engineInfoProperty.dispose();
    this.inputsChangedEmitter.dispose();
  }
}
