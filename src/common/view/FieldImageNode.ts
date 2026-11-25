import { Bounds2 } from "scenerystack/dot";
import { CanvasNode } from "scenerystack/scenery";
import { EXPOSURE_DB } from "../../FourierOpticsConstants.js";
import type { ComplexField } from "../model/ComplexField.js";
import { encodeSrgb, wavelengthToLinearRgb } from "./spectralColor.js";

type FieldDisplayMode = "intensity" | "log" | "amplitude" | "phase";

/** Draws a centered crop (or the entire field) with nearest-neighbor sampling. */
export class FieldImageNode extends CanvasNode {
  private readonly sampleCanvas = document.createElement("canvas");
  private readonly sampleContext = this.sampleCanvas.getContext("2d");
  private imageData: ImageData | undefined;
  private readonly field: ComplexField;
  private readonly drawSize: number;
  private readonly cropSize: number;
  private intensityScale = 0;
  private wavelengthNm: number | undefined;
  private readonly tint: [number, number, number] = [1, 1, 1];

  public constructor(field: ComplexField, drawSize: number, cropSize = field.size) {
    super({ canvasBounds: new Bounds2(0, 0, drawSize, drawSize), pickable: false });
    this.field = field;
    this.drawSize = drawSize;
    this.cropSize = cropSize;
    this.sampleCanvas.width = cropSize;
    this.sampleCanvas.height = cropSize;
    this.imageData = this.sampleContext?.createImageData(cropSize, cropSize);
  }

  public updateScale(): void {
    const { data } = this.field;
    let peak = 0;
    for (let i = 0; i < data.length; i += 2) {
      const real = data[i] ?? 0;
      const imaginary = data[i + 1] ?? 0;
      peak = Math.max(peak, real * real + imaginary * imaginary);
    }
    this.intensityScale = peak > 0 ? 1 / peak : 0;
  }

  public update(mode: FieldDisplayMode, exposureDb: number = EXPOSURE_DB.default, wavelengthNm?: number): void {
    if (!(this.imageData && this.sampleContext)) {
      return;
    }
    const { size, data } = this.field;
    const crop = this.cropSize;
    const first = (size - crop) / 2;
    const pixels = this.imageData.data;
    if (wavelengthNm !== undefined && this.wavelengthNm !== wavelengthNm) {
      wavelengthToLinearRgb(wavelengthNm, this.tint);
      this.wavelengthNm = wavelengthNm;
    }
    const useTint = wavelengthNm !== undefined;
    const [r, g, b] = this.tint;
    const peak = Math.max(r, g, b);
    const red = useTint ? r / peak : 1;
    const green = useTint ? g / peak : 1;
    const blue = useTint ? b / peak : 1;

    let pixel = 0;
    for (let y = first; y < first + crop; y++) {
      for (let x = first; x < first + crop; x++) {
        const index = 2 * (y * size + x);
        const real = data[index] ?? 0;
        const imaginary = data[index + 1] ?? 0;
        const intensity = (real * real + imaginary * imaginary) * this.intensityScale;
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
    this.invalidatePaint();
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(this.sampleCanvas, 0, 0, this.drawSize, this.drawSize);
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
