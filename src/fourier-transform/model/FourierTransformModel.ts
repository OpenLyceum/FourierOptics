import { BooleanProperty, DerivedProperty, Multilink, NumberProperty, Property } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import type { FourierOperations } from "../../common/fourier/FourierEngine.js";
import { FourierScreenModel } from "../../common/fourier/FourierScreenModel.js";
import { GridFields } from "../../common/fourier/GridFields.js";
import { type ApertureSpec, rasterizeAperture } from "../../common/model/apertures.js";
import type { ComplexField } from "../../common/model/ComplexField.js";
import { evenCrop, focalPlaneCoordinate, spatialFrequencyStep } from "../../common/model/opticalSystem.js";
import {
  AIRY_FIFTH_ZERO_OVER_PI,
  APERTURE_FIT_FRINGE_COUNT,
  APERTURE_PARAMETERS,
  APERTURE_VIEW_UM,
  EXPOSURE_DB,
  FOCAL_VIEW_MM,
  OPTICAL_PARAMETERS,
  PHASE_COMPARISON_DIMENSIONS,
} from "../../FourierOpticsConstants.js";
import type { FourierOpticsPreferencesModel } from "../../preferences/FourierOpticsPreferencesModel.js";

export const APERTURE_KINDS = [
  "slit",
  "doubleSlit",
  "rectangle",
  "circle",
  "annulus",
  "grating",
  "cross",
  "letterF",
] as const;
type ApertureKind = (typeof APERTURE_KINDS)[number];

export const APERTURE_DIMENSIONS = {
  slit: ["width"],
  doubleSlit: ["width", "separation"],
  rectangle: ["width", "height"],
  circle: ["radius"],
  annulus: ["radius", "innerRatio"],
  grating: ["period"],
  cross: ["width", "height", "thickness"],
  letterF: ["width", "height", "thickness"],
} as const;

const O = OPTICAL_PARAMETERS;
const numberProperty = ({ default: value, min, max }: { default: number; min: number; max: number }) =>
  new NumberProperty(value, { range: new Range(min, max) });

type ApertureDimensions = Record<keyof typeof APERTURE_PARAMETERS, number>;

function apertureSpec(kind: ApertureKind, dimensions: ApertureDimensions): ApertureSpec {
  const { width, height, separation, radius, innerRatio, period, thickness } = dimensions;
  switch (kind) {
    case "slit":
      return { kind, width: width };
    case "doubleSlit":
      return { kind, width: width, separation: width + separation };
    case "rectangle":
      return { kind, width: width, height: height };
    case "circle":
      return { kind, radius: radius };
    case "annulus":
      return { kind, inner: (radius * innerRatio) / 100, outer: radius };
    case "grating":
      return { kind, period: period, angle: 0 };
    case "cross":
    case "letterF":
      return {
        kind,
        width: width,
        height: height,
        thickness: Math.min(thickness, width, height),
      };
  }
}

export class FourierTransformModel extends FourierScreenModel implements TModel {
  public readonly focalViewProperty = numberProperty(FOCAL_VIEW_MM);
  public readonly apertureProperty = new Property<ApertureKind>("circle", { validValues: APERTURE_KINDS });
  public readonly objectAProperty = new Property<ApertureKind>("letterF", { validValues: APERTURE_KINDS });
  public readonly objectBProperty = new Property<ApertureKind>("cross", { validValues: APERTURE_KINDS });
  public readonly dimensions = {
    width: numberProperty(APERTURE_PARAMETERS.width),
    height: numberProperty(APERTURE_PARAMETERS.height),
    separation: numberProperty(APERTURE_PARAMETERS.separation),
    radius: numberProperty(APERTURE_PARAMETERS.radius),
    innerRatio: numberProperty(APERTURE_PARAMETERS.innerRatio),
    period: numberProperty(APERTURE_PARAMETERS.period),
    thickness: numberProperty(APERTURE_PARAMETERS.thickness),
  };
  public readonly wavelengthProperty = numberProperty(O.wavelengthNm);
  public readonly focalLengthProperty = numberProperty(O.f1Mm);
  public readonly pitchUm = O.pitchUm;
  public readonly exposureProperty = numberProperty(EXPOSURE_DB);
  public readonly logProperty = new BooleanProperty(true);
  public readonly phaseProperty = new BooleanProperty(false);
  public readonly tintProperty = new BooleanProperty(true);
  public readonly swapProperty = new BooleanProperty(false);
  public readonly focalStepProperty = new DerivedProperty(
    [this.sizeProperty, this.wavelengthProperty, this.focalLengthProperty],
    (size, wavelength, focalLength) =>
      focalPlaneCoordinate(spatialFrequencyStep(size, this.pitchUm), wavelength, focalLength),
  );

  public readonly focalViewRangeProperty = new DerivedProperty(
    [this.wavelengthProperty, this.focalLengthProperty],
    (wavelength, focalLength) =>
      new Range(
        FOCAL_VIEW_MM.min,
        Math.min(FOCAL_VIEW_MM.max, focalPlaneCoordinate(1 / this.pitchUm, wavelength, focalLength)),
      ),
  );
  private readonly constrainFocalView = (range: Range) => {
    this.focalViewProperty.value = range.constrainValue(this.focalViewProperty.value);
  };

