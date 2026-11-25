import type { Property, TReadOnlyProperty } from "scenerystack/axon";
import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { AquaRadioButtonGroup } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import Colors from "../FourierOpticsColors.js";
import { BACKEND_CHOICES, OPTICS_LAYOUT as L, RESOLUTION_CHOICES } from "../FourierOpticsConstants.js";
import FourierOpticsNamespace from "../FourierOpticsNamespace.js";
import { StringManager } from "../i18n/StringManager.js";
import type { FourierOpticsPreferencesModel, ResolutionChoice } from "./FourierOpticsPreferencesModel.js";

export class FourierOpticsPreferencesNode extends VBox {
  public constructor(preferences: FourierOpticsPreferencesModel, tandem = Tandem.OPT_OUT) {
    const strings = StringManager.getInstance().getPreferences();
    const text = (name: TReadOnlyProperty<string>, bold = false) =>
      new Text(name, {
        font: new PhetFont({ size: L.labelFontSize, weight: bold ? "bold" : "normal" }),
        fill: Colors.controlSurfaceTextColorProperty,
      });
    const group = <T>(
      property: Property<T>,
      title: TReadOnlyProperty<string>,
      values: readonly T[],
      nameFor: (value: T) => TReadOnlyProperty<string>,
      name: string,
    ) =>
      new VBox({
        align: "left",
        spacing: L.smallGap,
        children: [
          text(title, true),
          new AquaRadioButtonGroup(
            property,
            values.map((value) => ({
              value,
              createNode: () => text(nameFor(value)),
              options: { accessibleName: nameFor(value) },
            })),
            {
              orientation: "horizontal",
              spacing: L.gap,
              accessibleName: title,
              tandem: tandem.createTandem(name),
            },
          ),
        ],
      });
    super({
      align: "left",
      spacing: L.gap,
      children: [
        group(
          preferences.backendProperty,
          strings.backendStringProperty,
          BACKEND_CHOICES,
          (value) => (value === "auto" ? strings.automaticStringProperty : strings[`${value}StringProperty`]),
          "backendRadioButtonGroup",
        ),
        group<ResolutionChoice>(
          preferences.resolutionProperty,
          strings.resolutionStringProperty,
          [0, ...RESOLUTION_CHOICES],
          (value) => (value === 0 ? strings.automaticStringProperty : strings[`resolution${value}StringProperty`]),
          "resolutionRadioButtonGroup",
        ),
      ],
    });
  }
}

FourierOpticsNamespace.register("FourierOpticsPreferencesNode", FourierOpticsPreferencesNode);
