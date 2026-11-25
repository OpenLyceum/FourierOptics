import {
  BasicActionsKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";

export class SpatialFrequenciesKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const strings = StringManager.getInstance().getSpatialFrequenciesA11yStrings();
    super(
      [
        new MoveDraggableItemsKeyboardHelpSection({ headingStringProperty: strings.handleHelpHeadingStringProperty }),
        new SliderControlsKeyboardHelpSection(),
      ],
      [new BasicActionsKeyboardHelpSection()],
    );
  }
}
