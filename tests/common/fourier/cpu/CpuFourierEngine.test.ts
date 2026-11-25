import { describe, expect, it } from "vitest";
import { CpuFourierEngine } from "../../../../src/common/fourier/cpu/CpuFourierEngine.js";
import type { FourierEngine } from "../../../../src/common/fourier/FourierEngine.js";
import { rasterizeAperture } from "../../../../src/common/model/apertures.js";
import { ComplexField } from "../../../../src/common/model/ComplexField.js";
import { rasterizeMask } from "../../../../src/common/model/masks.js";
import {
  angularSpectrumTransfer,
  coherentCutoff,
  focalPlaneCoordinate,
  incoherentCutoff,
  magnification,
  smallestResolvedPeriod,
  spatialFrequencyStep,
} from "../../../../src/common/model/opticalSystem.js";
import { OPTICAL_PARAMETERS } from "../../../../src/FourierOpticsConstants.js";
import { airyAmplitude, rectangularApertureAmplitude, sinc } from "../../../helpers/analytic.js";

function planeWave(size: number, kx: number, ky: number): ComplexField {
  const field = new ComplexField(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const angle = (2 * Math.PI * (kx * (x - size / 2) + ky * (y - size / 2))) / size;
      field.set(x, y, Math.cos(angle), Math.sin(angle));
    }
  }
  return field;
}

function peakIndices(values: Float32Array, threshold: number): number[] {
  const indices: number[] = [];
  values.forEach((value, i) => {
    if (value > threshold) {
      indices.push(i);
    }
  });
  return indices;
}

