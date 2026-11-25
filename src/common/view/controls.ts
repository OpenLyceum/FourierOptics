import type { BooleanProperty, NumberProperty, Property, TReadOnlyProperty } from "scenerystack/axon";
import { Dimension2 } from "scenerystack/dot";
import { type Node, Text, type TextOptions, VBox } from "scenerystack/scenery";
import { NumberControl, PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, ComboBox } from "scenerystack/sun";
import Colors from "../../FourierOpticsColors.js";
import { OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS, FOURIER_OPTICS_COMBO_BOX_OPTIONS } from "../FourierOpticsButtonOptions.js";

export function label(property: TReadOnlyProperty<string>, options?: TextOptions): Text {
  return new Text(property, {
    fill: Colors.textColorProperty,
    font: new PhetFont(L.labelFontSize),
    ...options,
  });
}

export function heading(property: TReadOnlyProperty<string>, maxWidth: number): Text {
  return label(property, { font: new PhetFont({ size: L.titleFontSize, weight: "bold" }), maxWidth });
}

export function numberControl(name: TReadOnlyProperty<string>, property: NumberProperty, delta = 1): NumberControl {
  return new NumberControl(name, property, property.range, {
    accessibleName: name,
    delta,
    titleNodeOptions: {
      fill: Colors.textColorProperty,
      font: new PhetFont(L.smallFontSize),
      maxWidth: L.controlWidth - L.trackWidth / 2,
    },
    numberDisplayOptions: {
      decimalPlaces: delta < 1 ? Math.ceil(-Math.log10(delta)) : 0,
      backgroundFill: Colors.controlSurfaceColorProperty,
      textOptions: { fill: Colors.controlSurfaceTextColorProperty },
    },
    arrowButtonOptions: { ...FLAT_PANEL_PUSH_BUTTON_OPTIONS, scale: 0.65 },
    sliderOptions: {
      trackSize: new Dimension2(L.trackWidth, 3),
      trackFillEnabled: Colors.controlSurfaceColorProperty,
      thumbSize: new Dimension2(12, 17),
      thumbFill: Colors.accentColorProperty,
    },
    layoutFunction: NumberControl.createLayoutFunction1({ ySpacing: 2 }),
  });
}

export function checkbox(name: TReadOnlyProperty<string>, property: BooleanProperty): Checkbox {
  return new Checkbox(property, label(name, { maxWidth: L.controlWidth - L.gap * 2 }), {
    accessibleName: name,
    boxWidth: L.labelFontSize,
    spacing: L.smallGap,
    checkboxColor: Colors.textColorProperty,
    checkboxColorBackground: Colors.panelBackgroundColorProperty,
  });
}

export function combo<T>(
  name: TReadOnlyProperty<string>,
  property: Property<T>,
  choices: readonly { value: T; name: TReadOnlyProperty<string> }[],
  listParent: Node,
): VBox {
  const box = new ComboBox(
    property,
    choices.map((choice) => ({
      value: choice.value,
      createNode: () =>
        label(choice.name, {
          fill: Colors.controlSurfaceTextColorProperty,
          maxWidth: L.controlWidth - L.gap * 2,
        }),
      accessibleName: choice.name,
    })),
    listParent,
    {
      ...FOURIER_OPTICS_COMBO_BOX_OPTIONS,
      accessibleName: name,
    },
  );
  return new VBox({
    align: "left",
    spacing: L.smallGap / 2,
    children: [label(name, { maxWidth: L.controlWidth }), box],
  });
}
