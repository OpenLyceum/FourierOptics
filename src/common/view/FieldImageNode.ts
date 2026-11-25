import { Bounds2 } from "scenerystack/dot";
import { CanvasNode } from "scenerystack/scenery";
import { EXPOSURE_DB } from "../../FourierOpticsConstants.js";
import type { FieldDisplayMode, FourierOperations } from "../fourier/FourierEngine.js";
import type { ComplexField } from "../model/ComplexField.js";
import { encodeSrgb, wavelengthToLinearRgb } from "./spectralColor.js";

/** Draws a centered crop (or the entire field) with optional display interpolation. */
export class FieldImageNode extends CanvasNode {
  private readonly sampleCanvas = document.createElement("canvas");
  private readonly sampleContext = this.sampleCanvas.getContext("2d");
  private imageData: ImageData | undefined;
  private readonly drawSize: number;
  private readonly smooth: boolean;
  private cropSize = 0;
  private wavelengthNm: number | undefined;
  private readonly tint: [number, number, number] = [1, 1, 1];

  public constructor(drawSize: number, smooth = false) {
    super({ canvasBounds: new Bounds2(0, 0, drawSize, drawSize), pickable: false });
    this.drawSize = drawSize;
    this.smooth = smooth;
    this.sampleCanvas.width = this.sampleCanvas.height = 0;
  }

  public capture(
    ops: FourierOperations,
    field: ComplexField,
    mode: FieldDisplayMode,
    crop = field.size,
    exposure = EXPOSURE_DB.default as number,
    wavelength?: number,
  ): () => void {
    const tint = this.getTint(wavelength);
    const pixels = ops.display(field, { crop, mode, exposure, tint });
    return () => {
      this.resize(crop);
      if (pixels) {
        this.sampleContext?.putImageData(new ImageData(pixels, crop, crop), 0, 0);
      } else {
        this.paintField(field, mode, exposure, tint);
      }
      this.invalidatePaint();
    };
  }

  private resize(crop: number): void {
    if (this.cropSize !== crop) {
      this.cropSize = crop;
      this.sampleCanvas.width = this.sampleCanvas.height = crop;
      this.imageData = undefined;
    }
  }

  private getTint(wavelengthNm?: number): [number, number, number] {
    if (wavelengthNm === undefined) {
      return [1, 1, 1];
    }
    if (this.wavelengthNm !== wavelengthNm) {
      wavelengthToLinearRgb(wavelengthNm, this.tint);
      this.wavelengthNm = wavelengthNm;
    }
    const [r, g, b] = this.tint;
    const peak = Math.max(r, g, b);
    return [r / peak, g / peak, b / peak];
  }

  private paintField(
    field: ComplexField,
    mode: FieldDisplayMode,
    exposureDb: number,
    tint: readonly [number, number, number],
  ): void {
    if (!this.sampleContext) {
      return;
    }
    const { size, data } = field;
    const crop = this.cropSize;
    const first = (size - crop) / 2;
    this.imageData ??= this.sampleContext.createImageData(crop, crop);
    const pixels = this.imageData.data;
    const [red, green, blue] = tint;
    let peak = 0;
    for (let i = 0; i < data.length; i += 2) {
      const real = data[i] ?? 0;
      const imaginary = data[i + 1] ?? 0;
      peak = Math.max(peak, real * real + imaginary * imaginary);
    }
    const intensityScale = peak > 0 ? 1 / peak : 0;

    let pixel = 0;
    for (let y = first; y < first + crop; y++) {
      for (let x = first; x < first + crop; x++) {
        const index = 2 * (y * size + x);
        const real = data[index] ?? 0;
        const imaginary = data[index + 1] ?? 0;
        const intensity = (real * real + imaginary * imaginary) * intensityScale;
        if (mode === "phase") {
          paintPhase(pixels, pixel, real, imaginary, Math.sqrt(intensity));
        } else {
          const brightness = displayBrightness(intensity, mode, exposureDb);
          pixels[pixel] = encodeSrgb(brightness * red);
          pixels[pixel + 1] = encodeSrgb(brightness * green);
          pixels[pixel + 2] = encodeSrgb(brightness * blue);
        }
        pixels[pixel + 3] = 255;
        pixel += 4;
      }
    }
    this.sampleContext.putImageData(this.imageData, 0, 0);
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    context.save();
    context.imageSmoothingEnabled = this.smooth;
    if (this.cropSize > 0) {
      context.drawImage(this.sampleCanvas, 0, 0, this.drawSize, this.drawSize);
    }
    context.restore();
  }

  public override dispose(): void {
    this.imageData = undefined;
    this.sampleCanvas.width = 0;
    this.sampleCanvas.height = 0;
    super.dispose();
  }
}

function displayBrightness(intensity: number, mode: Exclude<FieldDisplayMode, "phase">, exposureDb: number): number {
  if (mode === "log") {
    return Math.max(0, 1 + (10 * Math.log10(intensity)) / exposureDb);
  }
  return mode === "amplitude" ? Math.sqrt(intensity) : intensity;
}

function paintPhase(
  pixels: Uint8ClampedArray,
  index: number,
  real: number,
  imaginary: number,
  brightness: number,
): void {
  const hue = ((6 * Math.atan2(imaginary, real)) / (2 * Math.PI) + 6) % 6;
  pixels[index] = encodeSrgb(brightness * hueChannel(hue, 5));
  pixels[index + 1] = encodeSrgb(brightness * hueChannel(hue, 3));
  pixels[index + 2] = encodeSrgb(brightness * hueChannel(hue, 1));
}

/** HSV channel at full saturation, with hue measured in sixths of a turn. */
function hueChannel(hue: number, offset: number): number {
  const k = (hue + offset) % 6;
  return 1 - Math.max(0, Math.min(k, 4 - k, 1));
}
