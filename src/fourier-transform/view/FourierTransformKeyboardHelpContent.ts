import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  KeyboardHelpIconFactory,
  KeyboardHelpSection,
  KeyboardHelpSectionRow,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { opticsKeyboardHelp } from "../../common/view/OpticsKeyboardHelp.js";

import { StringManager } from "../../i18n/StringManager.js";

export class FourierTransformKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const strings = StringManager.getInstance().getTransformStrings();
    super(
      [
        new SliderControlsKeyboardHelpSection({ headingStringProperty: strings.fieldOfViewStringProperty }),
        new KeyboardHelpSection(strings.fitPatternStringProperty, [
          KeyboardHelpSectionRow.labelWithIcon(
            strings.fitPatternHelpStringProperty,
            KeyboardHelpIconFactory.spaceOrEnter(),
            { labelInnerContent: strings.fitPatternHelpStringProperty },
          ),
        ]),
      ],
      [
        new BasicActionsKeyboardHelpSection({ withCheckboxContent: true }),
        new ComboBoxKeyboardHelpSection(),
        opticsKeyboardHelp(),
      ],
    );
  }
}
