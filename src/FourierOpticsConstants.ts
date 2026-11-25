/**
 * FourierOpticsConstants.ts
 *
 * Central repository for every named numeric constant used across the
 * simulation. Bare numbers that carry semantic meaning (sizes, margins,
 * physics defaults, ranges) belong here rather than inline in model or view
 * code, so they are named, documented, and changed in one place.
 *
 * Conventions
 * ───────────
 *  - Optical control units are explicit in the names below.
 *  - Layout / chrome values are in screen pixels.
 *  - Colour strings live in FourierOpticsColors.ts, not here.
 *  - Computed expressions (e.g. `2 * Math.PI`) may stay inline.
 */

import FourierOpticsNamespace from "./FourierOpticsNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/**
 * Corner radius shared by control panels and dialogs.
 * @public
 */
export const PANEL_CORNER_RADIUS = 6;

// ── Optical controls ────────────────────────────────────────────────────────

/**
 * Optical parameter defaults and suggested control ranges in the numerical API's
 * display units. The solver also supports sampling outside these control ranges.
 */
export const OPTICAL_PARAMETERS = {
  gridSize: { default: 256, min: 64, max: 1024 },
  pitchUm: { default: 10, min: 1, max: 25 },
  wavelengthNm: { default: 550, min: 380, max: 750 },
  f1Mm: { default: 100, min: 25, max: 250 },
  f2Mm: { default: 100, min: 25, max: 250 },
  irisDiameterMm: { default: 2, min: 0, max: 10 },
} as const;

FourierOpticsNamespace.register("FourierOpticsConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
});

/** Period in object samples, angles in degrees, and relative modulation contrast. */
export const GRATING_PARAMETERS = {
  period: { min: 4, max: 64 },
  angle: { min: -180, max: 180 },
  contrast: { min: 0, max: 1 },
  defaults: [
    { period: 8, angle: 0, contrast: 0.65 },
    { period: 12.8, angle: 90, contrast: 0.35 },
    { period: 16, angle: 45, contrast: 0.25 },
  ],
  bias: 0.5,
  // Samples per cycle for the bar preset, with enough bins to resolve seven harmonics.
  barPeriod: 32,
  displayedHarmonics: 7,
} as const;

/** Aperture dimensions in object samples. */
export const APERTURE_PARAMETERS = {
  width: { default: 24, min: 2, max: 96 },
  height: { default: 72, min: 8, max: 180 },
  separation: { default: 32, min: 4, max: 56 },
  radius: { default: 18, min: 2, max: 72 },
  innerRatio: { default: 55, min: 5, max: 95 },
  period: { default: 20, min: 4, max: 64 },
  thickness: { default: 12, min: 2, max: 32 },
} as const;

/** Comparison objects use fixed sizes in samples so the two shapes read clearly side by side. */
export const PHASE_COMPARISON_DIMENSIONS = {
  width: 88,
  height: 96,
  separation: 32,
  radius: 38,
  innerRatio: 55,
  period: 24,
  thickness: 15,
} as const;

/** Exposure window in decibels below peak intensity. */
export const EXPOSURE_DB = { default: 50, min: 10, max: 100 } as const;

/** View dimensions in layout pixels, except the two crops (FFT bins). */
export const OPTICS_LAYOUT = {
  gap: 14,
  smallGap: 6,
  fieldSize: 226,
  spectrumBins: 144,
  focalBins: 80,
  swapImageSize: 176,
  controlWidth: 226,
  trackWidth: 110,
  titleFontSize: 18,
  labelFontSize: 14,
  smallFontSize: 12,
  chartHeight: 72,
  plotStroke: 1.5,
  handleRadius: 6,
  hitRadius: 14,
  handleStep: 5,
  fineHandleStep: 1,
  scaleBarWidth: 86,
  schematicWidth: 532,
  schematicHeight: 92,
  schematicPlaneSpacing: 114,
} as const;

/** Number of entries per unit of linear light in the sRGB lookup table. */
export const SPECTRAL_GAMMA_TABLE_SIZE = 1024;

/** Objects and Fourier-mask parameters for the imaging screens. */
export const FILTER_PARAMETERS = {
  letter: { width: 132, height: 166, thickness: 24 },
  gratingPeriod: 32,
  phaseRadius: 62,
  weakPhase: 0.2,
  radius: { default: 18, min: 1, max: 62 },
  innerRadius: { default: 7, min: 0, max: 61 },
  slitWidth: { default: 7, min: 1, max: 56 },
  angle: { default: 0, min: -180, max: 180 },
  brushRadius: { default: 4, min: 1, max: 20 },
  edgeRadius: 8,
} as const;

/** The bar groups are sampled sinusoids with these periods in object samples. */
export const RESOLUTION_PERIODS = [32, 16, 8] as const;
export const DEFOCUS_MM = { default: 0, min: -15, max: 15 } as const;

export const IMAGING_LAYOUT = {
  fieldSize: 226,
  filterBins: 144,
  irisBins: 192,
  schematicWidth: 774,
  schematicHeight: 88,
  schematicMargin: 65,
  irisTravel: 22,
  angleHandleRadius: 49,
  maskShadeAlpha: 97,
} as const;
