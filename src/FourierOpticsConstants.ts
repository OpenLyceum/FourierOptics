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
 */
export const PANEL_CORNER_RADIUS = 6;

// ── Optical controls ────────────────────────────────────────────────────────

/**
 * Optical parameter defaults and suggested control ranges in the numerical API's
 * display units. The solver also supports sampling outside these control ranges.
 */
export const OPTICAL_PARAMETERS = {
  gridSize: { default: 256, min: 64, max: 1024 },
  pitchUm: 10,
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

/** Screen 2 aperture lengths in µm, with the inner radius expressed as a percentage. */
export const APERTURE_PARAMETERS = {
  width: { default: 240, min: 20, max: 960 },
  height: { default: 720, min: 80, max: 1800 },
  separation: { default: 320, min: 40, max: 560 },
  radius: { default: 180, min: 20, max: 720 },
  innerRatio: { default: 55, min: 5, max: 95 },
  period: { default: 200, min: 40, max: 640 },
  thickness: { default: 120, min: 20, max: 320 },
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

/** View dimensions in layout pixels, except the spectrum crop (FFT bins). */
export const OPTICS_LAYOUT = {
  gap: 14,
  smallGap: 6,
  fieldSize: 226,
  spectrumBins: 144,
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

export const BACKEND_CHOICES = ["auto", "cpu", "gpu"] as const;
export const RESOLUTION_CHOICES = [256, 512, 1024] as const;
export const DEFAULT_CPU_RESOLUTION = RESOLUTION_CHOICES[0];
export const DEFAULT_GPU_RESOLUTION = RESOLUTION_CHOICES[1];
export const MAX_CPU_RESOLUTION = RESOLUTION_CHOICES[1];
export const SPECTRUM_ZOOMS = [1, 2, 4, 8, 16, 32] as const;
export type SpectrumZoom = (typeof SPECTRUM_ZOOMS)[number];

/** Wait for eight completed GPU submissions before assessing steady device responsiveness. */
export const AUTO_GPU_SAMPLE_COUNT = 8;
export const AUTO_GPU_MEDIAN_LIMIT_MS = 30;
export const FOCAL_VIEW_MM = { default: 1.65, min: 0.05, max: 19, step: 0.05 } as const;
export const APERTURE_VIEW_UM = { min: 160, comparison: 1200, margin: 3.3 } as const;
export const SCREEN_ICONS = {
  width: 548,
  height: 373,
  stroke: 20,
  span: 190,
  offset: 116,
  aperture: 128,
  dot: 24,
} as const;
export const AIRY_FIFTH_ZERO_OVER_PI = 5.24;
export const APERTURE_FIT_FRINGE_COUNT = 5;
export const MICROMETERS_PER_MILLIMETER = 1000;
export const OBJECT_SPECTRUM_ZOOM = {
  letterF: 16,
  grating: 4,
  mesh: 4,
  letterMesh: 4,
  phaseDisk: 32,
  sinusoids: 2,
} as const;
export const RESOLUTION_TARGET_SPECTRUM_ZOOM = 2;
export const MASK_EDIT_SPECTRUM_ZOOM = 2;
export const MASK_PRESET_SPECTRUM_ZOOM = 4;