describe("centred CPU Fourier optics", () => {
  it("shifts a tilted plane wave to a single bin with the expected sign", () => {
    const size = 64;
    const engine: FourierEngine = new CpuFourierEngine(size);
    const field = planeWave(size, 7, -3);
    expect(engine.submit((ops) => ops.forward(field, field))).toBeUndefined();
    expect(engine.backend).toBe("cpu");
    expect(peakIndices(field.amplitude(), 1e-3)).toEqual([(32 - 3) * size + 32 + 7]);
    const [real, imaginary] = field.get(39, 29);
    expect(real / size ** 2).toBeCloseTo(1, 7);
    expect(imaginary / size ** 2).toBeCloseTo(0, 7);
  });

  it("matches sampled rectangular diffraction intensity to sinc² along both axes", () => {
    const size = 512;
    const field = new ComplexField(size);
    rasterizeAperture({ kind: "rectangle", width: 64, height: 40 }, field);
    new CpuFourierEngine(size).forward(field, field);
    const intensity = field.intensity();
    const centre = size / 2;
    const dc = intensity[centre * size + centre]!;
    expect(sinc(0)).toBe(1);
    for (let ky = -12; ky <= 12; ky += 3) {
      for (let kx = -18; kx <= 18; kx += 2) {
        const expected = rectangularApertureAmplitude(64, 40, kx / size, ky / size) ** 2;
        const measured = intensity[(centre + ky) * size + centre + kx]! / dc;
        expect(Math.abs(measured - expected)).toBeLessThan(8e-4);
      }
    }
  });

  it("finds the circle's first Airy dark ring within one Fourier-plane bin", () => {
    const size = 256;
    const diameter = 39;
    const pitch = OPTICAL_PARAMETERS.pitchUm;
    const wavelength = OPTICAL_PARAMETERS.wavelengthNm.default;
    const focalLength = OPTICAL_PARAMETERS.f1Mm.default;
    const field = new ComplexField(size);
    rasterizeAperture({ kind: "circle", radius: diameter / 2 }, field);
    new CpuFourierEngine(size).forward(field, field);
    const intensity = field.intensity();
    const dcIndex = (size / 2) * (size + 1);
    let ringBin = 1;
    while (ringBin + 1 < size / 2 && intensity[dcIndex + ringBin]! > intensity[dcIndex + ringBin + 1]!) {
      ringBin++;
    }
    const binWidthMm = focalPlaneCoordinate(spatialFrequencyStep(size, pitch), wavelength, focalLength);
    const predictedMm = (1.22 * (wavelength / 1000) * focalLength) / (diameter * pitch);
    expect(Math.abs(ringBin * binWidthMm - predictedMm)).toBeLessThan(binWidthMm);
    expect(intensity[dcIndex + ringBin]! / intensity[dcIndex]!).toBeLessThan(1e-4);
    expect(airyAmplitude(diameter, 0)).toBe(1);
    expect(Math.abs(airyAmplitude(diameter, 1.21967 / diameter))).toBeLessThan(1e-5);
    expect(Math.sqrt(intensity[dcIndex + 7]! / intensity[dcIndex]!)).toBeCloseTo(airyAmplitude(diameter, 7 / size), 3);
  });

  it("gives exactly DC and ±k for one sampled sinusoid", () => {
    const size = 64;
    const field = new ComplexField(size);
    rasterizeAperture(
      {
        kind: "sinusoids",
        bias: 0.5,
        gratings: [{ period: size / 4, angle: 0, contrast: 0.6, phase: Math.PI / 3 }],
      },
      field,
    );
    new CpuFourierEngine(size).forward(field, field);
    const dc = (size / 2) * (size + 1);
    const amplitude = field.amplitude();
    expect(peakIndices(amplitude, 1e-3)).toEqual([dc - 4, dc, dc + 4]);
    expect(amplitude[dc]! / size ** 2).toBeCloseTo(0.5, 7);
    expect(amplitude[dc + 4]! / amplitude[dc]!).toBeCloseTo(0.3, 7);
    expect(field.phase()[dc + 4]).toBeCloseTo(Math.PI / 3, 6);
  });

  it("retains only odd square-wave harmonics below the cutoff with amplitudes proportional to 1/n", () => {
    const size = 256;
    const field = new ComplexField(size);
    const engine = new CpuFourierEngine(size);
    const period = size / 4;
    rasterizeAperture({ kind: "grating", period, angle: 0 }, field);
    engine.forward(field, field);
    const dc = (size / 2) * (size + 1);
    expect(field.amplitude()[dc + 28]! / size ** 2).toBeGreaterThan(0.04);
    engine.filterAndInverse(field, rasterizeMask({ kind: "lowPass", radius: 21 }, size), field);
    engine.forward(field, field);
    const amplitude = field.amplitude();
    expect(peakIndices(amplitude, 0.005)).toEqual([-20, -12, -4, 0, 4, 12, 20].map((bin) => dc + bin));
    expect(amplitude[dc + 4]! / size ** 2).toBeCloseTo(1 / Math.PI, 3);
    for (const harmonic of [3, 5]) {
      const ratio = amplitude[dc + 4 * harmonic]! / amplitude[dc + 4]!;
      expect(Math.abs(ratio * harmonic - 1)).toBeLessThan(0.03);
      // The two half-covered edge samples give a trapezoidal Fourier sum.
      expect(ratio).toBeCloseTo(Math.tan(Math.PI / period) / Math.tan((harmonic * Math.PI) / period), 6);
    }
  });

  it("returns the periodically inverted field through 4f and the original through ideal filtering", () => {
    const size = 64;
    const engine = new CpuFourierEngine(size);
    const field = new ComplexField(size);
    rasterizeAperture({ kind: "letterF", width: 17, height: 21, thickness: 3 }, field);
    field.set(0, 5, 0.25, -0.5);
    const spectrum = new ComplexField(size);
    const image = new ComplexField(size);
    engine.forward(field, spectrum);
    const pupil = rasterizeMask({ kind: "open" }, size);
    engine.filterAndInverse(spectrum, pupil, image, "4f");
    let error = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const [real, imaginary] = image.get(x, y);
        const [expectedReal, expectedImaginary] = field.get((size - x) % size, (size - y) % size);
        error += (real - expectedReal) ** 2 + (imaginary - expectedImaginary) ** 2;
      }
    }
    expect(Math.sqrt(error / field.totalPower())).toBeLessThan(1e-6);
    engine.filterAndInverse(spectrum, pupil, image);
    image.data.forEach((value, i) => {
      expect(value).toBeCloseTo(field.data[i]!, 6);
    });
  });

  it("converts a weak phase disk to approximately 2φ intensity contrast with a DC phase dot", () => {
    const size = 64;
    const engine = new CpuFourierEngine(size);
    const field = new ComplexField(size);
    const phase = 0.01;
    rasterizeAperture({ kind: "phaseDisk", radius: 10, phase }, field);
    const dc = (size / 2) * (size + 1);
    expect(field.intensity()[dc]).toBeCloseTo(1, 7);
    engine.forward(field, field);
    engine.filterAndInverse(field, rasterizeMask({ kind: "phaseDot", radius: 0 }, size), field);
    const intensity = field.intensity();
    expect(Math.abs(intensity[dc]! - intensity[0]! - 2 * phase)).toBeLessThan(phase * phase);
  });

  it("enhances edges in dark field and removes the mean field", () => {
    const size = 128;
    const engine = new CpuFourierEngine(size);
    const field = new ComplexField(size);
    rasterizeAperture({ kind: "phaseDisk", radius: 19, phase: 0.1 }, field);
    engine.forward(field, field);
    engine.filterAndInverse(field, rasterizeMask({ kind: "dcBlock", radius: 3 }, size), field);
    const intensity = field.intensity();
    const dc = (size / 2) * (size + 1);
    expect(intensity[dc + 18]!).toBeGreaterThan(4 * Math.max(intensity[dc]!, intensity[0]!));
    engine.forward(field, field);
    const [meanReal, meanImaginary] = field.get(size / 2, size / 2);
    expect(Math.hypot(meanReal, meanImaginary) / size ** 2).toBeLessThan(1e-7);
  });
});

