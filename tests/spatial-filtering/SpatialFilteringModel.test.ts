import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFourierEngine } from "../../src/common/fourier/createFourierEngine.js";
import { ComplexField } from "../../src/common/model/ComplexField.js";
import { rasterizeImagingObject } from "../../src/common/model/imagingObjects.js";
import { FrameRecomputeScheduler } from "../../src/common/view/FrameRecomputeScheduler.js";
import { FILTER_PARAMETERS as F } from "../../src/FourierOpticsConstants.js";
import { SpatialFilteringModel } from "../../src/spatial-filtering/model/SpatialFilteringModel.js";

describe("SpatialFilteringModel", () => {
  let model: SpatialFilteringModel;
  beforeEach(() => {
    model = new SpatialFilteringModel();
  });
  afterEach(() => model.dispose());

  it("applies all four presets and switches to custom when the mask is edited", () => {
    expect(model.zoomProperty.value).toBeLessThanOrEqual(8);
    for (const [preset, object, mask] of [
      ["abbePorter", "mesh", "slit"],
      ["darkField", "phaseCells", "dcBlock"],
      ["phaseContrast", "phaseCells", "phaseDot"],
      ["edgeEnhancement", "letterF", "highPass"],
    ] as const) {
      model.zoomProperty.value = 32;
      model.presetProperty.value = preset;
      expect(model.objectProperty.value).toBe(object);
      expect(model.getMask().kind).toBe(mask);
      expect(model.zoomProperty.value).toBe(4);
    }
    expect(model.getMask()).toMatchObject({ kind: "highPass" });
    expect(model.radiusProperty.value).toBeCloseTo(F.edgeRadius);
    model.radiusProperty.value += 1;
    expect(model.presetProperty.value).toBe("custom");
  });

  it("rejects fine frequencies while retaining lower frequencies", () => {
    model.objectProperty.value = "grating";
    model.filterProperty.value = "lowPass";
    model.radiusProperty.value = 10;
    const mask = model.recompute();
    const centre = model.size / 2;
    const order = model.size / F.gratingPeriod;
    const passing = 2 * (centre * model.size + centre + order);
    const blocked = passing + 4 * order;
    expect(Math.abs(model.spectrum.data[blocked] ?? 0)).toBeGreaterThan(100);
    expect(mask[passing]).toBeCloseTo(1);
    expect(mask[blocked]).toBeCloseTo(0);
    const engine = createFourierEngine(model.size);
    const reconstructedSpectrum = new ComplexField(model.size);
    engine.forward(model.reconstructed, reconstructedSpectrum);
    engine.dispose();
    const power = (data: Float32Array, i: number) => (data[i] ?? 0) ** 2 + (data[i + 1] ?? 0) ** 2;
    const originalHighPower = power(model.spectrum.data, blocked);
    expect(power(reconstructedSpectrum.data, blocked) / originalHighPower).toBeCloseTo(0, 7);
    expect(power(reconstructedSpectrum.data, passing) / power(model.spectrum.data, passing)).toBeCloseTo(1, 6);
    expect(model.transmittedProperty.value).toBeLessThan(1);
  });

  it("rejects the orders for horizontal lines and retains the orders for vertical lines", () => {
    model.presetProperty.value = "abbePorter";
    const mask = model.recompute();
    const centre = model.size / 2;
    const order = model.size / F.gratingPeriod;
    const horizontalLines = 2 * ((centre + order) * model.size + centre);
    const verticalLines = 2 * (centre * model.size + centre + order);
    expect(model.spectrum.data[horizontalLines]).toBeGreaterThan(100);
    expect(model.spectrum.data[verticalLines]).toBeGreaterThan(100);
    expect(mask[horizontalLines]).toBeCloseTo(0);
    expect(mask[verticalLines]).toBeCloseTo(1);
    expect(model.reconstructed.get(centre, centre)[0]).toBeCloseTo(
      model.reconstructed.get(centre, centre + order)[0],
      6,
    );
  });

  it("removes the mean complex field and shows bright cells on a dark background", () => {
    model.presetProperty.value = "darkField";
    model.recompute();
    let real = 0;
    let imaginary = 0;
    const data = model.reconstructed.data;
    for (let i = 0; i < data.length; i += 2) {
      real += data[i] ?? 0;
      imaginary += data[i + 1] ?? 0;
    }
    expect(real / model.size ** 2).toBeCloseTo(0, 7);
    expect(imaginary / model.size ** 2).toBeCloseTo(0, 7);
    const background = intensityAt(model.reconstructed, 0, 0);
    expect(background).toBeLessThan(0.0001);
    const centre = model.size / 2;
    for (const cell of F.phaseCells) {
      expect(intensityAt(model.reconstructed, centre + cell.x, centre + cell.y)).toBeGreaterThan(0.5 * cell.phase ** 2);
    }
  });

  it("converts a weak phase shift into about twice as much intensity contrast", () => {
    model.presetProperty.value = "phaseContrast";
    const mask = model.recompute();
    const centre = model.size / 2;
    const dc = 2 * (centre * model.size + centre);
    expect(mask[dc]).toBeCloseTo(0);
    expect(mask[dc + 1]).toBeCloseTo(1);
    for (let i = 0; i < mask.length; i += 2) {
      if (i !== dc && (mask[i] !== 1 || mask[i + 1] !== 0)) {
        throw new Error(`Phase dot changed non-DC bin ${i / 2}`);
      }
    }
    const background = intensityAt(model.reconstructed, 0, 0);
    for (const cell of F.phaseCells) {
      const intensity = intensityAt(model.reconstructed, centre + cell.x, centre + cell.y);
      // The first-order prediction omits intensity terms of order φ².
      expect(Math.abs(intensity - background - 2 * cell.phase)).toBeLessThan(1.5 * cell.phase ** 2);
    }
    expect(model.transmittedProperty.value).toBeCloseTo(1, 6);
  });

  it("preserves cell phases, positions, and proportions when grid resolution doubles", () => {
    for (const size of [256, 512]) {
      const field = new ComplexField(size);
      rasterizeImagingObject("phaseCells", field, new ComplexField(size));
      const scale = size / 256;
      const centre = size / 2;
      for (const cell of F.phaseCells) {
        const x = centre + cell.x * scale;
        const y = centre + cell.y * scale;
        const [real, imaginary] = field.get(x + (cell.radiusX - 1) * scale, y);
        expect(Math.atan2(imaginary, real)).toBeCloseTo(cell.phase, 6);
        expect(field.get(x + (cell.radiusX + 1) * scale, y)).toEqual([1, 0]);
      }
    }
  });

  it("coalesces brush strokes by frame, erases bins, and resets all inputs and paint", () => {
    let updates = 0;
    const scheduler = new FrameRecomputeScheduler(model.inputsChangedEmitter, () => () => {
      updates++;
    });
    model.filterProperty.value = "painted";
    model.paint(20, 0, -20, 0);
    model.paint(0, 8);
    scheduler.step();
    scheduler.step();
    expect(updates).toBe(1);
    const centre = model.size / 2;
    const dc = 2 * (centre * model.size + centre);
    expect(model.recompute()[dc]).toBeCloseTo(0);
    model.eraseProperty.value = true;
    model.paint(0, 0);
    expect(model.recompute()[dc]).toBeCloseTo(1);
    model.logProperty.value = false;
    model.phaseProperty.value = true;
    model.brushRadiusProperty.value = 12;
    model.reset();
    expect(model.objectProperty.value).toBe("letterF");
    expect(model.filterProperty.value).toBe("open");
    expect(model.presetProperty.value).toBe("custom");
    expect(model.eraseProperty.value).toBe(false);
    expect(model.phaseProperty.value).toBe(false);
    expect(model.logProperty.value).toBe(true);
    expect(model.brushRadiusProperty.value).toBeCloseTo(F.brushRadius.default);
    model.filterProperty.value = "painted";
    expect(model.recompute()[dc + 32]).toBeCloseTo(1);
    expect(model.transmittedProperty.value).toBeCloseTo(1);
    scheduler.dispose();
  });
});

function intensityAt(field: ComplexField, x: number, y: number): number {
  const [real, imaginary] = field.get(x, y);
  return real * real + imaginary * imaginary;
}
