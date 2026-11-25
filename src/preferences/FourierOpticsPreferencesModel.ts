import { BooleanProperty, Property } from "scenerystack/axon";
import { NumberIO, StringIO, type Tandem } from "scenerystack/tandem";
import { initializeGpuContext } from "../common/fourier/gpu/GpuContext.js";
import { BACKEND_CHOICES, RESOLUTION_CHOICES } from "../FourierOpticsConstants.js";
import FourierOpticsNamespace from "../FourierOpticsNamespace.js";
import query from "./fourierOpticsQueryParameters.js";

export type BackendChoice = (typeof BACKEND_CHOICES)[number];
export type ResolutionChoice = (typeof RESOLUTION_CHOICES)[number] | 0;

export class FourierOpticsPreferencesModel {
  public readonly backendProperty: Property<BackendChoice>;
  public readonly resolutionProperty: Property<ResolutionChoice>;
  public readonly noticeDismissedProperty = new BooleanProperty(false);
  public readonly timing = query.timing;

  public constructor(tandem?: Tandem) {
    this.backendProperty = new Property(query.backend as BackendChoice, {
      validValues: BACKEND_CHOICES,
      phetioValueType: StringIO,
      ...(tandem && { tandem: tandem.createTandem("backendProperty") }),
    });
    this.resolutionProperty = new Property(Number(query.resolution) as ResolutionChoice, {
      validValues: [0, ...RESOLUTION_CHOICES],
      phetioValueType: NumberIO,
      ...(tandem && { tandem: tandem.createTandem("resolutionProperty") }),
    });
    this.backendProperty.lazyLink((backend) => {
      if (backend !== "cpu") {
        initializeGpuContext(false).catch(() => undefined);
      }
    });
  }
}

FourierOpticsNamespace.register("FourierOpticsPreferencesModel", FourierOpticsPreferencesModel);
