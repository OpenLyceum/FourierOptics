import { BooleanProperty, Multilink, NumberProperty } from "scenerystack/axon";
import { clamp, Range, Vector2 } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import type { FourierOperations } from "../../common/fourier/FourierEngine.js";
import { FourierScreenModel } from "../../common/fourier/FourierScreenModel.js";
import { GridFields } from "../../common/fourier/GridFields.js";
import { rasterizeAperture } from "../../common/model/apertures.js";
import type { ComplexField } from "../../common/model/ComplexField.js";
import { spatialFrequencyStep } from "../../common/model/opticalSystem.js";
import { EXPOSURE_DB, GRATING_PARAMETERS } from "../../FourierOpticsConstants.js";
import type { FourierOpticsPreferencesModel } from "../../preferences/FourierOpticsPreferencesModel.js";

const PARAMETERS = GRATING_PARAMETERS;
const RADIANS_PER_DEGREE = Math.PI / 180;
const rangeFor = ({ min, max }: { min: number; max: number }) => new Range(min, max);

class Grating {
  public readonly enabledProperty: BooleanProperty;
  public readonly periodProperty: NumberProperty;
  public readonly angleProperty: NumberProperty;
  public readonly contrastProperty: NumberProperty;
  public readonly phaseProperty = new NumberProperty(0, { range: rangeFor(PARAMETERS.angle) });
  public readonly inputs;

  public constructor(defaults: (typeof PARAMETERS.defaults)[number], enabled: boolean) {
    this.enabledProperty = new BooleanProperty(enabled);
    this.periodProperty = new NumberProperty(defaults.period, { range: rangeFor(PARAMETERS.period) });
    this.angleProperty = new NumberProperty(defaults.angle, { range: rangeFor(PARAMETERS.angle) });
    this.contrastProperty = new NumberProperty(defaults.contrast, { range: rangeFor(PARAMETERS.contrast) });
    this.inputs = [
      this.enabledProperty,
      this.periodProperty,
      this.angleProperty,
      this.contrastProperty,
      this.phaseProperty,
    ] as const;
  }

  public getSpec() {
    return {
      period: this.periodProperty.value,
      angle: this.angleProperty.value * RADIANS_PER_DEGREE,
      contrast: this.contrastProperty.value,
      phase: this.phaseProperty.value * RADIANS_PER_DEGREE,
    };
  }
}

export class SpatialFrequenciesModel extends FourierScreenModel implements TModel {
  public get frequencyStep(): number {
    return spatialFrequencyStep(this.size, 1);
  }
  public readonly gratings = PARAMETERS.defaults.map((defaults, index) => new Grating(defaults, index === 0));
  public readonly barsProperty = new BooleanProperty(false);
  public readonly selectedGratingProperty = new NumberProperty(0, {
    numberType: "Integer",
    range: new Range(0, this.gratings.length - 1),
  });
  public readonly exposureProperty = new NumberProperty(EXPOSURE_DB.default, { range: rangeFor(EXPOSURE_DB) });
  public get object(): ComplexField {
    return this.fields.get("object", this.size);
  }
  public get spectrum(): ComplexField {
    return this.fields.get("spectrum", this.size);
  }
  public readonly harmonics = Array.from({ length: PARAMETERS.displayedHarmonics }, (_, index) => {
    const order = index + 1;
    return { order, amplitude: order % 2 === 0 ? 0 : 1 / order };
  });

  private readonly fieldInputs = [this.barsProperty, ...this.gratings.flatMap((grating) => grating.inputs)];
  private readonly inputLink = Multilink.lazyMultilinkAny(this.fieldInputs, () => this.inputsChangedEmitter.emit());

  /** Frequency coordinates are cycles per object sample. Positive y points down. */
  public getFrequency(grating: Grating): Vector2 {
    const { period, angle } = grating.getSpec();
    return Vector2.createPolar(1 / period, angle);
  }

  public setFrequency(grating: Grating, frequency: Vector2): void {
    const magnitude = frequency.magnitude;
    grating.periodProperty.value = clamp(1 / magnitude, PARAMETERS.period.min, PARAMETERS.period.max);
    if (magnitude > 0) {
      grating.angleProperty.value = clamp(
        frequency.angle / RADIANS_PER_DEGREE,
        PARAMETERS.angle.min,
        PARAMETERS.angle.max,
      );
    }
  }

  private readonly fields = new GridFields("object", "spectrum");

  public constructor(preferences?: FourierOpticsPreferencesModel) {
    super(preferences);
  }

  public recompute(ops: FourierOperations = this.cpu): void {
    rasterizeAperture(
      this.barsProperty.value
        ? { kind: "grating", period: PARAMETERS.barPeriod, angle: 0 }
        : {
            kind: "sinusoids",
            bias: PARAMETERS.bias,
            gratings: this.gratings
              .filter((grating) => grating.enabledProperty.value)
              .map((grating) => grating.getSpec()),
          },
      this.object,
    );
    ops.forward(this.object, this.spectrum);
  }

  public reset(): void {
    for (const property of [...this.fieldInputs, this.selectedGratingProperty, this.exposureProperty]) {
      property.reset();
    }
  }

  public override dispose(): void {
    this.inputLink.dispose();
    for (const property of [...this.fieldInputs, this.selectedGratingProperty, this.exposureProperty]) {
      property.dispose();
    }
    super.dispose();
  }
}