  public readonly focalCropProperty = new DerivedProperty(
    [this.focalViewProperty, this.focalStepProperty, this.sizeProperty],
    (span, step, size) => evenCrop(span / step, size),
  );
  public readonly apertureCropProperty = DerivedProperty.deriveAny(
    [this.apertureProperty, this.sizeProperty, this.swapProperty, ...Object.values(this.dimensions)],
    () => {
      if (this.swapProperty.value) {
        return evenCrop(APERTURE_VIEW_UM.comparison / this.pitchUm, this.size);
      }
      const { width, height, separation, radius, period } = this.dimensions;
      const kind = this.apertureProperty.value;
      const extent =
        kind === "circle" || kind === "annulus"
          ? 2 * radius.value
          : kind === "doubleSlit"
            ? 2 * width.value + separation.value
            : kind === "slit"
              ? width.value
              : kind === "grating"
                ? period.value
                : Math.max(width.value, height.value);
      return evenCrop(Math.max(APERTURE_VIEW_UM.min, APERTURE_VIEW_UM.margin * extent) / this.pitchUm, this.size);
    },
  );

  public fitPattern(): void {
    const { radius, width, height, innerRatio, period, thickness } = this.dimensions;
    const kind = this.apertureProperty.value;
    const fringeFrequency =
      kind === "circle"
        ? AIRY_FIFTH_ZERO_OVER_PI / (2 * radius.value)
        : kind === "annulus"
          ? APERTURE_FIT_FRINGE_COUNT / (2 * radius.value * (1 - innerRatio.value / 100))
          : kind === "grating"
            ? APERTURE_FIT_FRINGE_COUNT / period.value
            : kind === "cross" || kind === "letterF"
              ? APERTURE_FIT_FRINGE_COUNT / Math.min(thickness.value, width.value, height.value)
              : APERTURE_FIT_FRINGE_COUNT / (kind === "rectangle" ? Math.min(width.value, height.value) : width.value);
    const span =
      2 * focalPlaneCoordinate(fringeFrequency, this.wavelengthProperty.value, this.focalLengthProperty.value);
    this.focalViewProperty.value = this.focalViewRangeProperty.value.constrainValue(span);
  }

  public get object(): ComplexField {
    return this.fields.get("object", this.size);
  }
  public get spectrum(): ComplexField {
    return this.fields.get("spectrum", this.size);
  }
  public get objectA(): ComplexField {
    return this.fields.get("objectA", this.size);
  }
  public get objectB(): ComplexField {
    return this.fields.get("objectB", this.size);
  }
  public get reconstructionA(): ComplexField {
    return this.fields.get("reconstructionA", this.size);
  }
  public get reconstructionB(): ComplexField {
    return this.fields.get("reconstructionB", this.size);
  }
  private get spectrumA(): ComplexField {
    return this.fields.get("spectrumA", this.size);
  }
  private get spectrumB(): ComplexField {
    return this.fields.get("spectrumB", this.size);
  }
  private readonly fieldInputs = [
    this.apertureProperty,
    this.objectAProperty,
    this.objectBProperty,
    this.swapProperty,
    ...Object.values(this.dimensions),
  ];
  private readonly inputLink = Multilink.lazyMultilinkAny(this.fieldInputs, () => this.inputsChangedEmitter.emit());
  private readonly resettable = [
    ...this.fieldInputs,
    this.wavelengthProperty,
    this.focalLengthProperty,
    this.focalViewProperty,
    this.exposureProperty,
    this.logProperty,
    this.phaseProperty,
    this.tintProperty,
  ];

  private readonly fields = new GridFields(
    "object",
    "spectrum",
    "objectA",
    "objectB",
    "reconstructionA",
    "reconstructionB",
    "spectrumA",
    "spectrumB",
  );

  public constructor(preferences?: FourierOpticsPreferencesModel) {
    super(preferences);
    this.focalViewRangeProperty.lazyLink(this.constrainFocalView);
  }

  public recompute(ops: FourierOperations = this.cpu): void {
    if (this.swapProperty.value) {
      rasterizeAperture(apertureSpec(this.objectAProperty.value, PHASE_COMPARISON_DIMENSIONS), this.objectA);
      rasterizeAperture(apertureSpec(this.objectBProperty.value, PHASE_COMPARISON_DIMENSIONS), this.objectB);
      this.reconstructWithSwappedPhase(this.objectA, this.objectB, this.reconstructionA, this.reconstructionB, ops);
    } else {
      const d = this.dimensions;
      rasterizeAperture(
        apertureSpec(this.apertureProperty.value, {
          width: d.width.value / this.pitchUm,
          height: d.height.value / this.pitchUm,
          separation: d.separation.value / this.pitchUm,
          radius: d.radius.value / this.pitchUm,
          innerRatio: d.innerRatio.value,
          period: d.period.value / this.pitchUm,
          thickness: d.thickness.value / this.pitchUm,
        }),
        this.object,
      );
      ops.forward(this.object, this.spectrum);
    }
  }

  /** Each output keeps its input's Fourier magnitude and borrows the other input's phase. */
  public reconstructWithSwappedPhase(
    a: ComplexField,
    b: ComplexField,
    outA: ComplexField,
    outB: ComplexField,
    ops: FourierOperations = this.cpu,
  ): void {
    ops.forward(a, this.spectrumA);
    ops.forward(b, this.spectrumB);
    ops.swapPhase(this.spectrumA, this.spectrumB, outA);
    ops.swapPhase(this.spectrumB, this.spectrumA, outB);
  }

  public reset(): void {
    for (const property of this.resettable) {
      property.reset();
    }
  }

  public override dispose(): void {
    this.inputLink.dispose();
    this.apertureCropProperty.dispose();
    this.focalCropProperty.dispose();
    this.focalViewRangeProperty.dispose();
    this.focalStepProperty.dispose();
    for (const property of this.resettable) {
      property.dispose();
    }
    super.dispose();
  }
}
