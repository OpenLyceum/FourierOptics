import { Vector2 } from "scenerystack/dot";
import { describe, expect, it } from "vitest";
import { FrameRecomputeScheduler } from "../../src/common/view/FrameRecomputeScheduler.js";
import { SpatialFrequenciesModel } from "../../src/spatial-frequencies/model/SpatialFrequenciesModel.js";

describe("SpatialFrequenciesModel", () => {
  it("starts with one grating and resets all controls", () => {
    const model = new SpatialFrequenciesModel();
    const [first, second] = model.gratings;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!(first && second)) {
      throw new Error("Expected a three-grating model.");
    }
    expect(model.gratings.map((grating) => grating.enabledProperty.value)).toEqual([true, false, false]);
    expect(first.periodProperty.value).toBe(8);
    first.enabledProperty.value = false;
    second.enabledProperty.value = true;
    first.periodProperty.value = 17;
    first.angleProperty.value = 105;
    first.contrastProperty.value = 0.9;
    first.phaseProperty.value = 32;
    model.barsProperty.value = true;
    model.selectedGratingProperty.value = 2;
    model.exposureProperty.value = 80;
    model.reset();
    expect(first.inputs.map((property) => property.value)).toEqual([true, 8, 0, 0.65, 0]);
    expect(second.enabledProperty.value).toBe(false);
    expect(model.barsProperty.value).toBe(false);
    expect(model.selectedGratingProperty.value).toBe(0);
    expect(model.exposureProperty.value).toBe(50);
    model.dispose();
  });

  it("round-trips a frequency vector and places the conjugate peaks at the corresponding bins", () => {
    const model = new SpatialFrequenciesModel();
    const grating = model.gratings[0];
    if (!grating) {
      throw new Error("Expected a grating.");
    }
    const vector = new Vector2(12 * model.frequencyStep, -5 * model.frequencyStep);
    model.setFrequency(grating, vector);
    const frequency = model.getFrequency(grating);
    expect(frequency.x).toBeCloseTo(vector.x, 9);
    expect(frequency.y).toBeCloseTo(vector.y, 9);
    expect(grating.periodProperty.value).toBeCloseTo(model.size / 13);
    model.recompute();
    const center = model.size / 2;
    const [positive] = model.spectrum.get(center + 12, center - 5);
    const [negative] = model.spectrum.get(center - 12, center + 5);
    const [dc] = model.spectrum.get(center, center);
    expect(positive).toBeCloseTo(negative, 5);
    expect(positive / dc).toBeCloseTo(grating.contrastProperty.value / 2, 5);
    model.setFrequency(grating, Vector2.ZERO);
    expect(grating.periodProperty.value).toBe(grating.periodProperty.range.max);
    expect(grating.angleProperty.value).toBeLessThan(0);
    model.dispose();
  });

  it("describes odd square-wave harmonics and coalesces edits between frames", () => {
    const model = new SpatialFrequenciesModel();
    let recomputes = 0;
    const scheduler = new FrameRecomputeScheduler(model.inputsChangedEmitter, () => {
      model.recompute();
      recomputes++;
    });
    scheduler.step();
    scheduler.step();
    expect(recomputes).toBe(1);
    model.barsProperty.value = true;
    model.gratings[0]?.periodProperty.set(12);
    model.gratings[0]?.angleProperty.set(45);
    expect(recomputes).toBe(1);
    scheduler.step();
    scheduler.step();
    expect(recomputes).toBe(2);
    expect(model.harmonics.map(({ amplitude }) => amplitude)).toEqual([1, 0, 1 / 3, 0, 1 / 5, 0, 1 / 7]);
    const center = model.size / 2;
    const fundamentalBin = model.size / 32;
    const magnitude = (order: number) => Math.hypot(...model.spectrum.get(center + fundamentalBin * order, center));
    expect(magnitude(2) / magnitude(1)).toBeLessThan(1e-6);
    // Subpixel averaging attenuates the sampled third harmonic slightly.
    expect(Math.abs(magnitude(3) / magnitude(1) - 1 / 3)).toBeLessThan(0.01);
    scheduler.dispose();
    expect(model.inputsChangedEmitter.getListenerCount()).toBe(0);
    model.dispose();
  });
});
