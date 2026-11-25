import { BooleanProperty, Emitter, Multilink, NumberProperty, Property } from "scenerystack/axon";
import { clamp, Range } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import { createFourierEngine } from "../../common/fourier/createFourierEngine.js";
import { ComplexField } from "../../common/model/ComplexField.js";
import { FILTER_OBJECTS, type FilterObject, rasterizeImagingObject } from "../../common/model/imagingObjects.js";
import { type MaskSpec, rasterizeMask } from "../../common/model/masks.js";
import { FILTER_PARAMETERS as F, OPTICAL_PARAMETERS } from "../../FourierOpticsConstants.js";

export const FILTER_KINDS = [
  "open",
  "lowPass",
  "highPass",
  "bandPass",
  "verticalSlit",
  "horizontalSlit",
  "dcBlock",
  "phaseDot",
  "painted",
] as const;
export const FILTER_PRESETS = ["custom", "abbePorter", "darkField", "phaseContrast", "edgeEnhancement"] as const;

const configurations = {
  abbePorter: { object: "mesh", filter: "horizontalSlit" },
  darkField: { object: "phaseDisk", filter: "dcBlock" },
  phaseContrast: { object: "phaseDisk", filter: "phaseDot" },
  edgeEnhancement: { object: "letterF", filter: "highPass" },
} as const;

const numberProperty = ({ default: value, min, max }: { default: number; min: number; max: number }) =>
  new NumberProperty(value, { range: new Range(min, max) });

export class SpatialFilteringModel implements TModel {
  public readonly size = OPTICAL_PARAMETERS.gridSize.default;
  public readonly objectProperty = new Property<FilterObject>("letterF", { validValues: FILTER_OBJECTS });
  public readonly filterProperty = new Property<(typeof FILTER_KINDS)[number]>("open", { validValues: FILTER_KINDS });
  public readonly presetProperty = new Property<(typeof FILTER_PRESETS)[number]>("custom", {
    validValues: FILTER_PRESETS,
  });
  public readonly radiusProperty = numberProperty(F.radius);
  public readonly innerRadiusProperty = numberProperty(F.innerRadius);
  public readonly slitWidthProperty = numberProperty(F.slitWidth);
  public readonly slitAngleProperty = numberProperty(F.angle);
  public readonly brushRadiusProperty = numberProperty(F.brushRadius);
  public readonly eraseProperty = new BooleanProperty(false);
  public readonly logProperty = new BooleanProperty(true);
  public readonly phaseProperty = new BooleanProperty(false);
  public readonly transmittedProperty = new NumberProperty(1);
  public readonly inputsChangedEmitter = new Emitter();

  public readonly object = new ComplexField(this.size);
  public readonly spectrum = new ComplexField(this.size);
  public readonly reconstructed = new ComplexField(this.size);
  private readonly painted = new ComplexField(this.size);
  private readonly scratch = new ComplexField(this.size);
  private readonly engine = createFourierEngine(this.size);
  private lastObject: FilterObject | undefined;
  private applyingPreset = false;

  private readonly maskInputs = [
    this.objectProperty,
    this.filterProperty,
    this.radiusProperty,
    this.innerRadiusProperty,
    this.slitWidthProperty,
    this.slitAngleProperty,
  ];
  private readonly resettable = [
    ...this.maskInputs,
    this.presetProperty,
    this.brushRadiusProperty,
    this.eraseProperty,
    this.logProperty,
    this.phaseProperty,
    this.transmittedProperty,
  ];
  private readonly inputLink = Multilink.lazyMultilinkAny(this.maskInputs, () => {
    if (!this.applyingPreset) {
      this.presetProperty.value = "custom";
    }
    this.inputsChangedEmitter.emit();
  });
  private readonly applyPreset = (preset: (typeof FILTER_PRESETS)[number]): void => {
    if (preset === "custom") {
      return;
    }
    this.applyingPreset = true;
    const configuration = configurations[preset];
    this.objectProperty.value = configuration.object;
    this.filterProperty.value = configuration.filter;
    this.radiusProperty.value = preset === "edgeEnhancement" ? F.edgeRadius : F.radius.default;
    this.innerRadiusProperty.reset();
    this.slitWidthProperty.reset();
    this.slitAngleProperty.reset();
    this.applyingPreset = false;
  };

  public constructor() {
    this.painted.fill(1);
    this.presetProperty.lazyLink(this.applyPreset);
  }

  public getMask(): MaskSpec {
    const kind = this.filterProperty.value;
    const radius = this.radiusProperty.value;
    switch (kind) {
      case "open":
        return { kind };
      case "lowPass":
      case "highPass":
        return { kind, radius };
      case "bandPass":
        return { kind, inner: Math.min(this.innerRadiusProperty.value, radius), outer: radius };
      case "verticalSlit":
      case "horizontalSlit":
        return {
          kind: "slit",
          width: this.slitWidthProperty.value,
          angle: (this.slitAngleProperty.value * Math.PI) / 180 + (kind === "horizontalSlit" ? Math.PI / 2 : 0),
        };
      case "dcBlock":
      case "phaseDot":
        // These presets isolate the undeviated DC bin.
        return { kind, radius: 0 };
      case "painted":
        return { kind, transmission: this.painted.data };
    }
  }

  /** Paint a capsule connecting two cursor positions, in centered Fourier bins. */
  public paint(x: number, y: number, fromX = x, fromY = y): void {
    const radius = this.brushRadiusProperty.value;
    const half = this.size / 2;
    const dx = x - fromX;
    const dy = y - fromY;
    const lengthSquared = dx * dx + dy * dy;
    const value = Number(this.eraseProperty.value);
    for (
      let row = Math.max(-half, Math.ceil(Math.min(y, fromY) - radius));
      row <= Math.min(half - 1, Math.floor(Math.max(y, fromY) + radius));
      row++
    ) {
      for (
        let col = Math.max(-half, Math.ceil(Math.min(x, fromX) - radius));
        col <= Math.min(half - 1, Math.floor(Math.max(x, fromX) + radius));
        col++
      ) {
        const t = lengthSquared === 0 ? 0 : clamp(((col - fromX) * dx + (row - fromY) * dy) / lengthSquared, 0, 1);
        if ((col - fromX - t * dx) ** 2 + (row - fromY - t * dy) ** 2 <= radius * radius) {
          this.painted.set(col + half, row + half, value);
        }
      }
    }
    this.inputsChangedEmitter.emit();
  }

  public recompute(): Float32Array {
    const kind = this.objectProperty.value;
    if (kind !== this.lastObject) {
      rasterizeImagingObject(kind, this.object, this.scratch);
      this.engine.forward(this.object, this.spectrum);
      this.lastObject = kind;
    }
    const transmission = rasterizeMask(this.getMask(), this.size);
    this.engine.filterAndInverse(this.spectrum, transmission, this.reconstructed, "ideal");
    this.transmittedProperty.value = clamp(this.reconstructed.totalPower() / this.object.totalPower(), 0, 1);
    return transmission;
  }

  public reset(): void {
    for (const property of this.resettable) {
      property.reset();
    }
    this.painted.fill(1);
    this.inputsChangedEmitter.emit();
  }

  public dispose(): void {
    this.inputLink.dispose();
    this.presetProperty.unlink(this.applyPreset);
    for (const property of this.resettable) {
      property.dispose();
    }
    this.inputsChangedEmitter.dispose();
    this.engine.dispose();
  }
}
