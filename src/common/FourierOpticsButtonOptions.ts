import { ButtonNode, type ComboBoxOptions } from "scenerystack/sun";
import FourierOpticsColors from "../FourierOpticsColors.js";

const flatAppearance = { buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy } as const;

export const FOURIER_OPTICS_COMBO_BOX_OPTIONS = {
  buttonFill: FourierOpticsColors.controlSurfaceColorProperty,
  listFill: FourierOpticsColors.controlSurfaceColorProperty,
  buttonStroke: FourierOpticsColors.panelBorderColorProperty,
  listStroke: FourierOpticsColors.panelBorderColorProperty,
} satisfies Pick<ComboBoxOptions, "buttonFill" | "listFill" | "buttonStroke" | "listStroke">;

export const FLAT_PANEL_PUSH_BUTTON_OPTIONS = {
  ...flatAppearance,
  baseColor: FourierOpticsColors.controlSurfaceColorProperty,
} as const;

export const FLAT_RESET_ALL_BUTTON_OPTIONS = flatAppearance;
