import { Multilink, PatternStringProperty, StringProperty } from "scenerystack/axon";
import { toFixed, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { ModelViewTransform2 } from "scenerystack/phetcommon";
import { HBox, Node, Path, Rectangle, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/FourierOpticsButtonOptions.js";
import { FourierOpticsPanel } from "../../common/FourierOpticsPanel.js";
import { backendStatus } from "../../common/view/backendStatus.js";
import { checkbox, combo, heading, label, numberControl } from "../../common/view/controls.js";
import { FieldImageNode } from "../../common/view/FieldImageNode.js";
import { FrameRecomputeScheduler } from "../../common/view/FrameRecomputeScheduler.js";
import { zoomCrop } from "../../common/view/spectrumZoom.js";
import Colors from "../../FourierOpticsColors.js";
import { OPTICS_LAYOUT as L, SCREEN_VIEW_MARGIN } from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { SpatialFrequenciesModel } from "../model/SpatialFrequenciesModel.js";
import { FrequencyHandleNode } from "./FrequencyHandleNode.js";
import {
  createGratingReadout,
  SpatialFrequenciesScreenSummaryContent,
} from "./SpatialFrequenciesScreenSummaryContent.js";

export class SpatialFrequenciesScreenView extends ScreenView {
  private readonly scheduler: FrameRecomputeScheduler;

  public constructor(model: SpatialFrequenciesModel, providedOptions?: ScreenViewOptions) {
    const manager = StringManager.getInstance();
    const strings = manager.getSpatialStrings();
    const common = manager.getCommonStrings();
    const names = [strings.grating1StringProperty, strings.grating2StringProperty, strings.grating3StringProperty];
    const readouts = model.gratings.map((grating, index) =>
      createGratingReadout(model, grating, names[index] ?? strings.grating1StringProperty),
    );
    const summary = new SpatialFrequenciesScreenSummaryContent(model, readouts);
    super(
      optionize<ScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
        { screenSummaryContent: summary },
        providedOptions,
      ),
    );

    const fieldSize = L.fieldSize;
    const crop = zoomCrop(L.spectrumBins, 1, model.size);
    const limit = (model.frequencyStep * crop) / 2;
    const binWidth = fieldSize / crop;
    const centre = fieldSize / 2 + binWidth / 2;
    const transform = ModelViewTransform2.createSinglePointScaleMapping(
      Vector2.ZERO,
      new Vector2(centre, centre),
      binWidth / model.frequencyStep,
    );
    const objectImage = new FieldImageNode(fieldSize);
    const spectrumImage = new FieldImageNode(fieldSize);
    const axes = new Path(
      new Shape()
        .moveTo(0, centre)
        .lineTo(centre - L.smallGap, centre)
        .moveTo(centre + L.smallGap, centre)
        .lineTo(fieldSize, centre)
        .moveTo(centre, 0)
        .lineTo(centre, centre - L.smallGap)
        .moveTo(centre, centre + L.smallGap)
        .lineTo(centre, fieldSize),
      { stroke: Colors.imageAxisColorProperty, lineWidth: L.plotStroke, opacity: 0.55, pickable: false },
    );
    const colors = [
      Colors.firstGratingColorProperty,
      Colors.secondGratingColorProperty,
      Colors.thirdGratingColorProperty,
    ];
    const handles = model.gratings.map((grating, index) => {
      const readout = readouts[index];
      if (!readout) {
        throw new Error("Each grating needs a frequency readout.");
      }
      return new FrequencyHandleNode(
        model,
        grating,
        index,
        transform,
        readout,
        colors[index] ?? Colors.accentColorProperty,
      );
    });
    const rangeProperty = new PatternStringProperty(strings.axesRangeStringProperty, { limit: toFixed(limit, 3) });
    const spectrum = new Node({
      children: [
        spectrumImage,
        axes,
        ...handles,
        label(strings.dcStringProperty, {
          fill: Colors.imageLabelColorProperty,
          left: centre + L.smallGap,
          top: centre + L.smallGap,
          pickable: false,
        }),
      ],
    });
    const images = new HBox({
      spacing: L.gap * 2,
      align: "top",
      children: [
        new VBox({
          spacing: L.smallGap,
          children: [heading(common.objectStringProperty, fieldSize), objectImage],
        }),
        new VBox({
          spacing: L.smallGap,
          children: [
            heading(strings.spectrumStringProperty, fieldSize),
            new HBox({
              spacing: L.smallGap,
              children: [label(strings.yAxisStringProperty, { rotation: -Math.PI / 2, maxWidth: fieldSize }), spectrum],
            }),
            label(strings.xAxisStringProperty),
            label(rangeProperty),
          ],
        }),
      ],
    });

    const rows = readouts.map((readoutProperty) => label(readoutProperty, { maxWidth: fieldSize * 2 }));
    const readoutList = new VBox({ align: "left", spacing: L.smallGap, children: rows });
    const harmonics = createHarmonicsChart(model);
    const playArea = new VBox({
      align: "left",
      spacing: L.gap,
      children: [images, readoutList, harmonics],
    });

    const popupLayer = new Node();
    const preset = combo(
      strings.presetStringProperty,
      model.barsProperty,
      [
        { value: false, name: strings.gratingsStringProperty },
        { value: true, name: strings.barsStringProperty },
      ],
      popupLayer,
    );
    const editorControls = model.gratings.map(
      (grating) =>
        new VBox({
          align: "left",
          spacing: L.smallGap,
          children: [
            numberControl(strings.periodStringProperty, grating.periodProperty, 0.01),
            numberControl(strings.orientationStringProperty, grating.angleProperty, 0.1),
            numberControl(strings.contrastStringProperty, grating.contrastProperty, 0.01),
            numberControl(strings.phaseStringProperty, grating.phaseProperty),
          ],
        }),
    );
    const editor = new VBox({
      align: "left",
      spacing: L.gap,
      children: [
        ...model.gratings.map((grating, index) =>
          checkbox(names[index] ?? strings.grating1StringProperty, grating.enabledProperty),
        ),
        combo(
          strings.editingStringProperty,
          model.selectedGratingProperty,
          names.map((name, value) => ({ name, value })),
          popupLayer,
        ),
        ...editorControls,
      ],
    });
    const panel = new FourierOpticsPanel(
      new VBox({
        align: "left",
        spacing: L.gap,
        children: [preset, editor, numberControl(common.exposureStringProperty, model.exposureProperty)],
      }),
      { minWidth: L.controlWidth },
    );
    const reset = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
      listener: () => {
        this.interruptSubtreeInput();
        model.reset();
      },
    });
    const interfaceRow = new HBox({
      align: "top",
      spacing: L.gap * 3,
      children: [playArea, panel],
      centerX: this.layoutBounds.centerX,
      top: this.layoutBounds.minY + SCREEN_VIEW_MARGIN,
    });
    const status = backendStatus(model, this.layoutBounds);
    const content = new Node({
      children: [interfaceRow, reset, popupLayer, status],
      pdomOrder: [status, panel, ...handles, reset],
    });
    this.addChild(content);

    const visibility = Multilink.multilinkAny(
      [model.barsProperty, model.selectedGratingProperty, ...model.gratings.map((grating) => grating.enabledProperty)],
      () => {
        const bars = model.barsProperty.value;
        const selected = model.selectedGratingProperty.value;
        editor.visible = !bars;
        harmonics.visible = bars;
        readoutList.visible = !bars;
        editorControls.forEach((node, index) => {
          node.visible = index === selected;
        });
        rows.forEach((row, index) => {
          row.visible = model.gratings[index]?.enabledProperty.value ?? false;
        });
      },
    );
    const displayChanged = () => model.inputsChangedEmitter.emit();
    model.exposureProperty.lazyLink(displayChanged);
    this.scheduler = new FrameRecomputeScheduler(model.inputsChangedEmitter, () =>
      model.submit((ops) => {
        model.recompute(ops);
        const paintObject = objectImage.capture(ops, model.object, "amplitude");
        const paintSpectrum = spectrumImage.capture(
          ops,
          model.spectrum,
          "log",
          zoomCrop(L.spectrumBins, 1, model.size),
          model.exposureProperty.value,
        );
        return () => {
          paintObject();
          paintSpectrum();
        };
      }),
    );
    content.disposeEmitter.addListener(() => {
      visibility.dispose();
      this.scheduler.dispose();
      model.exposureProperty.unlink(displayChanged);
    });
    spectrum.disposeEmitter.addListener(() => rangeProperty.dispose());
    summary.disposeEmitter.addListener(() => {
      for (const readout of readouts) {
        readout.dispose();
      }
    });
  }

  public override step(_dt: number): void {
    this.scheduler.step();
  }
}

