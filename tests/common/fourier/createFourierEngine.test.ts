import { expect, it } from "vitest";
import { createFourierEngine } from "../../../src/common/fourier/createFourierEngine.js";
import { FourierTransformModel } from "../../../src/fourier-transform/model/FourierTransformModel.js";
import { FourierOpticsPreferencesModel } from "../../../src/preferences/FourierOpticsPreferencesModel.js";

it("reports the fallback grid and clamps requested CPU resolution", () => {
  const fallback = createFourierEngine({ backend: "gpu", resolution: 0 });
  const clamped = createFourierEngine({ backend: "cpu", resolution: 1024 });
  expect(fallback.info).toEqual({ backend: "cpu", size: 256, degraded: true });
  expect(clamped.info).toEqual({ backend: "cpu", size: 512, degraded: false });
  expect(clamped.engine.size).toBe(clamped.info.size);
  fallback.engine.dispose();
  clamped.engine.dispose();
});

it("rebuilds a live screen's fields and scale at the effective resolution", () => {
  const preferences = new FourierOpticsPreferencesModel();
  preferences.backendProperty.value = "cpu";
  const model = new FourierTransformModel(preferences);
  const initialField = model.object;
  const initialStep = model.focalStepProperty.value;
  preferences.resolutionProperty.value = 1024;
  expect(model.engineInfoProperty.value.size).toBe(512);
  expect(model.object.size).toBe(512);
  expect(model.object).not.toBe(initialField);
  expect(model.focalStepProperty.value).toBeCloseTo(initialStep / 2, 8);
  model.recompute();
  expect(model.spectrum.get(256, 256)[0]).toBeGreaterThan(0);
  model.dispose();
});
