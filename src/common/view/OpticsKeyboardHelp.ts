import { KeyboardHelpIconFactory, KeyboardHelpSection, KeyboardHelpSectionRow } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";

export function opticsKeyboardHelp(hasZoom = false): KeyboardHelpSection {
  const strings = StringManager.getInstance().getPreferences();
  const rows = [
    KeyboardHelpSectionRow.labelWithIcon(
      strings.backendAndResolutionStringProperty,
      KeyboardHelpIconFactory.arrowKeysRowIcon(),
      {
        labelInnerContent: strings.keyboardHelpStringProperty,
      },
    ),
  ];
  if (hasZoom) {
    rows.unshift(
      KeyboardHelpSectionRow.labelWithIcon(strings.zoomStringProperty, KeyboardHelpIconFactory.arrowKeysRowIcon(), {
        labelInnerContent: strings.zoomKeyboardHelpStringProperty,
      }),
    );
  }
  return new KeyboardHelpSection(strings.keyboardHelpHeadingStringProperty, rows);
}
