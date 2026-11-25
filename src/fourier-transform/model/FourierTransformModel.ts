import { BooleanProperty, DerivedProperty, Emitter, Multilink, NumberProperty, Property } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import { createFourierEngine } from "../../common/fourier/createFourierEngine.js";
import { type ApertureSpec, rasterizeAperture } from "../../common/model/apertures.js";
import { ComplexField } from "../../common/model/ComplexField.js";
import { rasterizeMask } from "../../common/model/masks.js";
import { focalPlaneCoordinate, spatialFrequencyStep } from "../../common/model/opticalSystem.js";
import {
  APERTURE_PARAMETERS,
  EXPOSURE_DB,
  OPTICAL_PARAMETERS,
  PHASE_COMPARISON_DIMENSIONS,
} from "../../FourierOpticsConstants.js";

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

export class FourierTransformModel implements TModel {
  public readonly size = O.gridSize.default;
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
  public readonly pitchProperty = numberProperty(O.pitchUm);
  public readonly exposureProperty = numberProperty(EXPOSURE_DB);
  public readonly logProperty = new BooleanProperty(true);
  public readonly phaseProperty = new BooleanProperty(false);
  public readonly tintProperty = new BooleanProperty(true);
  public readonly swapProperty = new BooleanProperty(false);
  public readonly focalStepProperty = new DerivedProperty(
    [this.pitchProperty, this.wavelengthProperty, this.focalLengthProperty],
    (pitch, wavelength, focalLength) =>
      focalPlaneCoordinate(spatialFrequencyStep(this.size, pitch), wavelength, focalLength),
  );

  public readonly inputsChangedEmitter = new Emitter();
  public readonly object = new ComplexField(this.size);
  public readonly spectrum = new ComplexField(this.size);
  public readonly objectA = new ComplexField(this.size);
  public readonly objectB = new ComplexField(this.size);
  public readonly reconstructionA = new ComplexField(this.size);
  public readonly reconstructionB = new ComplexField(this.size);
  private readonly spectrumA = new ComplexField(this.size);
  private readonly spectrumB = new ComplexField(this.size);
  private readonly hybrid = new ComplexField(this.size);
  private readonly openMask = rasterizeMask({ kind: "open" }, this.size);
  private readonly engine = createFourierEngine(this.size);
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
    this.pitchProperty,
    this.exposureProperty,
    this.logProperty,
    this.phaseProperty,
    this.tintProperty,
  ];

  public recompute(): void {
    if (this.swapProperty.value) {
      rasterizeAperture(apertureSpec(this.objectAProperty.value, PHASE_COMPARISON_DIMENSIONS), this.objectA);
      rasterizeAperture(apertureSpec(this.objectBProperty.value, PHASE_COMPARISON_DIMENSIONS), this.objectB);
      this.reconstructWithSwappedPhase(this.objectA, this.objectB, this.reconstructionA, this.reconstructionB);
    } else {
      const d = this.dimensions;
      rasterizeAperture(
        apertureSpec(this.apertureProperty.value, {
          width: d.width.value,
          height: d.height.value,
          separation: d.separation.value,
          radius: d.radius.value,
          innerRatio: d.innerRatio.value,
          period: d.period.value,
          thickness: d.thickness.value,
        }),
        this.object,
      );
      this.engine.forward(this.object, this.spectrum);
    }
  }

  /** Each output keeps its input's Fourier magnitude and borrows the other input's phase. */
  public reconstructWithSwappedPhase(a: ComplexField, b: ComplexField, outA: ComplexField, outB: ComplexField): void {
    this.engine.forward(a, this.spectrumA);
    this.engine.forward(b, this.spectrumB);
    this.reconstruct(this.spectrumA, this.spectrumB, outA);
    this.reconstruct(this.spectrumB, this.spectrumA, outB);
  }

  private reconstruct(amplitude: ComplexField, phase: ComplexField, output: ComplexField): void {
    const { data } = this.hybrid;
    for (let i = 0; i < data.length; i += 2) {
      const magnitude = Math.hypot(amplitude.data[i] ?? 0, amplitude.data[i + 1] ?? 0);
      const phaseReal = phase.data[i] ?? 0;
      const phaseImaginary = phase.data[i + 1] ?? 0;
      const phaseMagnitude = Math.hypot(phaseReal, phaseImaginary);
      // A phase donor with zero magnitude contributes the convention of phase zero.
      data[i] = phaseMagnitude > 0 ? magnitude * (phaseReal / phaseMagnitude) : magnitude;
      data[i + 1] = phaseMagnitude > 0 ? magnitude * (phaseImaginary / phaseMagnitude) : 0;
    }
    this.engine.filterAndInverse(this.hybrid, this.openMask, output);
  }

  public reset(): void {
    for (const property of this.resettable) {
      property.reset();
    }
  }

  public dispose(): void {
    this.inputLink.dispose();
    this.focalStepProperty.dispose();
    for (const property of this.resettable) {
      property.dispose();
    }
    this.inputsChangedEmitter.dispose();
    this.engine.dispose();
  }
}
