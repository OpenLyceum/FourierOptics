/**
 * By-hand headless soak: npm run test:soak:headless (never in CI).
 *
 * List the screens exactly as main.ts builds them. The harness in
 * tests/helpers/headlessSoak.ts (template-owned) presses every control, sets every slider,
 * steps, switches screens, flips the color profile and locale, presses Reset All, and
 * fails when listener counts, node counts or retained heap rise after every round.
 *
 * Add `actions` for what only this sim can do (record/clear, add/remove objects) and
 * `exclude` for controls that must not be pressed headless.
 */

import { StringProperty } from "scenerystack/axon";
import { Tandem } from "scenerystack/tandem";
import FourierOpticsColors from "../../src/FourierOpticsColors.js";
import { FourFOpticalSystemScreen } from "../../src/four-f-optical-system/FourFOpticalSystemScreen.js";
import { FourierTransformScreen } from "../../src/fourier-transform/FourierTransformScreen.js";
import { SpatialFilteringScreen } from "../../src/spatial-filtering/SpatialFilteringScreen.js";
import { SpatialFrequenciesScreen } from "../../src/spatial-frequencies/SpatialFrequenciesScreen.js";
import { describeHeadlessSoak } from "../helpers/headlessSoak.js";

describeHeadlessSoak({
  screens: () => [
    new SpatialFrequenciesScreen({ name: new StringProperty("Spatial Frequencies"), tandem: Tandem.OPT_OUT }),
    new FourierTransformScreen({ name: new StringProperty("Fourier Transform"), tandem: Tandem.OPT_OUT }),
    new SpatialFilteringScreen({ name: new StringProperty("Spatial Filtering"), tandem: Tandem.OPT_OUT }),
    new FourFOpticalSystemScreen({ name: new StringProperty("4f Optical System"), tandem: Tandem.OPT_OUT }),
  ],
  tracked: () => ({ FourierOpticsColors }),
});
