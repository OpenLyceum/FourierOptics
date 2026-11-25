import type { TReadOnlyProperty } from "scenerystack/axon";
import type { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Circle, InteractiveHighlighting, RichDragListener } from "scenerystack/scenery";
import Colors from "../../FourierOpticsColors.js";
import { OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";

export class OpticsDragHandle extends InteractiveHighlighting(Circle) {
  public constructor(
    name: TReadOnlyProperty<string>,
    help: TReadOnlyProperty<string>,
    transform: () => ModelViewTransform2,
    move: (point: Vector2) => void,
  ) {
    super(L.handleRadius, {
      fill: Colors.secondGratingColorProperty,
      stroke: Colors.plotBackgroundColorProperty,
      lineWidth: L.plotStroke,
      tagName: "div",
      ariaRole: "button",
      focusable: true,
      cursor: "grab",
      accessibleName: name,
      accessibleHelpText: help,
    });
    this.touchArea = Shape.circle(0, 0, L.hitRadius);
    this.mouseArea = Shape.circle(0, 0, L.hitRadius);
    const listener = new RichDragListener({
      dragListenerOptions: {
        drag: (_event, drag) => move(transform().viewToModelPosition(drag.parentPoint)),
      },
      keyboardDragListenerOptions: {
        dragDelta: L.handleStep,
        shiftDragDelta: L.fineHandleStep,
        drag: (_event, drag) => move(transform().viewToModelPosition(this.translation.plus(drag.modelDelta))),
      },
    });
    this.addInputListener(listener);
    this.disposeEmitter.addListener(() => {
      this.removeInputListener(listener);
      listener.dispose();
    });
  }
}
