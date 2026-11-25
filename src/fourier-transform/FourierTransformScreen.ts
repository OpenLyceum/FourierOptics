/**
 * FourierTransformScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createFourierTransformIcon() in src/common/FourierOpticsScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createFourierTransformIcon } from "../common/FourierOpticsScreenIcons.js";
import FourierOpticsColors from "../FourierOpticsColors.js";
import type { FourierOpticsPreferencesModel } from "../preferences/FourierOpticsPreferencesModel.js";
import { FourierTransformModel } from "./model/FourierTransformModel.js";
import { FourierTransformKeyboardHelpContent } from "./view/FourierTransformKeyboardHelpContent.js";
import { FourierTransformScreenView } from "./view/FourierTransformScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type FourierTransformScreenOptions = ScreenOptions & { tandem: Tandem; preferences?: FourierOpticsPreferencesModel };

export class FourierTransformScreen extends Screen<FourierTransformModel, FourierTransformScreenView> {
  public constructor(options: FourierTransformScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new FourierTransformModel(options.preferences),
      // View factory — receives the model instance
      (model) =>
        new FourierTransformScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<FourierTransformScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new FourierTransformKeyboardHelpContent(),
          homeScreenIcon: createFourierTransformIcon(),
          navigationBarIcon: createFourierTransformIcon(),
        },
        options,
      ),
    );
  }
}
