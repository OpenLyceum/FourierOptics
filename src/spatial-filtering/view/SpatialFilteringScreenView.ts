import { DerivedProperty, Multilink, PatternStringProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { HBox, LinearGradient, Node, Rectangle, RichText, VBox } from "scenerystack/scenery";
import { PhetFont, ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/FourierOpticsButtonOptions.js";
import { FourierOpticsPanel } from "../../common/FourierOpticsPanel.js";
import { FILTER_OBJECTS } from "../../common/model/imagingObjects.js";
import { backendStatus } from "../../common/view/backendStatus.js";
import { checkbox, combo, heading, label, numberControl, zoomControl } from "../../common/view/controls.js";
import { FieldImageNode } from "../../common/view/FieldImageNode.js";
import { FrameRecomputeScheduler } from "../../common/view/FrameRecomputeScheduler.js";
import { MaskEditorNode } from "../../common/view/MaskEditorNode.js";
import { zoomCrop } from "../../common/view/spectrumZoom.js";
import Colors from "../../FourierOpticsColors.js";
import {
  FILTER_PARAMETERS,
  IMAGING_LAYOUT as I,
  OPTICS_LAYOUT as L,
  SCREEN_VIEW_MARGIN,
} from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { FILTER_KINDS, FILTER_PRESETS, type SpatialFilteringModel } from "../model/SpatialFilteringModel.js";
import { SpatialFilteringScreenSummaryContent } from "./SpatialFilteringScreenSummaryContent.js";

export class SpatialFilteringScreenView extends ScreenView {
  private readonly scheduler: FrameRecomputeScheduler;

  public constructor(model: SpatialFilteringModel, options: ScreenViewOptions) {
    super({ screenSummaryContent: new SpatialFilteringScreenSummaryContent(model), ...options });
    const manager = StringManager.getInstance();
    const strings = manager.getFilteringStrings();
    const common = manager.getCommonStrings();
    const objectNames = manager.getImagingObjectStrings();
    const filterNames = manager.getFilterStrings();
    const presetNames = manager.getFilterPresetStrings();
    const captions = manager.getFilterCaptions();
    const transform = manager.getTransformStrings();

    const object = new FieldImageNode(I.fieldSize);
    const spectrum = new FieldImageNode(I.fieldSize);
    const result = new FieldImageNode(I.fieldSize);
    const editor = new MaskEditorNode(I.fieldSize, I.filterBins, model.size, {
      radiusProperty: model.radiusProperty,
      innerRadiusProperty: model.innerRadiusProperty,
      slitWidthProperty: model.slitWidthProperty,
      slitAngleProperty: model.slitAngleProperty,
      brushRadiusProperty: model.brushRadiusProperty,
      getMask: () => model.getMask(),
      paint: (point, previous) => model.paint(point.x, point.y, previous.x, previous.y),
    });

    const popup = new Node();
    const preset = combo(
      strings.presetStringProperty,
      model.presetProperty,
      FILTER_PRESETS.map((value) => ({ value, name: presetNames[`${value}StringProperty`] })),
      popup,
    );
    const objectChoice = combo(
      common.objectStringProperty,
      model.objectProperty,
      FILTER_OBJECTS.map((value) => ({ value, name: objectNames[`${value}StringProperty`] })),
      popup,
    );
    const filter = combo(
      strings.filterStringProperty,
      model.filterProperty,
      FILTER_KINDS.map((value) => ({ value, name: filterNames[`${value}StringProperty`] })),
      popup,
    );
    const display = new VBox({
      align: "left",
      spacing: L.smallGap,
      children: [
        checkbox(strings.logStringProperty, model.logProperty),
        checkbox(transform.phaseStringProperty, model.phaseProperty),
        zoomControl(model.zoomProperty),
      ],
    });
    const brush = new VBox({
      align: "left",
      spacing: L.smallGap,
      children: [
        checkbox(strings.eraseStringProperty, model.eraseProperty),
        numberControl(strings.brushRadiusStringProperty, model.brushRadiusProperty),
      ],
    });
    const tools = new HBox({
      spacing: L.gap * 2,
      align: "top",
      excludeInvisibleChildrenFromBounds: false,
      children: [display, brush],
    });
    const controls = new FourierOpticsPanel(
      new VBox({
        align: "left",
        spacing: L.gap,
        children: [new HBox({ spacing: L.gap * 2, align: "top", children: [preset, objectChoice, filter] }), tools],
      }),
    );

    const captionProperty = DerivedProperty.deriveAny(
      [model.filterProperty, ...Object.values(captions)],
      () => captions[`${model.filterProperty.value}StringProperty`].value,
    );
    const powerProperty = new DerivedProperty([model.transmittedProperty], (fraction) => toFixed(fraction * 100, 1));
    const powerLabelProperty = new PatternStringProperty(strings.powerStringProperty, { power: powerProperty });
    const objectHeadingProperty = new DerivedProperty(
      [model.objectProperty, common.objectStringProperty, strings.phaseObjectStringProperty],
      (kind, normal, phase) => (kind === "phaseDisk" ? phase : normal),
    );
    const phaseScaleProperty = new PatternStringProperty(strings.phaseScaleStringProperty, {
      limit: FILTER_PARAMETERS.weakPhase,
    });
    const phaseLegend = new VBox({
      spacing: L.smallGap / 2,
      children: [
        new Rectangle(0, 0, L.scaleBarWidth, L.smallGap, {
          fill: new LinearGradient(0, 0, L.scaleBarWidth, 0)
            .addColorStop(0, Colors.negativePhaseColorProperty)
            .addColorStop(0.5, Colors.zeroPhaseColorProperty)
            .addColorStop(1, Colors.positivePhaseColorProperty),
        }),
        label(phaseScaleProperty, { tagName: "p" }),
      ],
    });
    const panels = new HBox({
      align: "top",
      spacing: L.gap,
      children: [
        imagePanel(objectHeadingProperty, object, phaseLegend),
        imagePanel(strings.fourierPlaneStringProperty, new Node({ children: [spectrum, editor] })),
        imagePanel(
          strings.reconstructedStringProperty,
          result,
          new VBox({
            spacing: L.smallGap,
            children: [
              new RichText(captionProperty, {
                lineWrap: I.fieldSize,
                font: new PhetFont(L.labelFontSize),
                fill: Colors.textColorProperty,
              }),
              label(powerLabelProperty, { maxWidth: I.fieldSize }),
            ],
          }),
        ),
      ],
    });
    const body = new VBox({
      spacing: L.gap,
      children: [panels, controls],
      centerX: this.layoutBounds.centerX,
      top: this.layoutBounds.minY + SCREEN_VIEW_MARGIN,
    });
    const reset = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      accessibleHelpText: manager.getCommonStrings().resetHelpStringProperty,
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
      listener: () => {
        this.interruptSubtreeInput();
        model.reset();
        editor.reset();
      },
    });
    const status = backendStatus(model, this.layoutBounds);
    const content = new Node({ children: [body, reset, popup, status], pdomOrder: [status, controls, editor, reset] });
    this.addChild(content);

    const displayLink = Multilink.lazyMultilinkAny([model.logProperty, model.phaseProperty, model.zoomProperty], () =>
      model.inputsChangedEmitter.emit(),
    );
    const showBrush = (kind: typeof model.filterProperty.value) => {
      brush.visible = kind === "painted";
    };
    model.filterProperty.link(showBrush);
    const updateLegend = (kind: typeof model.objectProperty.value) => {
      phaseLegend.visible = kind === "phaseDisk";
    };
    model.objectProperty.link(updateLegend);
    this.scheduler = new FrameRecomputeScheduler(
      model.inputsChangedEmitter,
      () =>
        model.submit((ops) => {
          const transmission = model.recompute(ops, true);
          const readout = model.capturePower(ops);
          const crop = zoomCrop(I.filterBins, model.zoomProperty.value, model.size);
          const mode = model.phaseProperty.value ? "phase" : model.logProperty.value ? "log" : "intensity";
          const paintObject =
            model.objectProperty.value === "phaseDisk"
              ? () => object.paintObjectPhase(model.object, FILTER_PARAMETERS.weakPhase)
              : object.capture(ops, model.object, "intensity");
          const paintSpectrum = spectrum.capture(ops, model.spectrum, mode, crop);
          const paintResult = result.capture(ops, model.reconstructed, "intensity");
          const mask = model.getMask();
          const size = model.size;
          return () => {
            readout();
            paintObject();
            paintSpectrum();
            editor.update(mask, transmission, crop, size);
            paintResult();
          };
        }),
      model.preferences?.timing
        ? () => `screen3 ${model.engineInfoProperty.value.backend} ${model.size} coherent`
        : undefined,
    );
    content.disposeEmitter.addListener(() => {
      this.scheduler.dispose();
      model.filterProperty.unlink(showBrush);
      displayLink.dispose();
      model.objectProperty.unlink(updateLegend);
      phaseScaleProperty.dispose();
      objectHeadingProperty.dispose();
      powerLabelProperty.dispose();
      powerProperty.dispose();
      captionProperty.dispose();
    });
  }

  public override step(_dt: number): void {
    this.scheduler.step();
  }
}

function imagePanel(name: Parameters<typeof heading>[0], image: Node, details?: Node): FourierOpticsPanel {
  return new FourierOpticsPanel(
    new VBox({
      spacing: L.smallGap,
      children: [heading(name, I.fieldSize), image, ...(details ? [details] : [])],
    }),
  );
}
