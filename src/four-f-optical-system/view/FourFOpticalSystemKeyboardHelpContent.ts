import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { opticsKeyboardHelp } from "../../common/view/OpticsKeyboardHelp.js";
import { StringManager } from "../../i18n/StringManager.js";

export class FourFOpticalSystemKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const a11y = StringManager.getInstance().getFourFOpticalSystemA11yStrings();
    super(
      [
        new MoveDraggableItemsKeyboardHelpSection({ headingStringProperty: a11y.irisStringProperty }),
        new SliderControlsKeyboardHelpSection(),
      ],
      [
        new BasicActionsKeyboardHelpSection({ withCheckboxContent: true }),
        new ComboBoxKeyboardHelpSection(),
        opticsKeyboardHelp(true),
      ],
    );
  }
}
