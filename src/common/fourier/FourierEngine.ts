import type { ComplexField } from "../model/ComplexField.js";

export type ImagingMode = "ideal" | "4f";
export type FieldDisplayMode = "intensity" | "log" | "amplitude" | "phase";

export type FieldDisplay = {
  crop: number;
  mode: FieldDisplayMode;
  exposure: number;
  tint: readonly [number, number, number];
};

/** Outputs are caller-owned. Within a submission they may be used as inputs to later operations. */
export interface FourierOperations {
  forward(input: ComplexField, outSpectrum: ComplexField): void;
  filterAndInverse(spectrum: ComplexField, mask: Float32Array, outImage: ComplexField, mode?: ImagingMode): void;
  propagate(field: ComplexField, transfer: Float32Array, out: ComplexField): void;
  /** Pupil is centred and interleaved. Optional key identifies the unchanged pupil on this grid. */
  imageThroughSystem(
    input: Float32Array,
    pupil: Float32Array,
    output: Float32Array,
    mode?: ImagingMode,
    key?: string,
  ): void;
  swapPhase(amplitude: ComplexField, phase: ComplexField, output: ComplexField): void;
  camera(image: ComplexField | Float32Array, output: ComplexField, scale: number): void;
  read(field: ComplexField): void;
  readIntensity(intensity: Float32Array): void;
  readRow(field: ComplexField, crop: number): Float32Array;
  readPower(field: ComplexField): () => number;
  /** GPU returns packed pixels filled at completion. CPU leaves display mapping to its CanvasNode. */
  display(field: ComplexField, settings: FieldDisplay): Uint8ClampedArray<ArrayBuffer> | undefined;
}

export interface FourierEngine {
  readonly backend: "cpu" | "webgpu";
  readonly size: number;
  /** CPU returns directly. GPU resolves after all requested readbacks are available. */
  submit<T>(encode: (operations: FourierOperations) => T): T | Promise<T>;
  dispose(): void;
}
