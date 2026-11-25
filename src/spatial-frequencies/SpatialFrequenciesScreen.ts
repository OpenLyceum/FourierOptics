/**
 * SpatialFrequenciesScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createSpatialFrequenciesIcon() in src/common/FourierOpticsScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createSpatialFrequenciesIcon } from "../common/FourierOpticsScreenIcons.js";
import FourierOpticsColors from "../FourierOpticsColors.js";
import { SpatialFrequenciesModel } from "./model/SpatialFrequenciesModel.js";
import { SpatialFrequenciesKeyboardHelpContent } from "./view/SpatialFrequenciesKeyboardHelpContent.js";
import { SpatialFrequenciesScreenView } from "./view/SpatialFrequenciesScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type SpatialFrequenciesScreenOptions = ScreenOptions & { tandem: Tandem };

export class SpatialFrequenciesScreen extends Screen<SpatialFrequenciesModel, SpatialFrequenciesScreenView> {
  public constructor(options: SpatialFrequenciesScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new SpatialFrequenciesModel(),
      // View factory — receives the model instance
      (model) =>
        new SpatialFrequenciesScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<SpatialFrequenciesScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new SpatialFrequenciesKeyboardHelpContent(),
          homeScreenIcon: createSpatialFrequenciesIcon(),
          navigationBarIcon: createSpatialFrequenciesIcon(),
        },
        options,
      ),
    );
  }
}
