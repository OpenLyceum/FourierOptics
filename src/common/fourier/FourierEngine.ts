import type { ComplexField } from "../model/ComplexField.js";

export type ImagingMode = "ideal" | "4f";

/** All fields have the engine's grid size and are centred in both domains. */
export interface FourierEngine {
  readonly backend: "cpu" | "webgpu";
  readonly size: number;

  forward(input: ComplexField, outSpectrum: ComplexField): void;

  /** Interleaved mask. Defaults to ideal filtering; "4f" gives the inverted two-lens image. */
  filterAndInverse(spectrum: ComplexField, mask: Float32Array, outImage: ComplexField, mode?: ImagingMode): void;

  /** Interleaved angular-spectrum transfer. */
  propagate(field: ComplexField, transfer: Float32Array, out: ComplexField): void;

  /**
   * Applies the normalized pupil autocorrelation to the input intensity spectrum.
   * Intensities are real, one value per sample. Pupil is centred and interleaved.
   * Defaults to the inverted 4f image; "ideal" keeps the object's orientation.
   */
  imageThroughSystem(
    inputIntensity: Float32Array,
    pupil: Float32Array,
    outIntensity: Float32Array,
    mode?: ImagingMode,
  ): void;

  dispose(): void;
}
