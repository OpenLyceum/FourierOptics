import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { backendDescription } from "../../common/view/backendStatus.js";
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
        model.radiusProperty,
        model.innerRadiusProperty,
        model.slitWidthProperty,
        model.slitAngleProperty,
        a11y.radialCutoffStringProperty,
        a11y.bandCutoffStringProperty,
        a11y.slitCutoffStringProperty,
        ...Object.values(objects),
        ...Object.values(filters),
        ...Object.values(captions),
        a11y.currentDetailsStringProperty,
      ],
      () => {
        const filter = model.filterProperty.value;
        const mask = model.getMask();
        let cutoff = "";
        if (mask.kind === "bandPass") {
          cutoff = StringUtils.fillIn(a11y.bandCutoffStringProperty.value, {
            inner: toFixed(mask.inner, 1),
            outer: toFixed(mask.outer, 1),
          });
        } else if (mask.kind === "slit") {
          cutoff = StringUtils.fillIn(a11y.slitCutoffStringProperty.value, {
            width: toFixed(mask.width, 1),
            angle: toFixed((mask.angle * 180) / Math.PI, 1),
          });
        } else if (mask.kind === "lowPass" || mask.kind === "highPass") {
          cutoff = StringUtils.fillIn(a11y.radialCutoffStringProperty.value, { radius: toFixed(mask.radius, 1) });
        }
        return StringUtils.fillIn(a11y.currentDetailsStringProperty.value, {
          object: objects[`${model.objectProperty.value}StringProperty`].value,
          filter: filters[`${filter}StringProperty`].value,
          power: toFixed(100 * model.transmittedProperty.value, 1),
          effect: captions[`${filter}StringProperty`].value,
          cutoff,
        });
      },
    );
    const backend = backendDescription(model);
    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: [details, backend],
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
    const announceFilter = (filter: typeof model.filterProperty.value, previous: typeof model.filterProperty.value) => {
      this.addAccessibleContextResponse(
        StringUtils.fillIn(a11y.filterChangedStringProperty.value, {
          filter: filters[`${filter}StringProperty`].value,
          effect: captions[`${filter}StringProperty`].value,
        }),
      );
      if (filter === "phaseDot" || previous === "phaseDot") {
        this.addAccessibleContextResponse(
          filter === "phaseDot" ? a11y.phaseContrastOnStringProperty : a11y.phaseContrastOffStringProperty,
          "queue",
        );
      }
    };
    model.filterProperty.lazyLink(announceFilter);
    this.disposeEmitter.addListener(() => {
      model.filterProperty.unlink(announceFilter);
      details.dispose();
      backend.dispose();
    });
  }
}
