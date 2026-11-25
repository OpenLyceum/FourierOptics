import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { backendDescription } from "../../common/view/backendStatus.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { FourFOpticalSystemModel } from "../model/FourFOpticalSystemModel.js";

export class FourFOpticalSystemScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: FourFOpticalSystemModel) {
    const manager = StringManager.getInstance();
    const a11y = manager.getFourFOpticalSystemA11yStrings();
    const objects = manager.getImagingObjectStrings();
    const strings = manager.getFourFStrings();
    const details = DerivedProperty.deriveAny(
      [
        model.objectProperty,
        model.illuminationProperty,
        model.magnificationProperty,
        model.irisProperty,
        model.defocusProperty,
        model.coherentCutoffProperty,
        model.incoherentCutoffProperty,
        ...Object.values(objects),
        strings.coherentStringProperty,
        strings.incoherentStringProperty,
        a11y.currentDetailsStringProperty,
      ],
      () => {
        const illumination = model.illuminationProperty.value;
        return StringUtils.fillIn(a11y.currentDetailsStringProperty.value, {
          object: objects[`${model.objectProperty.value}StringProperty`].value,
          light: strings[`${illumination}StringProperty`].value,
          magnification: toFixed(model.magnificationProperty.value, 2),
          diameter: toFixed(model.irisProperty.value, 2),
          defocus: toFixed(model.defocusProperty.value, 1),
          cutoff: toFixed(
            (illumination === "coherent" ? model.coherentCutoffProperty : model.incoherentCutoffProperty).value,
            4,
          ),
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
    const announceCutoff = (passed: boolean) => {
      if (model.objectProperty.value === "resolutionTarget") {
        this.addAccessibleContextResponse(passed ? a11y.finestPassedStringProperty : a11y.finestBlockedStringProperty);
      }
    };
    model.finestBarsInPassbandProperty.lazyLink(announceCutoff);
    this.disposeEmitter.addListener(() => {
      model.finestBarsInPassbandProperty.unlink(announceCutoff);
      details.dispose();
      backend.dispose();
    });
  }
}
