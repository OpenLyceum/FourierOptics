/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screens, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { initializeGpuContext } from "./common/fourier/gpu/GpuContext.js";
import FourierOpticsColors from "./FourierOpticsColors.js";
import { FourFOpticalSystemScreen } from "./four-f-optical-system/FourFOpticalSystemScreen.js";
import { FourierTransformScreen } from "./fourier-transform/FourierTransformScreen.js";
import { StringManager } from "./i18n/StringManager.js";
import { FourierOpticsPreferencesModel } from "./preferences/FourierOpticsPreferencesModel.js";
import { FourierOpticsPreferencesNode } from "./preferences/FourierOpticsPreferencesNode.js";
import { SpatialFilteringScreen } from "./spatial-filtering/SpatialFilteringScreen.js";
import { SpatialFrequenciesScreen } from "./spatial-frequencies/SpatialFrequenciesScreen.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();

  // Simulation-specific preferences; initial values come from fourierOpticsQueryParameters.
  const simPreferences = new FourierOpticsPreferencesModel(Tandem.ROOT.createTandem("preferences"));

  const launch = () => {
    const screens = [
      new SpatialFrequenciesScreen({
        name: stringManager.getScreenNames().spatialFrequenciesStringProperty,
        tandem: Tandem.ROOT.createTandem("spatialFrequenciesScreen"),
        preferences: simPreferences,
        backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
      }),
      new FourierTransformScreen({
        name: stringManager.getScreenNames().fourierTransformStringProperty,
        tandem: Tandem.ROOT.createTandem("fourierTransformScreen"),
        preferences: simPreferences,
        backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
      }),
      new SpatialFilteringScreen({
        name: stringManager.getScreenNames().spatialFilteringStringProperty,
        tandem: Tandem.ROOT.createTandem("spatialFilteringScreen"),
        preferences: simPreferences,
        backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
      }),
      new FourFOpticalSystemScreen({
        name: stringManager.getScreenNames().fourFOpticalSystemStringProperty,
        tandem: Tandem.ROOT.createTandem("fourFOpticalSystemScreen"),
        preferences: simPreferences,
        backgroundColorProperty: FourierOpticsColors.backgroundColorProperty,
      }),
    ];

    const sim = new Sim(stringManager.getTitleStringProperty(), screens, {
      preferencesModel: new PreferencesModel({
        visualOptions: {
          // Adds a "Projector Mode" toggle in Preferences → Visual
          supportsProjectorMode: true,
          // Enables keyboard-navigation highlight outlines
          supportsInteractiveHighlights: true,
        },
        simulationOptions: {
          customPreferences: [
            {
              createContent: (tandem: Tandem) => new FourierOpticsPreferencesNode(simPreferences, tandem),
            },
          ],
        },
        localizationOptions: {
          // Adds a language picker in Preferences → Language
          supportsDynamicLocale: true,
        },
      }),

      // Optional: fill in credits shown in Help → About
      credits: {
        leadDesign: "",
        softwareDevelopment: "",
        team: "",
        qualityAssurance: "",
      },
    });

    sim.start();
  };
  initializeGpuContext(simPreferences.backendProperty.value).then(launch, launch);
});
