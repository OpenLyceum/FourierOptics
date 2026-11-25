import {
  BasicActionsKeyboardHelpSection,
  KeyboardHelpSection,
  KeyboardHelpSectionRow,
  MoveDraggableItemsKeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { BRUSH_STAMP_HOTKEY } from "../../common/view/MaskEditorNode.js";
import { StringManager } from "../../i18n/StringManager.js";

export class SpatialFilteringKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const a11y = StringManager.getInstance().getSpatialFilteringA11yStrings();
    super(
      [
        new MoveDraggableItemsKeyboardHelpSection({ headingStringProperty: a11y.moveHeadingStringProperty }),
        new KeyboardHelpSection(a11y.brushStringProperty, [KeyboardHelpSectionRow.fromHotkeyData(BRUSH_STAMP_HOTKEY)]),
      ],
      [new SliderControlsKeyboardHelpSection(), new BasicActionsKeyboardHelpSection()],
    );
  }
}
