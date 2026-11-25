import { roundSymmetric } from "scenerystack/dot";
import { ComplexField } from "./ComplexField.js";

/** Round to a centered crop with an integer sample index at its first pixel. */
export function evenCrop(bins: number, size: number): number {
  return Math.max(2, Math.min(size, 2 * roundSymmetric(bins / 2)));
}

/** Frequency spacing in cycles/µm for a sample pitch in µm. */
export function spatialFrequencyStep(size: number, pitchUm: number): number {
  return 1 / (size * pitchUm);
}

/** Focal-plane position in mm for frequency in cycles/µm, wavelength in nm and focal length in mm. */
export function focalPlaneCoordinate(frequency: number, wavelengthNm: number, focalLengthMm: number): number {
  const wavelengthUm = wavelengthNm / 1000;
  return wavelengthUm * focalLengthMm * frequency;
}

/** Object-side coherent cutoff in cycles/µm for a circular iris. */
export function coherentCutoff(irisDiameterMm: number, wavelengthNm: number, f1Mm: number): number {
  const wavelengthUm = wavelengthNm / 1000;
  return irisDiameterMm / (2 * wavelengthUm * f1Mm);
}

/** Coherent limiting period in µm. A closed iris gives an infinite period. */
export function smallestResolvedPeriod(irisDiameterMm: number, wavelengthNm: number, f1Mm: number): number {
  return 1 / coherentCutoff(irisDiameterMm, wavelengthNm, f1Mm);
}

/** Object-side incoherent cutoff in cycles/µm for a circular iris. */
export function incoherentCutoff(irisDiameterMm: number, wavelengthNm: number, f1Mm: number): number {
  return 2 * coherentCutoff(irisDiameterMm, wavelengthNm, f1Mm);
}

/** Signed transverse magnification, with both focal lengths in mm. */
export function magnification(f1Mm: number, f2Mm: number): number {
  return -f2Mm / f1Mm;
}

/**
 * Centred, interleaved angular-spectrum transfer for pitch in µm, wavelength in nm,
 * and signed propagation distance in mm. Evanescent bins are zero for either sign.
 */
export function angularSpectrumTransfer(
  size: number,
  pitchUm: number,
  wavelengthNm: number,
  distanceMm: number,
): Float32Array {
  const { data } = new ComplexField(size);
  const frequencyStep = spatialFrequencyStep(size, pitchUm);
  const inverseWavelength = 1000 / wavelengthNm;
  const inverseWavelengthSquared = inverseWavelength * inverseWavelength;
  const phaseScale = 2 * Math.PI * distanceMm * 1000;
  const centre = Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    const fy = (y - centre) * frequencyStep;
    for (let x = 0; x < size; x++) {
      const fx = (x - centre) * frequencyStep;
      const longitudinalSquared = inverseWavelengthSquared - (fx * fx + fy * fy);
      if (longitudinalSquared >= 0) {
        const phase = phaseScale * Math.sqrt(longitudinalSquared);
        const i = 2 * (y * size + x);
        data[i] = Math.cos(phase);
        data[i + 1] = Math.sin(phase);
      }
    }
  }
  return data;
}
