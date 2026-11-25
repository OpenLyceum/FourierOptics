import { DerivedProperty, Emitter, Multilink, NumberProperty, Property } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import { createFourierEngine } from "../../common/fourier/createFourierEngine.js";
import { ComplexField } from "../../common/model/ComplexField.js";
import { rasterizeImagingObject } from "../../common/model/imagingObjects.js";
import { rasterizeMask } from "../../common/model/masks.js";
import {
  angularSpectrumTransfer,
  coherentCutoff,
  incoherentCutoff,
  magnification,
  spatialFrequencyStep,
} from "../../common/model/opticalSystem.js";
import { DEFOCUS_MM, OPTICAL_PARAMETERS as O, RESOLUTION_PERIODS } from "../../FourierOpticsConstants.js";

export const SYSTEM_OBJECTS = ["letterF", "grating", "mesh", "resolutionTarget"] as const;
export const ILLUMINATION = ["coherent", "incoherent"] as const;

const numberProperty = ({ default: value, min, max }: { default: number; min: number; max: number }) =>
  new NumberProperty(value, { range: new Range(min, max) });

export class FourFOpticalSystemModel implements TModel {
  public readonly size = O.gridSize.default;
  public readonly pitchUm = O.pitchUm.default;
  public readonly objectProperty = new Property<(typeof SYSTEM_OBJECTS)[number]>("resolutionTarget", {
    validValues: SYSTEM_OBJECTS,
  });
  public readonly wavelengthProperty = numberProperty(O.wavelengthNm);
  public readonly f1Property = numberProperty(O.f1Mm);
  public readonly f2Property = numberProperty(O.f2Mm);
  public readonly irisProperty = numberProperty(O.irisDiameterMm);
  public readonly defocusProperty = numberProperty(DEFOCUS_MM);
  public readonly illuminationProperty = new Property<(typeof ILLUMINATION)[number]>("coherent", {
    validValues: ILLUMINATION,
  });

  private readonly cutoffInputs = [this.irisProperty, this.wavelengthProperty, this.f1Property] as const;
  public readonly magnificationProperty = new DerivedProperty([this.f1Property, this.f2Property], magnification);
  public readonly coherentCutoffProperty = new DerivedProperty(this.cutoffInputs, coherentCutoff);
  public readonly incoherentCutoffProperty = new DerivedProperty(this.cutoffInputs, incoherentCutoff);
  public readonly periodProperty = new DerivedProperty(
    [this.coherentCutoffProperty, this.incoherentCutoffProperty, this.illuminationProperty],
    (coherent, incoherent, illumination) => 1 / (illumination === "coherent" ? coherent : incoherent),
  );
  public readonly pupilRadiusProperty = new DerivedProperty(
    [this.coherentCutoffProperty],
    (cutoff) => cutoff / spatialFrequencyStep(this.size, this.pitchUm),
  );

  public readonly inputsChangedEmitter = new Emitter();
  public readonly object = new ComplexField(this.size);
  public readonly spectrum = new ComplexField(this.size);
  public readonly image = new ComplexField(this.size);
  public readonly camera = new ComplexField(this.size);
  private readonly scratch = new ComplexField(this.size);
  private readonly engine = createFourierEngine(this.size);
  private readonly intensity = new Float32Array(this.size * this.size);
  private lastObject: typeof this.objectProperty.value | undefined;
  private readonly resettable = [
    this.objectProperty,
    ...this.cutoffInputs,
    this.f2Property,
    this.defocusProperty,
    this.illuminationProperty,
  ];
  private readonly inputLink = Multilink.lazyMultilinkAny(this.resettable, () => this.inputsChangedEmitter.emit());

  public recompute(): Float32Array {
    const kind = this.objectProperty.value;
    if (kind !== this.lastObject) {
      if (kind === "resolutionTarget") {
        rasterizeResolutionTarget(this.object);
      } else {
        rasterizeImagingObject(kind, this.object, this.scratch);
      }
      this.engine.forward(this.object, this.spectrum);
      this.lastObject = kind;
    }

    const radius = this.pupilRadiusProperty.value;
    const pupil = rasterizeMask({ kind: "lowPass", radius }, this.size);
    // A fully closed iris passes no light, including at zero frequency.
    if (radius === 0) {
      pupil.fill(0);
    }
    const scale = Math.abs(this.magnificationProperty.value);
    const distance = this.defocusProperty.value;
    const transfer =
      distance === 0
        ? undefined
        : angularSpectrumTransfer(this.size, this.pitchUm * scale, this.wavelengthProperty.value, distance);

    if (this.illuminationProperty.value === "coherent") {
      this.engine.filterAndInverse(this.spectrum, pupil, this.image, "4f");
      if (transfer) {
        this.engine.propagate(this.image, transfer, this.image);
      }
      resampleCamera(this.image.intensity(), this.camera, scale);
    } else {
      // Defocus phases the amplitude pupil before its autocorrelation forms the OTF.
      const phasedPupil = transfer ? new ComplexField(this.size, pupil) : undefined;
      phasedPupil?.multiplyByMask(transfer ?? pupil);
      this.engine.imageThroughSystem(this.object.intensity(), phasedPupil?.data ?? pupil, this.intensity, "4f");
      resampleCamera(this.intensity, this.camera, scale);
    }
    return pupil;
  }

  public reset(): void {
    for (const property of this.resettable) {
      property.reset();
    }
  }

  public dispose(): void {
    this.inputLink.dispose();
    for (const property of [
      this.pupilRadiusProperty,
      this.periodProperty,
      this.coherentCutoffProperty,
      this.incoherentCutoffProperty,
      this.magnificationProperty,
      ...this.resettable,
    ]) {
      property.dispose();
    }
    this.inputsChangedEmitter.dispose();
    this.engine.dispose();
  }
}

/** Equal mean across rows, with integer Fourier orders along x and smooth vertical windows. */
function rasterizeResolutionTarget(field: ComplexField): void {
  const size = field.size;
  const height = size / RESOLUTION_PERIODS.length;
  for (let y = 0; y < size; y++) {
    const group = Math.floor(y / height);
    const period = RESOLUTION_PERIODS[group] ?? RESOLUTION_PERIODS[0];
    const envelope = Math.sin(Math.PI * (y / height - group)) ** 2;
    for (let x = 0; x < size; x++) {
      field.set(x, y, 0.5 * (1 + envelope * Math.cos((2 * Math.PI * x) / period)));
    }
  }
}

/** Sample camera intensity on a fixed physical field of view, centered on the optical axis. */
function resampleCamera(intensity: Float32Array, camera: ComplexField, scale: number): void {
  const { size } = camera;
  const centre = size / 2;
  const at = (x: number, y: number) =>
    x >= 0 && x < size && y >= 0 && y < size ? Math.max(0, intensity[y * size + x] ?? 0) : 0;
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
      camera.set(x, y, Math.sqrt((1 - dy) * top + dy * bottom));
    }
  }
}
