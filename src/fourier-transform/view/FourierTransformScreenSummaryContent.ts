import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { APERTURE_DIMENSIONS, type FourierTransformModel } from "../model/FourierTransformModel.js";

export class FourierTransformScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: FourierTransformModel) {
    const manager = StringManager.getInstance();
    const a11y = manager.getFourierTransformA11yStrings();
    const apertures = manager.getAperturesStrings();
    const dimensions = manager.getDimensionsStrings();
    const detailsProperty = DerivedProperty.deriveAny(
      [
        model.swapProperty,
        model.apertureProperty,
        model.objectAProperty,
        model.objectBProperty,
        model.wavelengthProperty,
        model.focalLengthProperty,
        model.pitchProperty,
        model.focalStepProperty,
        ...Object.values(model.dimensions),
        ...Object.values(apertures),
        ...Object.values(dimensions),
        a11y.currentDetailsStringProperty,
        a11y.swapDetailsStringProperty,
      ],
      () => {
        if (model.swapProperty.value) {
          return StringUtils.fillIn(a11y.swapDetailsStringProperty.value, {
            a: apertures[`${model.objectAProperty.value}StringProperty`].value,
            b: apertures[`${model.objectBProperty.value}StringProperty`].value,
          });
        }
        const kind = model.apertureProperty.value;
        return StringUtils.fillIn(a11y.currentDetailsStringProperty.value, {
          aperture: apertures[`${kind}StringProperty`].value,
          dimensions: APERTURE_DIMENSIONS[kind]
            .map((key) => `${dimensions[`${key}StringProperty`].value}, ${model.dimensions[key].value}.`)
            .join(" "),
          wavelength: model.wavelengthProperty.value,
          focalLength: model.focalLengthProperty.value,
          pitch: model.pitchProperty.value,
          span: (model.focalStepProperty.value * L.focalBins).toPrecision(3),
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
