import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { GRATING_PARAMETERS, OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { SpatialFrequenciesModel } from "../model/SpatialFrequenciesModel.js";

const manager = StringManager.getInstance();
const strings = manager.getSpatialStrings();
const a11y = manager.getSpatialFrequenciesA11yStrings();

export function createGratingReadout(
  model: SpatialFrequenciesModel,
  grating: SpatialFrequenciesModel["gratings"][number],
  nameProperty: TReadOnlyProperty<string>,
) {
  return new DerivedProperty(
    [nameProperty, strings.readoutStringProperty, grating.periodProperty, grating.angleProperty],
    (name, pattern, period, angle) =>
      StringUtils.fillIn(pattern, {
        name,
        period: toFixed(period, 2),
        frequency: toFixed(model.getFrequency(grating).magnitude, 3),
        angle: toFixed(angle, 1),
      }),
  );
}

export class SpatialFrequenciesScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: SpatialFrequenciesModel, readouts: readonly TReadOnlyProperty<string>[]) {
    const detailsProperty = DerivedProperty.deriveAny(
      [
        ...readouts,
        ...model.gratings.map((grating) => grating.enabledProperty),
        model.barsProperty,
        a11y.currentDetailsStringProperty,
        a11y.barsDetailsStringProperty,
      ],
      () => {
        if (model.barsProperty.value) {
          return StringUtils.fillIn(a11y.barsDetailsStringProperty.value, { period: GRATING_PARAMETERS.barPeriod });
        }
        const active = readouts.filter((_, index) => model.gratings[index]?.enabledProperty.value);
        return StringUtils.fillIn(a11y.currentDetailsStringProperty.value, {
          count: active.length,
          readouts: active.map((readout) => `${readout.value}.`).join(" "),
          limit: toFixed((model.frequencyStep * L.spectrumBins) / 2, 3),
        });
      },
    );
    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: detailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
    this.disposeEmitter.addListener(() => detailsProperty.dispose());
  }
}
