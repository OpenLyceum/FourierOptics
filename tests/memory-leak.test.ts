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

import { StringProperty } from "scenerystack/axon";
import { ModelViewTransform2 } from "scenerystack/phetcommon";
import { afterAll, it } from "vitest";
import { CpuFourierEngine } from "../src/common/fourier/cpu/CpuFourierEngine.js";
import { ComplexField } from "../src/common/model/ComplexField.js";
import { rasterizeMask } from "../src/common/model/masks.js";
import { FieldImageNode } from "../src/common/view/FieldImageNode.js";
import { FrameRecomputeScheduler } from "../src/common/view/FrameRecomputeScheduler.js";
import { LensSchematicNode } from "../src/common/view/LensSchematicNode.js";
import Colors from "../src/FourierOpticsColors.js";
import { FourFOpticalSystemModel } from "../src/four-f-optical-system/model/FourFOpticalSystemModel.js";
import { FourierTransformModel } from "../src/fourier-transform/model/FourierTransformModel.js";
import { FourierTransformScreenSummaryContent } from "../src/fourier-transform/view/FourierTransformScreenSummaryContent.js";
import { StringManager } from "../src/i18n/StringManager.js";
import { SpatialFilteringModel } from "../src/spatial-filtering/model/SpatialFilteringModel.js";
import { SpatialFrequenciesModel } from "../src/spatial-frequencies/model/SpatialFrequenciesModel.js";
import { FrequencyHandleNode } from "../src/spatial-frequencies/view/FrequencyHandleNode.js";
import {
  createGratingReadout,
  SpatialFrequenciesScreenSummaryContent,
} from "../src/spatial-frequencies/view/SpatialFrequenciesScreenSummaryContent.js";
import { describeDisposalLeaks, expectNoListenerGrowth } from "./helpers/memoryLeak.js";

const spatialModel = new SpatialFrequenciesModel();
const transformModel = new FourierTransformModel();
const readoutProperty = new StringProperty("Period and orientation");
const grating = spatialModel.gratings[0];
if (!grating) {
  throw new Error("Expected a grating for disposal tests.");
}

afterAll(() => {
  spatialModel.dispose();
  transformModel.dispose();
  readoutProperty.dispose();
});

describeDisposalLeaks([
  {
    name: "CpuFourierEngine",
    create: () => {
      const size = 64;
      const engine = new CpuFourierEngine(size);
      const intensity = new Float32Array(size * size);
      engine.imageThroughSystem(intensity, rasterizeMask({ kind: "open" }, size), intensity);
      return engine;
    },
  },
  {
    name: "FieldImageNode",
    create: () => {
      const field = new ComplexField(64);
      field.fill(1);
      const image = new FieldImageNode(field, 100);
      image.updateScale();
      image.update("log", 50, 550);
      const context = document.createElement("canvas").getContext("2d");
      if (context) {
        image.paintCanvas(context);
      }
      return image;
    },
  },
  {
    name: "FrameRecomputeScheduler",
    create: () => new FrameRecomputeScheduler(spatialModel.inputsChangedEmitter, () => spatialModel.recompute()),
    keepAlive: () => [spatialModel],
  },
  {
    name: "FrequencyHandleNode",
    create: () =>
      new FrequencyHandleNode(
        spatialModel,
        grating,
        0,
        ModelViewTransform2.createIdentity(),
        readoutProperty,
        Colors.firstGratingColorProperty,
      ),
    keepAlive: () => [spatialModel, readoutProperty],
  },
  { name: "SpatialFrequenciesModel", create: () => new SpatialFrequenciesModel() },
  { name: "FourierTransformModel", create: () => new FourierTransformModel() },
  { name: "SpatialFilteringModel", create: () => new SpatialFilteringModel() },
  { name: "FourFOpticalSystemModel", create: () => new FourFOpticalSystemModel() },
]);

it("releases localized labels and model listeners for schematics and live summaries", async () => {
  const manager = StringManager.getInstance();
  const optics = manager.getTransformStrings();
  const nameProperty = manager.getSpatialStrings().grating1StringProperty;
  await expectNoListenerGrowth(
    [
      ...Object.values(optics),
      nameProperty,
      grating.periodProperty,
      grating.angleProperty,
      spatialModel.barsProperty,
      transformModel.apertureProperty,
      transformModel.focalStepProperty,
    ],
    () => {
      const schematic = new LensSchematicNode(optics.waveStringProperty, optics.apertureStringProperty, [
        {
          lens: optics.lensStringProperty,
          plane: optics.focalPlaneStringProperty,
          distance: optics.distanceStringProperty,
        },
      ]);
      schematic.disposeSubtree();
      const readout = createGratingReadout(spatialModel, grating, nameProperty);
      new SpatialFrequenciesScreenSummaryContent(spatialModel, [readout]).disposeSubtree();
      readout.dispose();
      new FourierTransformScreenSummaryContent(transformModel).disposeSubtree();
    },
  );
});
