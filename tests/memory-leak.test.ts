/**
 * Memory-leak regression suite (fleet standard).
 *
 * List every model/view object that links Properties, adds listeners, or owns child
 * nodes, with a factory that builds a fresh instance. The shared harness in
 * tests/helpers/memoryLeak.ts (template-owned) checks that each one is garbage
 * collected after dispose() and leaves no survivors across repeated cycles
 * (idempotentDispose: true also checks a second dispose()). Add sim-specific leak
 * tests below using forceGC().
 */

import { FourFOpticalSystemModel } from "../src/four-f-optical-system/model/FourFOpticalSystemModel.js";
import { FourierTransformModel } from "../src/fourier-transform/model/FourierTransformModel.js";
import { SpatialFilteringModel } from "../src/spatial-filtering/model/SpatialFilteringModel.js";
import { SpatialFrequenciesModel } from "../src/spatial-frequencies/model/SpatialFrequenciesModel.js";
import { describeDisposalLeaks } from "./helpers/memoryLeak.js";

describeDisposalLeaks([
  { name: "SpatialFrequenciesModel", create: () => new SpatialFrequenciesModel() },
  { name: "FourierTransformModel", create: () => new FourierTransformModel() },
  { name: "SpatialFilteringModel", create: () => new SpatialFilteringModel() },
  { name: "FourFOpticalSystemModel", create: () => new FourFOpticalSystemModel() },
]);
