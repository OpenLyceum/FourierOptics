import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFourierEngine } from "../../src/common/fourier/createFourierEngine.js";
import { ComplexField } from "../../src/common/model/ComplexField.js";
import { angularSpectrumTransfer } from "../../src/common/model/opticalSystem.js";
import { OPTICAL_PARAMETERS as O, RESOLUTION_PERIODS } from "../../src/FourierOpticsConstants.js";
import { FourFOpticalSystemModel } from "../../src/four-f-optical-system/model/FourFOpticalSystemModel.js";

describe("FourFOpticalSystemModel", () => {
  let model: FourFOpticalSystemModel;
  beforeEach(() => {
    model = new FourFOpticalSystemModel();
  });
  afterEach(() => model.dispose());

  it("inverts a letter and maps each camera feature to twice its object size", () => {
    model.objectProperty.value = "letterF";
    model.f2Property.value = 200;
    model.irisProperty.value = 10;
    model.recompute();
    expect(model.magnificationProperty.value).toBeCloseTo(-2);
    const centre = model.size / 2;
    for (const [x, y] of [
      [-54, -45],
      [27, -25],
      [46, -62],
      [0, 45],
    ] as const) {
      const expected = model.object.get(centre + x, centre + y)[0];
      expect(model.image.get(centre - x, centre - y)[0]).toBeCloseTo(expected, 6);
      expect(model.camera.get(centre - 2 * x, centre - 2 * y)[0]).toBeCloseTo(expected, 6);
    }
    expect(model.camera.get(centre + 108, centre + 90)[0]).toBeCloseTo(1, 6);
    expect(model.camera.get(centre + 54, centre + 90)[0]).toBeCloseTo(0, 6);
  });

  it("loses the finest bar group below its cutoff and keeps its modulation above cutoff", () => {
    const finest = RESOLUTION_PERIODS[2];
    const frequency = 1 / (model.pitchUm * finest);
    // The target's bottom group maps to the upper part of the inverted camera image.
    const y = Math.floor(model.size / 6);
    const modulation = (period: number, row: number) => {
      let coefficient = 0;
      for (let x = 0; x < model.size; x++) {
        coefficient += model.camera.get(x, row)[0] ** 2 * Math.cos((2 * Math.PI * x) / period);
      }
      return Math.abs((2 * coefficient) / model.size);
    };
    model.irisProperty.value = 1.2;
    model.recompute();
    expect(model.coherentCutoffProperty.value).toBeLessThan(frequency);
    expect(modulation(finest, y)).toBeCloseTo(0, 6);
    expect(modulation(RESOLUTION_PERIODS[1], model.size / 2)).toBeGreaterThan(0.3);
    model.irisProperty.value = 2;
    model.recompute();
    expect(model.coherentCutoffProperty.value).toBeGreaterThan(frequency);
    expect(modulation(finest, y)).toBeGreaterThan(0.3);
  });

  it("doubles the cutoff for incoherent illumination and blocks all light at zero diameter", () => {
    model.illuminationProperty.value = "incoherent";
    expect(model.incoherentCutoffProperty.value).toBeCloseTo(2 * model.coherentCutoffProperty.value, 12);
    expect(model.periodProperty.value).toBeCloseTo(1 / model.incoherentCutoffProperty.value);
    model.recompute();
    expect(model.camera.totalPower()).toBeGreaterThan(0);
    model.irisProperty.value = 0;
    model.recompute();
    expect(model.camera.totalPower()).toBeCloseTo(0);
  });

  it("undoes camera defocus with reverse propagation", () => {
    model.f2Property.value = 150;
    model.recompute();
    const focused = model.image.copy();
    model.defocusProperty.value = 5;
    model.recompute();
    const engine = createFourierEngine(model.size);
    const recovered = new ComplexField(model.size);
    const reverse = angularSpectrumTransfer(
      model.size,
      model.pitchUm * Math.abs(model.magnificationProperty.value),
      model.wavelengthProperty.value,
      -model.defocusProperty.value,
    );
    engine.propagate(model.image, reverse, recovered);
    const largestError = recovered.data.reduce(
      (error, value, index) => Math.max(error, Math.abs(value - (focused.data[index] ?? 0))),
      0,
    );
    expect(largestError).toBeCloseTo(0, 5);
    engine.dispose();
  });

  it("restores default optical settings", () => {
    model.objectProperty.value = "mesh";
    model.wavelengthProperty.value = 650;
    model.f1Property.value = 200;
    model.f2Property.value = 150;
    model.irisProperty.value = 0;
    model.defocusProperty.value = 10;
    model.illuminationProperty.value = "incoherent";
    model.reset();
    expect(model.objectProperty.value).toBe("resolutionTarget");
    expect(model.illuminationProperty.value).toBe("coherent");
    expect(model.wavelengthProperty.value).toBeCloseTo(O.wavelengthNm.default);
    expect(model.f1Property.value).toBeCloseTo(O.f1Mm.default);
    expect(model.f2Property.value).toBeCloseTo(O.f2Mm.default);
    expect(model.irisProperty.value).toBeCloseTo(O.irisDiameterMm.default);
    expect(model.defocusProperty.value).toBeCloseTo(0);
    expect(model.magnificationProperty.value).toBeCloseTo(-1);
  });
});
