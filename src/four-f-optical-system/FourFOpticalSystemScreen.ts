/**
 * FourFOpticalSystemScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createFourFOpticalSystemIcon() in src/common/FourierOpticsScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createFourFOpticalSystemIcon } from "../common/FourierOpticsScreenIcons.js";
import FourierOpticsColors from "../FourierOpticsColors.js";
import type { FourierOpticsPreferencesModel } from "../preferences/FourierOpticsPreferencesModel.js";
import { FourFOpticalSystemModel } from "./model/FourFOpticalSystemModel.js";
import { FourFOpticalSystemKeyboardHelpContent } from "./view/FourFOpticalSystemKeyboardHelpContent.js";
import { FourFOpticalSystemScreenView } from "./view/FourFOpticalSystemScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type FourFOpticalSystemScreenOptions = ScreenOptions & { tandem: Tandem; preferences?: FourierOpticsPreferencesModel };

export class FourFOpticalSystemScreen extends Screen<FourFOpticalSystemModel, FourFOpticalSystemScreenView> {
  public constructor(options: FourFOpticalSystemScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new FourFOpticalSystemModel(options.preferences),
      // View factory — receives the model instance
      (model) =>
        new FourFOpticalSystemScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<FourFOpticalSystemScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new FourFOpticalSystemKeyboardHelpContent(),
          homeScreenIcon: createFourFOpticalSystemIcon(),
          navigationBarIcon: createFourFOpticalSystemIcon(),
        },
        options,
      ),
    );
  }
}
