import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { SpatialFilteringModel } from "../model/SpatialFilteringModel.js";

export class SpatialFilteringScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: SpatialFilteringModel) {
    const manager = StringManager.getInstance();
    const a11y = manager.getSpatialFilteringA11yStrings();
    const objects = manager.getImagingObjectStrings();
    const filters = manager.getFilterStrings();
    const captions = manager.getFilterCaptions();
    const details = DerivedProperty.deriveAny(
      [
        model.objectProperty,
        model.filterProperty,
        model.transmittedProperty,
        ...Object.values(objects),
        ...Object.values(filters),
        ...Object.values(captions),
        a11y.currentDetailsStringProperty,
      ],
      () => {
        const filter = model.filterProperty.value;
        return StringUtils.fillIn(a11y.currentDetailsStringProperty.value, {
          object: objects[`${model.objectProperty.value}StringProperty`].value,
          filter: filters[`${filter}StringProperty`].value,
          power: toFixed(100 * model.transmittedProperty.value, 1),
          effect: captions[`${filter}StringProperty`].value,
        });
      },
    );
    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: details,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
    this.disposeEmitter.addListener(() => details.dispose());
  }
}
