import { expect, it } from "vitest";
import { createFourierEngine } from "../../../src/common/fourier/createFourierEngine.js";
import { FourFOpticalSystemModel } from "../../../src/four-f-optical-system/model/FourFOpticalSystemModel.js";
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
  model.recompute();
  const amplitude = model.spectrum.get(128, 128)[0];
  const radius = model.dimensions.radius.value;
  preferences.resolutionProperty.value = 1024;
  expect(model.engineInfoProperty.value.size).toBe(512);
  expect(model.object.size).toBe(512);
  expect(model.object).not.toBe(initialField);
  expect(model.focalStepProperty.value).toBeCloseTo(initialStep / 2, 8);
  model.recompute();
  expect(model.spectrum.get(256, 256)[0]).toBeCloseTo(amplitude, 4);
  expect(model.dimensions.radius.value).toBeCloseTo(radius);
  expect(model.apertureCropProperty.value * model.pitchUm).toBeCloseTo(1180);
  expect(model.focalCropProperty.value * model.focalStepProperty.value).toBeCloseTo(1.65, 1);
  model.dispose();
});

it("uses the CPU default grid across screens after an automatic performance fallback", () => {
  const preferences = new FourierOpticsPreferencesModel();
  preferences.resolutionProperty.value = 512;
  const transform = new FourierTransformModel(preferences);
  const system = new FourFOpticalSystemModel(preferences);
  preferences.gpuTooSlowProperty.value = true;
  for (const model of [transform, system]) {
    expect(model.engineInfoProperty.value).toEqual({ backend: "cpu", size: 256, degraded: true, gpuTooSlow: true });
    model.dispose();
  }
});
