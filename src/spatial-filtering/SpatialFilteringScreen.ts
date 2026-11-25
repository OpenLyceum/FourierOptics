/**
 * SpatialFilteringScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createSpatialFilteringIcon() in src/common/FourierOpticsScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createSpatialFilteringIcon } from "../common/FourierOpticsScreenIcons.js";
import FourierOpticsColors from "../FourierOpticsColors.js";
import type { FourierOpticsPreferencesModel } from "../preferences/FourierOpticsPreferencesModel.js";
import { SpatialFilteringModel } from "./model/SpatialFilteringModel.js";
import { SpatialFilteringKeyboardHelpContent } from "./view/SpatialFilteringKeyboardHelpContent.js";
import { SpatialFilteringScreenView } from "./view/SpatialFilteringScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type SpatialFilteringScreenOptions = ScreenOptions & { tandem: Tandem; preferences?: FourierOpticsPreferencesModel };

export class SpatialFilteringScreen extends Screen<SpatialFilteringModel, SpatialFilteringScreenView> {
  public constructor(options: SpatialFilteringScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new SpatialFilteringModel(options.preferences),
      // View factory — receives the model instance
      (model) =>
        new SpatialFilteringScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<SpatialFilteringScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new SpatialFilteringKeyboardHelpContent(),
          homeScreenIcon: createSpatialFilteringIcon(),
          navigationBarIcon: createSpatialFilteringIcon(),
        },
        options,
      ),
    );
  }
}
