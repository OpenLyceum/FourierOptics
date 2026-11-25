// biome-ignore-all lint/style/noNonNullAssertion: Internal array indices are bounded by the checked field, pupil and intensity sizes.
import { ComplexField } from "../../model/ComplexField.js";
import { fft2d, fftshift, ifftshift } from "../../model/fft2d.js";
import type { FourierEngine, ImagingMode } from "../FourierEngine.js";

/** CPU reference implementation with caller-owned inputs and outputs. */
export class CpuFourierEngine implements FourierEngine {
  public readonly backend = "cpu";
  public readonly size: number;
  private intensitySpectrum: ComplexField | undefined;
  private pupilCorrelation: ComplexField | undefined;
  private disposed = false;

  public constructor(size: number) {
    ComplexField.checkSize(size);
    this.size = size;
  }

  public forward(input: ComplexField, outSpectrum: ComplexField): void {
    this.checkFields(input, outSpectrum);
    outSpectrum.data.set(input.data);
    this.transformCentred(outSpectrum, false);
  }

  public filterAndInverse(
    spectrum: ComplexField,
    mask: Float32Array,
    outImage: ComplexField,
    mode: ImagingMode = "ideal",
  ): void {
    this.checkFields(spectrum, outImage);
    this.checkTransmission(mask);
    outImage.data.set(spectrum.data);
    outImage.multiplyByMask(mask);
    this.toImage(outImage, mode);
  }

  public propagate(field: ComplexField, transfer: Float32Array, out: ComplexField): void {
    this.checkTransmission(transfer);
    this.forward(field, out);
    out.multiplyByMask(transfer);
    this.toImage(out, "ideal");
  }

  public imageThroughSystem(
    inputIntensity: Float32Array,
    pupil: Float32Array,
    outIntensity: Float32Array,
    mode: ImagingMode = "4f",
  ): void {
    this.checkActive();
    this.checkTransmission(pupil);
    const size = this.size;
    const sampleCount = size * size;
    if (inputIntensity.length !== sampleCount || outIntensity.length !== sampleCount) {
      throw new RangeError("Intensities must have one real value per grid sample.");
    }

    this.intensitySpectrum ??= new ComplexField(size);
    const spectrum = this.intensitySpectrum;
    for (let i = 0; i < sampleCount; i++) {
      spectrum.data[2 * i] = inputIntensity[i]!;
      spectrum.data[2 * i + 1] = 0;
    }
    this.transformCentred(spectrum, false);

    const correlation = this.autocorrelatePupil(pupil);
    const dc = correlation.data[0]!;
    if (dc === 0) {
      outIntensity.fill(0);
      return;
    }

    const centre = Math.floor(size / 2);
    const paddedSize = correlation.size;
    for (let y = 0; y < size; y++) {
      const lagY = (y - centre + paddedSize) % paddedSize;
      for (let x = 0; x < size; x++) {
        const lagX = (x - centre + paddedSize) % paddedSize;
        const lag = 2 * (lagY * paddedSize + lagX);
        const i = 2 * (y * size + x);
        const real = spectrum.data[i]!;
        const imaginary = spectrum.data[i + 1]!;
        const otfReal = correlation.data[lag]! / dc;
        const otfImaginary = correlation.data[lag + 1]! / dc;
        spectrum.data[i] = real * otfReal - imaginary * otfImaginary;
        spectrum.data[i + 1] = real * otfImaginary + imaginary * otfReal;
      }
    }
    this.toImage(spectrum, mode);
    // Taking the real part also projects any unpaired Nyquist terms onto
    // the Hermitian component of the sampled spectrum.
    for (let i = 0; i < sampleCount; i++) {
      outIntensity[i] = spectrum.data[2 * i]!;
    }
  }

  public dispose(): void {
    this.intensitySpectrum = undefined;
    this.pupilCorrelation = undefined;
    this.disposed = true;
  }

  private transformCentred(field: ComplexField, inverse: boolean): void {
    ifftshift(field);
    fft2d(field, inverse);
    fftshift(field);
  }

  private toImage(field: ComplexField, mode: ImagingMode): void {
    this.transformCentred(field, mode === "ideal");
    if (mode === "4f") {
      // The second lens also performs a forward FT. Two forward transforms
      // reverse both axes. Match the inverse's amplitude scale by dividing by N².
      const sampleCount = this.size * this.size;
      for (let i = 0; i < field.data.length; i++) {
        field.data[i] = field.data[i]! / sampleCount;
      }
    }
  }

  private autocorrelatePupil(pupil: Float32Array): ComplexField {
    const size = this.size;
    // Padding prevents overlap with periodic copies of the pupil at large lags.
    this.pupilCorrelation ??= new ComplexField(2 * size);
    const correlation = this.pupilCorrelation;
    const data = correlation.data;
    data.fill(0);
    const rowLength = 2 * size;
    for (let y = 0; y < size; y++) {
      data.set(pupil.subarray(y * rowLength, (y + 1) * rowLength), y * 2 * rowLength);
    }
    fft2d(correlation);
    for (let i = 0; i < data.length; i += 2) {
      const real = data[i]!;
      const imaginary = data[i + 1]!;
      data[i] = real * real + imaginary * imaginary;
      data[i + 1] = 0;
    }
    fft2d(correlation, true);
    return correlation;
  }

  private checkActive(): void {
    if (this.disposed) {
      throw new Error("The Fourier engine has been disposed.");
    }
  }

  private checkFields(input: ComplexField, output: ComplexField): void {
    this.checkActive();
    if (input.size !== this.size || output.size !== this.size) {
      throw new RangeError("Fields must match the Fourier engine's size.");
    }
  }

  private checkTransmission(transmission: Float32Array): void {
    if (transmission.length !== 2 * this.size * this.size) {
      throw new RangeError("Transmission must match the complex field size.");
    }
  }
}
