// biome-ignore-all lint/style/noNonNullAssertion: Coordinates and mask lengths are checked and the sample loops stay within the allocated buffers.
/** A square, row-major complex field with an origin at (floor(size/2), floor(size/2)). */
export class ComplexField {
  public readonly size: number;
  public readonly data: Float32Array;

  /** The optional interleaved samples are copied. */
  public constructor(size: number, samples?: Float32Array) {
    ComplexField.checkSize(size);

    const length = 2 * size * size;
    if (samples && samples.length !== length) {
      throw new RangeError("Sample count must match the complex field size.");
    }
    this.size = size;
    this.data = samples ? new Float32Array(samples) : new Float32Array(length);
  }

  public static checkSize(size: number): void {
    if (!Number.isInteger(size) || size < 1 || 2 ** Math.floor(Math.log2(size)) !== size) {
      throw new RangeError("Grid size must be a positive power of two.");
    }
  }

  public copy(): ComplexField {
    return new ComplexField(this.size, this.data);
  }

  public fill(real: number, imaginary = 0): void {
    for (let i = 0; i < this.data.length; i += 2) {
      this.data[i] = real;
      this.data[i + 1] = imaginary;
    }
  }

  public get(x: number, y: number): [real: number, imaginary: number] {
    const i = this.sampleIndex(x, y);
    return [this.data[i]!, this.data[i + 1]!];
  }

  public set(x: number, y: number, real: number, imaginary = 0): void {
    const i = this.sampleIndex(x, y);
    this.data[i] = real;
    this.data[i + 1] = imaginary;
  }

  /** A real mask has one value per sample. A complex mask is interleaved. */
  public multiplyByMask(mask: Float32Array): void {
    const data = this.data;
    if (mask.length * 2 === data.length) {
      for (let i = 0; i < mask.length; i++) {
        data[2 * i] = data[2 * i]! * mask[i]!;
        data[2 * i + 1] = data[2 * i + 1]! * mask[i]!;
      }
    } else if (mask.length === data.length) {
      for (let i = 0; i < data.length; i += 2) {
        const real = data[i]!;
        const imaginary = data[i + 1]!;
        const maskReal = mask[i]!;
        const maskImaginary = mask[i + 1]!;
        data[i] = real * maskReal - imaginary * maskImaginary;
        data[i + 1] = real * maskImaginary + imaginary * maskReal;
      }
    } else {
      throw new RangeError("Mask length must match the real or complex field size.");
    }
  }

  public intensity(): Float32Array {
    return this.mapSamples((real, imaginary) => real * real + imaginary * imaginary);
  }

  public amplitude(): Float32Array {
    return this.mapSamples(Math.hypot);
  }

  public phase(): Float32Array {
    return this.mapSamples((real, imaginary) => Math.atan2(imaginary, real));
  }

  /** Discrete sum of squared magnitudes in sample units. */
  public totalPower(): number {
    let power = 0;
    for (let i = 0; i < this.data.length; i += 2) {
      const real = this.data[i]!;
      const imaginary = this.data[i + 1]!;
      power += real * real + imaginary * imaginary;
    }
    return power;
  }

  /** Scales peak amplitude to one while preserving phase. Returns the original peak amplitude. */
  public normalizeToPeak(): number {
    let peak = 0;
    for (let i = 0; i < this.data.length; i += 2) {
      peak = Math.max(peak, Math.hypot(this.data[i]!, this.data[i + 1]!));
    }

    if (peak > 0) {
      for (let i = 0; i < this.data.length; i++) {
        this.data[i] = this.data[i]! / peak;
      }
    }
    return peak;
  }

  private sampleIndex(x: number, y: number): number {
    if (!(Number.isInteger(x) && Number.isInteger(y)) || x < 0 || x >= this.size || y < 0 || y >= this.size) {
      throw new RangeError("Sample coordinates must be integers within the field.");
    }
    return 2 * (y * this.size + x);
  }

  private mapSamples(map: (real: number, imaginary: number) => number): Float32Array {
    const result = new Float32Array(this.size * this.size);
    for (let i = 0; i < result.length; i++) {
      result[i] = map(this.data[2 * i]!, this.data[2 * i + 1]!);
    }
    return result;
  }
}