describe("physical scaling and propagation", () => {
  it("converts display units and computes object-side cutoffs and magnification", () => {
    expect(spatialFrequencyStep(256, 10)).toBeCloseTo(1 / 2560, 10);
    expect(focalPlaneCoordinate(0.02, 500, 100)).toBeCloseTo(1, 10);
    expect(coherentCutoff(2, 500, 100)).toBeCloseTo(0.02, 10);
    expect(incoherentCutoff(2, 500, 100)).toBeCloseTo(0.04, 10);
    expect(smallestResolvedPeriod(2, 500, 100)).toBeCloseTo(50, 10);
    expect(magnification(100, 150)).toBeCloseTo(-1.5, 10);
  });

  it("uses the forward propagation phase and reverses propagation on propagating bins", () => {
    const size = 64;
    const engine = new CpuFourierEngine(size);
    const input = planeWave(size, 7, -3);
    input.set(0, 0, 0.8, -1.3);
    const distanceMm = 3.125;
    const wavelengthNm = 525;
    const pitchUm = 4;
    const forward = angularSpectrumTransfer(size, pitchUm, wavelengthNm, distanceMm);
    const reverse = angularSpectrumTransfer(size, pitchUm, wavelengthNm, -distanceMm);
    const expectedPhase = 2 * Math.PI * 3125 * Math.sqrt(1 / 0.525 ** 2 - (7 ** 2 + 3 ** 2) / 256 ** 2);
    const bin = 2 * (29 * size + 39);
    expect(forward[bin]).toBeCloseTo(Math.cos(expectedPhase), 7);
    expect(forward[bin + 1]).toBeCloseTo(Math.sin(expectedPhase), 7);
    const out = new ComplexField(size);
    engine.propagate(input, forward, out);
    engine.propagate(out, reverse, out);
    let error = 0;
    out.data.forEach((value, i) => {
      error += (value - input.data[i]!) ** 2;
    });
    expect(Math.sqrt(error / input.totalPower())).toBeLessThan(1e-6);
  });

  it("zeros evanescent components for either direction", () => {
    const size = 64;
    const engine = new CpuFourierEngine(size);
    const input = planeWave(size, 20, 0);
    const out = new ComplexField(size);
    for (const distance of [-1, 1]) {
      engine.propagate(input, angularSpectrumTransfer(size, 0.1, 500, distance), out);
      expect(out.totalPower() / input.totalPower()).toBeLessThan(1e-12);
    }
  });
});

