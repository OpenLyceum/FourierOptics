import { describe, expect, it } from "vitest";
import { ComplexField } from "../../src/common/model/ComplexField.js";
import { APERTURE_KINDS, FourierTransformModel } from "../../src/fourier-transform/model/FourierTransformModel.js";

describe("FourierTransformModel", () => {
  it("uses x_f = λ f ν and resets the optics, choices, and display settings", () => {
    const model = new FourierTransformModel();
    expect(model.apertureProperty.value).toBe("circle");
    expect(model.focalStepProperty.value).toBeCloseTo((0.55 * 100) / (256 * 10), 10);
    model.wavelengthProperty.value = 650;
    model.focalLengthProperty.value = 200;
    expect(model.focalStepProperty.value).toBeCloseTo((0.65 * 200) / (256 * 10), 10);
    model.apertureProperty.value = "annulus";
    model.objectAProperty.value = "slit";
    model.objectBProperty.value = "circle";
    model.dimensions.radius.value = 50;
    model.exposureProperty.value = 80;
    model.logProperty.value = false;
    model.phaseProperty.value = true;
    model.tintProperty.value = false;
    model.swapProperty.value = true;
    model.reset();
    expect(model.apertureProperty.value).toBe("circle");
    expect(model.objectAProperty.value).toBe("letterF");
    expect(model.objectBProperty.value).toBe("cross");
    expect(model.dimensions.radius.value).toBeCloseTo(180);
    expect(model.exposureProperty.value).toBe(50);
    expect(model.focalStepProperty.value).toBeCloseTo((0.55 * 100) / (256 * 10), 10);
    expect([
      model.logProperty.value,
      model.phaseProperty.value,
      model.tintProperty.value,
      model.swapProperty.value,
    ]).toEqual([true, false, true, false]);
    model.dispose();
  });

  it("produces a diffraction pattern for every aperture and spreads it when an opening narrows", () => {
    const model = new FourierTransformModel();
    const center = model.size / 2;
    for (const kind of APERTURE_KINDS) {
      model.apertureProperty.value = kind;
      model.recompute();
      expect(model.spectrum.get(center, center)[0]).toBeGreaterThan(0);
    }
    model.apertureProperty.value = "slit";
    const relativeIntensityAtBin = (width: number) => {
      model.dimensions.width.value = width;
      model.recompute();
      return (Math.hypot(...model.spectrum.get(center + 8, center)) / model.spectrum.get(center, center)[0]) ** 2;
    };
    expect(relativeIntensityAtBin(60)).toBeGreaterThan(relativeIntensityAtBin(300));
    model.dispose();
  });

  it("fits the fifth Airy minimum and limits the span to the optical grid", () => {
    const model = new FourierTransformModel();
    model.fitPattern();
    expect(model.focalViewProperty.value).toBeCloseTo((2 * 5.24 * 0.55 * 100) / 360, 5);
    model.focalLengthProperty.value = 200;
    model.fitPattern();
    expect(model.focalViewProperty.value).toBeCloseTo((2 * 5.24 * 0.55 * 200) / 360, 5);
    model.dimensions.radius.value = 20;
    model.fitPattern();
    expect(model.focalViewProperty.value).toBeCloseTo((0.55 * 200) / 10, 5);
    expect(model.focalCropProperty.value).toBe(model.size);
    model.dispose();
  });

  it("reconstructs translated impulses with exchanged Fourier phases", () => {
    const model = new FourierTransformModel();
    const a = new ComplexField(model.size);
    const b = new ComplexField(model.size);
    const outA = new ComplexField(model.size);
    const outB = new ComplexField(model.size);
    const c = model.size / 2;
    a.set(c - 7, c + 1, 2);
    b.set(c + 5, c - 3, 3);
    model.reconstructWithSwappedPhase(a, b, outA, outB);
    expect(outA.get(c + 5, c - 3)[0]).toBeCloseTo(2, 6);
    expect(outB.get(c - 7, c + 1)[0]).toBeCloseTo(3, 6);
    expect(outA.get(c - 7, c + 1)[0]).toBeCloseTo(0, 6);
    expect(outB.get(c + 5, c - 3)[0]).toBeCloseTo(0, 6);
    expect(outA.totalPower()).toBeCloseTo(4, 5);
    expect(outB.totalPower()).toBeCloseTo(9, 5);
    model.dispose();
  });

  it("uses zero phase in bins where the donor has zero amplitude", () => {
    const model = new FourierTransformModel();
    const translatedImpulse = new ComplexField(model.size);
    const zero = new ComplexField(model.size);
    const outA = new ComplexField(model.size);
    const outB = new ComplexField(model.size);
    const c = model.size / 2;
    translatedImpulse.set(c - 2, c + 6, 2);
    model.reconstructWithSwappedPhase(translatedImpulse, zero, outA, outB);
    expect(outA.get(c, c)[0]).toBeCloseTo(2, 9);
    expect(outA.get(c, c)[1]).toBeCloseTo(0, 9);
    expect(outA.totalPower()).toBeCloseTo(4, 9);
    expect(outB.totalPower()).toBe(0);
    model.dispose();
  });
});
