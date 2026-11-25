import { Multilink, PatternStringProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Circle, InteractiveHighlighting, Node, RichDragListener, type TPaint } from "scenerystack/scenery";
import { Utterance } from "scenerystack/utterance-queue";
import Colors from "../../FourierOpticsColors.js";
import { OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { SpatialFrequenciesModel } from "../model/SpatialFrequenciesModel.js";

export class FrequencyHandleNode extends Node {
  private readonly disposeHandle: () => void;

  public constructor(
    model: SpatialFrequenciesModel,
    grating: SpatialFrequenciesModel["gratings"][number],
    index: number,
    transform: ModelViewTransform2,
    readoutProperty: TReadOnlyProperty<string>,
    color: TPaint,
  ) {
    const a11y = StringManager.getInstance().getSpatialFrequenciesA11yStrings();
    const nameProperty = new PatternStringProperty(a11y.handleStringProperty, { readout: readoutProperty });
    const target = new (InteractiveHighlighting(Circle))(L.handleRadius, {
      fill: color,
      stroke: Colors.plotBackgroundColorProperty,
      lineWidth: L.plotStroke,
      tagName: "div",
      ariaRole: "button",
      focusable: true,
      cursor: "grab",
      accessibleName: nameProperty,
      accessibleHelpText: a11y.handleHelpStringProperty,
    });
    target.touchArea = Shape.circle(0, 0, L.hitRadius);
    target.mouseArea = Shape.circle(0, 0, L.hitRadius);
    const partner = new Circle(L.handleRadius, { stroke: color, lineWidth: L.plotStroke, pickable: false });
    super({ children: [partner, target] });

    const response = new Utterance({ alert: readoutProperty });
    const dragListener = new RichDragListener({
      transform,
      start: () => {
        model.selectedGratingProperty.value = index;
      },
      end: (event) => {
        if (event) {
          target.addAccessibleResponse(response);
        }
      },
      dragListenerOptions: {
        drag: (_event, listener) => model.setFrequency(grating, listener.modelPoint),
      },
      keyboardDragListenerOptions: {
        dragDelta: L.handleStep,
        shiftDragDelta: L.fineHandleStep,
        drag: (_event, listener) => model.setFrequency(grating, model.getFrequency(grating).plus(listener.modelDelta)),
      },
    });
    target.addInputListener(dragListener);

    const tracking = Multilink.multilink(
      [grating.periodProperty, grating.angleProperty, grating.enabledProperty, model.barsProperty],
      (_period, _angle, enabled, bars) => {
        const frequency = model.getFrequency(grating);
        target.translation = transform.modelToViewPosition(frequency);
        partner.translation = transform.modelToViewPosition(frequency.negated());
        this.visible = enabled && !bars;
      },
    );
    this.disposeHandle = () => {
      tracking.dispose();
      target.removeInputListener(dragListener);
      dragListener.dispose();
      response.dispose();
      target.dispose();
      partner.dispose();
      nameProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeHandle();
    super.dispose();
  }
}