describe("incoherent imaging", () => {
  it("keeps opposite pupil edges from wrapping into a short autocorrelation lag", () => {
    const size = 8;
    const engine = new CpuFourierEngine(size);
    const pupil = new ComplexField(size);
    pupil.set(0, 4, 1);
    pupil.set(size - 1, 4, 1);
    const image = Float32Array.from({ length: size ** 2 }, (_, i) => 1 + Math.cos((2 * Math.PI * (i % size)) / size));
    engine.imageThroughSystem(image, pupil.data, image, "ideal");
    for (const value of image) {
      expect(value).toBeCloseTo(1, 7);
    }
  });

  it("preserves DC and has twice the coherent cutoff for a circular pupil", () => {
    const size = 64;
    const engine = new CpuFourierEngine(size);
    const step = spatialFrequencyStep(size, 10);
    const irisMm = 1.25;
    const radius = coherentCutoff(irisMm, 500, 100) / step;
    const pupil = rasterizeMask({ kind: "lowPass", radius }, size);
    const input = new Float32Array(size * size);
    const output = new Float32Array(input.length);
    const below = 12;
    const above = 17;
    expect(below * step).toBeGreaterThan(coherentCutoff(irisMm, 500, 100));
    expect(below * step).toBeLessThan(incoherentCutoff(irisMm, 500, 100));
    expect(above * step).toBeGreaterThan(incoherentCutoff(irisMm, 500, 100));
    for (let i = 0; i < input.length; i++) {
      const x = i % size;
      input[i] = 1 + 0.25 * (Math.cos((2 * Math.PI * below * x) / size) + Math.cos((2 * Math.PI * above * x) / size));
    }
    engine.imageThroughSystem(input, pupil, output, "ideal");

    // Compare the transmitted harmonic to the independent pupil-overlap sum,
    // and the rejected harmonic to zero. The OTF normalization preserves mean intensity.
    let pupilPower = 0;
    let overlap = 0;
    let passed = 0;
    let blocked = 0;
    let mean = 0;
    for (let i = 0; i < output.length; i++) {
      const x = i % size;
      const pupilValue = pupil[2 * i]!;
      pupilPower += pupilValue ** 2;
      if (x + below < size) {
        overlap += pupilValue * pupil[2 * (i + below)]!;
      }
      mean += output[i]!;
      passed += output[i]! * Math.cos((2 * Math.PI * below * x) / size);
      blocked += output[i]! * Math.cos((2 * Math.PI * above * x) / size);
    }
    expect(mean / output.length).toBeCloseTo(1, 7);
    expect((2 * passed) / output.length).toBeCloseTo((0.25 * overlap) / pupilPower, 7);
    expect((2 * blocked) / output.length).toBeCloseTo(0, 7);
    expect(overlap).toBeGreaterThan(0);
  });

  it("handles a complex pupil, preserves the sign of its OTF phase, and supports 4f inversion", () => {
    const size = 8;
    const centre = size / 2;
    const engine = new CpuFourierEngine(size);
    const pupil = new ComplexField(size);
    pupil.set(centre, centre, 1);
    pupil.set(centre + 1, centre, 0, 1);
    const ideal = Float32Array.from({ length: size ** 2 }, (_, i) => 1 + Math.cos((2 * Math.PI * (i % size)) / size));
    const physical = new Float32Array(ideal.length);
    engine.imageThroughSystem(ideal, pupil.data, physical);
    engine.imageThroughSystem(ideal, pupil.data, ideal, "ideal");
    for (let x = 0; x < size; x++) {
      const sin = Math.sin((2 * Math.PI * x) / size);
      expect(ideal[x]).toBeCloseTo(1 - 0.5 * sin, 7);
      expect(physical[x]).toBeCloseTo(1 + 0.5 * sin, 7);
    }

    pupil.fill(0);
    engine.imageThroughSystem(ideal, pupil.data, physical);
    expect(physical.every((value) => value === 0)).toBe(true);
    engine.dispose();
    expect(() => engine.imageThroughSystem(ideal, pupil.data, physical)).toThrow(/disposed/);
  });
});
