import { DerivedProperty, Multilink, NumberProperty, Property } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import type { FourierOperations } from "../../common/fourier/FourierEngine.js";
import { FourierScreenModel } from "../../common/fourier/FourierScreenModel.js";
import { GridFields } from "../../common/fourier/GridFields.js";
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
import {
  DEFOCUS_MM,
  OPTICAL_PARAMETERS as O,
  RESOLUTION_PERIODS,
  SPECTRUM_ZOOMS,
  type SpectrumZoom,
} from "../../FourierOpticsConstants.js";
import type { FourierOpticsPreferencesModel } from "../../preferences/FourierOpticsPreferencesModel.js";

export const SYSTEM_OBJECTS = ["letterF", "grating", "mesh", "resolutionTarget"] as const;
export const ILLUMINATION = ["coherent", "incoherent"] as const;

const numberProperty = ({ default: value, min, max }: { default: number; min: number; max: number }) =>
  new NumberProperty(value, { range: new Range(min, max) });

export class FourFOpticalSystemModel extends FourierScreenModel implements TModel {
  public readonly zoomProperty = new Property<SpectrumZoom>(2, { validValues: SPECTRUM_ZOOMS });
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
    [this.coherentCutoffProperty, this.sizeProperty],
    (cutoff, size) => cutoff / spatialFrequencyStep(size, this.pitchUm),
  );

  public get object(): ComplexField {
    return this.fields.get("object", this.size);
  }
  public get spectrum(): ComplexField {
    return this.fields.get("spectrum", this.size);
  }
  public get image(): ComplexField {
    return this.fields.get("image", this.size);
  }
  public get camera(): ComplexField {
    return this.fields.get("camera", this.size);
  }
  private get scratch(): ComplexField {
    return this.fields.get("scratch", this.size);
  }
  private intensity = new Float32Array(0);
  private lastRaster: { kind: (typeof SYSTEM_OBJECTS)[number]; field: ComplexField } | undefined;
  private cpuSpectrum: ComplexField | undefined;
  private lastPupil: { key: string; aperture: Float32Array; phased: Float32Array; transfer?: Float32Array } | undefined;
  private readonly resettable = [
    this.objectProperty,
    ...this.cutoffInputs,
    this.f2Property,
    this.defocusProperty,
    this.illuminationProperty,
  ];
  private readonly inputLink = Multilink.lazyMultilinkAny(this.resettable, () => this.inputsChangedEmitter.emit());

  private readonly fields = new GridFields("object", "spectrum", "image", "camera", "scratch");

  public constructor(preferences?: FourierOpticsPreferencesModel) {
    super(preferences);
  }

  public recompute(ops: FourierOperations = this.cpu): Float32Array {
    const kind = this.objectProperty.value;
    const field = this.object;
    if (kind !== this.lastRaster?.kind || field !== this.lastRaster.field) {
      if (kind === "resolutionTarget") {
        rasterizeResolutionTarget(field);
      } else {
        rasterizeImagingObject(kind, field, this.scratch);
      }
      this.lastRaster = { kind, field };
      this.cpuSpectrum = undefined;
    }
    if (this.engineInfoProperty.value.backend === "webgpu" || this.cpuSpectrum !== this.spectrum) {
      ops.forward(field, this.spectrum);
      this.cpuSpectrum = this.engineInfoProperty.value.backend === "cpu" ? this.spectrum : undefined;
    }

    const radius = this.pupilRadiusProperty.value;
    const scale = Math.abs(this.magnificationProperty.value);
    const distance = this.defocusProperty.value;
    const wavelength = this.wavelengthProperty.value;
    // f2 only changes the OTF when defocus changes the effective image-plane pitch.
    const key = [
      this.size,
      this.pitchUm,
      this.irisProperty.value,
      wavelength,
      this.f1Property.value,
      distance,
      distance === 0 ? 0 : scale,
    ].join("/");
    if (key !== this.lastPupil?.key) {
      const aperture = rasterizeMask({ kind: "lowPass", radius }, this.size);
      if (radius === 0) {
        aperture.fill(0);
      }
      if (distance === 0) {
        this.lastPupil = { key, aperture, phased: aperture };
      } else {
        const transfer = angularSpectrumTransfer(this.size, this.pitchUm * scale, wavelength, distance);
        const phased = new ComplexField(this.size, aperture);
        phased.multiplyByMask(transfer);
        this.lastPupil = { key, aperture, phased: phased.data, transfer };
      }
    }
    const { aperture, phased, transfer } = this.lastPupil;
    if (this.illuminationProperty.value === "coherent") {
      ops.filterAndInverse(this.spectrum, aperture, this.image, "4f");
      if (transfer) {
        ops.propagate(this.image, transfer, this.image);
      }
      ops.camera(this.image, this.camera, scale);
    } else {
      if (this.intensity.length !== this.size ** 2) {
        this.intensity = new Float32Array(this.size ** 2);
      }
      ops.imageThroughSystem(field.intensity(), phased, this.intensity, "4f", key);
      ops.camera(this.intensity, this.camera, scale);
    }
    return aperture;
  }

  public reset(): void {
    for (const property of this.resettable) {
      property.reset();
    }
    this.zoomProperty.reset();
  }

  public override dispose(): void {
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
    this.zoomProperty.dispose();
    super.dispose();
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