function createHarmonicsChart(model: SpatialFrequenciesModel): Node {
  const strings = StringManager.getInstance().getSpatialStrings();
  const height = L.chartHeight;
  const spacing = (L.fieldSize * 2) / (model.harmonics.length + 1);
  const bars = new Node({
    children: [new Rectangle(0, 0, L.fieldSize * 2, height, { fill: Colors.plotBackgroundColorProperty })],
  });
  for (const { order, amplitude } of model.harmonics) {
    const x = order * spacing;
    const y = height - amplitude * (height - L.gap * 1.5);
    const orderProperty = new StringProperty(String(order));
    const amplitudeProperty = new StringProperty(order === 1 ? "1" : `1/${order}`);
    bars.addChild(label(orderProperty, { centerX: x, top: height + L.smallGap }));
    if (amplitude > 0) {
      bars.addChild(new Rectangle(x - L.gap / 3, y, (L.gap * 2) / 3, height - y, { fill: Colors.accentColorProperty }));
      bars.addChild(label(amplitudeProperty, { centerX: x, bottom: y - L.smallGap / 2 }));
    }
    bars.disposeEmitter.addListener(() => {
      orderProperty.dispose();
      amplitudeProperty.dispose();
    });
  }
  return new VBox({
    spacing: L.smallGap,
    children: [
      heading(strings.harmonicsStringProperty, L.fieldSize * 2),
      bars,
      label(strings.harmonicOrderStringProperty),
    ],
  });
}
