import { DerivedProperty, Multilink, PatternStringProperty } from "scenerystack/axon";
import type { Bounds2 } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { HBox, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { RectangularPushButton } from "scenerystack/sun";
import Colors from "../../FourierOpticsColors.js";
import { OPTICS_LAYOUT as L, SCREEN_VIEW_MARGIN } from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS } from "../FourierOpticsButtonOptions.js";
import { FourierOpticsPanel } from "../FourierOpticsPanel.js";
import type { FourierEngineInfo } from "../fourier/createFourierEngine.js";
import type { FourierScreenModel } from "../fourier/FourierScreenModel.js";
import { label } from "./controls.js";

function backendName(value: FourierEngineInfo, gpu: string, cpu: string, fallback: string): string {
  return value.backend === "webgpu" ? gpu : value.degraded ? fallback : cpu;
}

export function backendDescription(model: FourierScreenModel) {
  const strings = StringManager.getInstance().getPreferences();
  return new DerivedProperty(
    [
      model.engineInfoProperty,
      strings.gpuStringProperty,
      strings.cpuStringProperty,
      strings.fallbackStringProperty,
      strings.badgeA11yStringProperty,
    ],
    (value, gpu, cpu, fallback, pattern) =>
      StringUtils.fillIn(pattern, { backend: backendName(value, gpu, cpu, fallback), size: value.size }),
  );
}

export function backendStatus(model: FourierScreenModel, bounds: Bounds2): VBox {
  const strings = StringManager.getInstance().getPreferences();
  const info = model.engineInfoProperty;
  const backendProperty = new DerivedProperty(
    [info, strings.gpuStringProperty, strings.cpuStringProperty, strings.fallbackStringProperty],
    backendName,
  );
  const sizeProperty = new DerivedProperty([info], (value) => value.size);
  const badgeText = new PatternStringProperty(strings.badgeStringProperty, {
    backend: backendProperty,
    size: sizeProperty,
  });
  const badge = label(badgeText, { font: new PhetFont(L.smallFontSize) });
  const children = [badge] as (typeof badge | FourierOpticsPanel)[];
  const dismissed = model.preferences?.noticeDismissedProperty;
  if (dismissed) {
    const reasonProperty = new DerivedProperty(
      [info, strings.unavailableStringProperty, strings.tooSlowStringProperty],
      (value, unavailable, tooSlow) => (value.gpuTooSlow ? tooSlow : unavailable),
    );
    const note = new FourierOpticsPanel(
      new HBox({
        spacing: L.smallGap,
        children: [
          label(reasonProperty, {
            tagName: "p",
            innerContent: reasonProperty,
            font: new PhetFont(L.smallFontSize),
          }),
          new RectangularPushButton({
            ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
            accessibleName: strings.dismissStringProperty,
            accessibleHelpText: strings.dismissHelpStringProperty,
            content: label(strings.dismissStringProperty, { fill: Colors.controlSurfaceTextColorProperty }),
            listener: () => {
              dismissed.value = true;
            },
          }),
        ],
      }),
    );
    const visibility = Multilink.multilink([info, dismissed], (value, hidden) => {
      note.visible = value.degraded && !hidden;
    });
    note.disposeEmitter.addListener(() => {
      visibility.dispose();
      reasonProperty.dispose();
    });
    children.unshift(note);
  }
  const status = new VBox({
    align: "left",
    spacing: L.smallGap,
    children,
    left: bounds.minX + SCREEN_VIEW_MARGIN,
    bottom: bounds.maxY - SCREEN_VIEW_MARGIN,
  });
  badge.disposeEmitter.addListener(() => {
    badgeText.dispose();
    sizeProperty.dispose();
    backendProperty.dispose();
  });
  return status;
}
