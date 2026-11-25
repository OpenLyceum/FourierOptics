// biome-ignore-all lint/style/noNonNullAssertion: Internal array indices are bounded by the checked field, pupil and intensity sizes.
import { ComplexField } from "../../model/ComplexField.js";
import { fft2d, fftshift, ifftshift } from "../../model/fft2d.js";
import type { FourierEngine, FourierOperations, ImagingMode } from "../FourierEngine.js";

/** CPU reference implementation with caller-owned inputs and outputs. */
export class CpuFourierEngine implements FourierEngine, FourierOperations {
  public readonly backend = "cpu";
  public readonly size: number;
  private intensitySpectrum: ComplexField | undefined;
  private pupilKey: string | undefined;
  private pupilCorrelation: ComplexField | undefined;
  private otf: Float32Array | undefined;
  private disposed = false;

  public constructor(size: number) {
    ComplexField.checkSize(size);
    this.size = size;
  }

  public submit<T>(encode: (operations: FourierOperations) => T): T {
    this.checkActive();
    return encode(this);
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
    key?: string,
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

    spectrum.multiplyByMask(this.getOtf(pupil, key));
    this.toImage(spectrum, mode);
    // Taking the real part also projects any unpaired Nyquist terms onto
    // the Hermitian component of the sampled spectrum.
    for (let i = 0; i < sampleCount; i++) {
      outIntensity[i] = spectrum.data[2 * i]!;
    }
  }

  public swapPhase(amplitude: ComplexField, phase: ComplexField, output: ComplexField): void {
    this.checkFields(amplitude, output);
    this.checkFields(phase, output);
    for (let i = 0; i < output.data.length; i += 2) {
      const magnitude = Math.hypot(amplitude.data[i]!, amplitude.data[i + 1]!);
      const real = phase.data[i]!;
      const imaginary = phase.data[i + 1]!;
      const donor = Math.hypot(real, imaginary);
      output.data[i] = donor > 0 ? magnitude * (real / donor) : magnitude;
      output.data[i + 1] = donor > 0 ? magnitude * (imaginary / donor) : 0;
    }
    this.toImage(output, "ideal");
  }

  public camera(image: ComplexField | Float32Array, output: ComplexField, scale: number): void {
    const intensity = image instanceof ComplexField ? image.intensity() : image;
    const { size } = output;
    const centre = size / 2;
    const at = (x: number, y: number) =>
      x >= 0 && x < size && y >= 0 && y < size ? Math.max(0, intensity[y * size + x]!) : 0;
    for (let y = 0; y < size; y++) {
      const sourceY = (y - centre) / scale + centre;
      const row = Math.floor(sourceY);
      const dy = sourceY - row;
      for (let x = 0; x < size; x++) {
        const sourceX = (x - centre) / scale + centre;
        const column = Math.floor(sourceX);
        const dx = sourceX - column;
        const top = (1 - dx) * at(column, row) + dx * at(column + 1, row);
        const bottom = (1 - dx) * at(column, row + 1) + dx * at(column + 1, row + 1);
        output.set(x, y, Math.sqrt((1 - dy) * top + dy * bottom));
      }
    }
  }

  public read(_field: ComplexField): void {
    // CPU operations already fill the caller's arrays.
  }

  public readIntensity(_intensity: Float32Array): void {
    // CPU operations already fill the caller's arrays.
  }

  public readRow(field: ComplexField, crop: number): Float32Array {
    const start = 2 * (field.size * (field.size >> 1) + (field.size >> 1) - (crop >> 1));
    return field.data.slice(start, start + 2 * crop);
  }

  public readPower(field: ComplexField): () => number {
    const power = field.totalPower();
    return () => power;
  }

  public display(): undefined {
    return undefined;
  }

  public dispose(): void {
    this.intensitySpectrum = undefined;
    this.pupilCorrelation = undefined;
    this.otf = undefined;
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

  private getOtf(pupil: Float32Array, key: string | undefined): Float32Array {
    const size = this.size;
    this.otf ??= new Float32Array(pupil.length);
    const otf = this.otf;
    if (key !== undefined && key === this.pupilKey) {
      return otf;
    }
    this.pupilKey = key;
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
    const dc = data[0]!;
    if (dc === 0) {
      otf.fill(0);
      return otf;
    }
    const centre = Math.floor(size / 2);
    const paddedSize = correlation.size;
    for (let y = 0; y < size; y++) {
      const lagY = (y - centre + paddedSize) % paddedSize;
      for (let x = 0; x < size; x++) {
        const lagX = (x - centre + paddedSize) % paddedSize;
        const lag = 2 * (lagY * paddedSize + lagX);
        const i = 2 * (y * size + x);
        otf[i] = data[lag]! / dc;
        otf[i + 1] = data[lag + 1]! / dc;
      }
    }
    return otf;
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
