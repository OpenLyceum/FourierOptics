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
