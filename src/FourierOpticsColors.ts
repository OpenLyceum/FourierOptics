/**
 * FourierOpticsColors.ts
 *
 * Defines all dynamic colors for the simulation using ProfileColorProperty.
 *
 * Each color has two profiles:
 *   - "default"   — used in standard (dark) mode
 *   - "projector" — used when the user enables Projector Mode in Preferences
 *
 * SceneryStack switches profiles automatically; no manual toggling is needed.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 * Import FourierOpticsColors and pass properties directly to Node's fillProperty or
 * strokeProperty options:
 *
 *   import FourierOpticsColors from "../../FourierOpticsColors.js";
 *
 *   new Rectangle( 0, 0, 100, 50, {
 *     fillProperty: FourierOpticsColors.backgroundColorProperty,
 *   });
 *
 * ── How to add a color ────────────────────────────────────────────────────────
 * Add a new ProfileColorProperty entry to the FourierOpticsColors object below.
 * Always provide both "default" and "projector" values.
 */
import { ProfileColorProperty } from "scenerystack/scenery";
import FourierOpticsNamespace from "./FourierOpticsNamespace.js";

const FourierOpticsColors = {
  /**
   * Background color for the simulation screen.
   * Deep navy in default mode; white in projector mode.
   */
  backgroundColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "background", {
    default: "#1a1a2e",
    projector: "#ffffff",
  }),

  /**
   * Primary accent color for highlights, selected items, and key UI elements.
   * Sky blue in default mode; dark navy in projector mode.
   */
  accentColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "accent", {
    default: "#4fc3f7",
    projector: "#1a1a2e",
  }),

  /**
   * Background fill for control panels and dialogs.
   * Deep blue in default mode; light gray in projector mode.
   */
  panelBackgroundColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "panelBackground", {
    default: "#16213e",
    projector: "#f5f5f5",
  }),

  /**
   * Border/stroke color for control panels and dialogs.
   * Teal-navy in default mode; medium gray in projector mode.
   */
  panelBorderColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "panelBorder", {
    default: "#0f3460",
    projector: "#999999",
  }),

  /**
   * Text color for labels, readouts, and general UI text.
   * Near-white in default mode; near-black in projector mode.
   */
  textColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "text", {
    default: "#e0e0e0",
    projector: "#1a1a1a",
  }),

  // ── Light control surfaces ───────────────────────────────────────────────────
  // White chrome (combo boxes, flat push buttons, editable input fields) stays light
  // in both profiles; its text stays dark. Same values in default and projector mode,
  // but defined here so every color lives in one themeable place.

  /** Fill of light control surfaces: combo-box button/list, editable input fields. */
  controlSurfaceColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "controlSurface", {
    default: "#ffffff",
    projector: "#ffffff",
  }),

  /** Text on light control surfaces: combo items, flat-button labels, field values, preferences. */
  controlSurfaceTextColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "controlSurfaceText", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),
  plotBackgroundColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "plotBackground", {
    default: "#10192b",
    projector: "#edf1f5",
  }),
  imageAxisColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "imageAxis", {
    default: "#68788b",
    projector: "#68788b",
  }),
  imageLabelColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "imageLabel", {
    default: "#ffffff",
    projector: "#ffffff",
  }),
  firstGratingColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "firstGrating", {
    default: "#62ddfa",
    projector: "#49cadc",
  }),
  secondGratingColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "secondGrating", {
    default: "#ffbf6e",
    projector: "#ffc16e",
  }),
  thirdGratingColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "thirdGrating", {
    default: "#f4a5ed",
    projector: "#f4a5ed",
  }),
  negativePhaseColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "negativePhase", {
    default: "#4367ae",
  }),
  zeroPhaseColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "zeroPhase", {
    default: "#b8b8b8",
  }),
  positivePhaseColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "positivePhase", {
    default: "#af522d",
  }),
  maskShadeColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "maskShade", {
    default: "#7485ad",
    projector: "#53658a",
  }),
  maskOutlineColorProperty: new ProfileColorProperty(FourierOpticsNamespace, "maskOutline", {
    default: "#62ddfa",
    projector: "#49cadc",
  }),
};

export default FourierOpticsColors;
