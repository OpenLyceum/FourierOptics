import { DerivedProperty, Multilink, PatternStringProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Bounds2, toFixed } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { ModelViewTransform2, StringUtils } from "scenerystack/phetcommon";
import { HBox, Node, Path, Rectangle, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { RectangularPushButton } from "scenerystack/sun";
import {
  FLAT_PANEL_PUSH_BUTTON_OPTIONS,
  FLAT_RESET_ALL_BUTTON_OPTIONS,
} from "../../common/FourierOpticsButtonOptions.js";
import { FourierOpticsPanel } from "../../common/FourierOpticsPanel.js";
import { backendStatus } from "../../common/view/backendStatus.js";
import { checkbox, combo, heading, label, numberControl } from "../../common/view/controls.js";
import { FieldImageNode } from "../../common/view/FieldImageNode.js";
import { FrameRecomputeScheduler } from "../../common/view/FrameRecomputeScheduler.js";
import { LensSchematicNode } from "../../common/view/LensSchematicNode.js";
import Colors from "../../FourierOpticsColors.js";
import {
  FOCAL_VIEW_MM,
  OPTICS_LAYOUT as L,
  MICROMETERS_PER_MILLIMETER,
  SCREEN_VIEW_MARGIN,
} from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { APERTURE_DIMENSIONS, APERTURE_KINDS, type FourierTransformModel } from "../model/FourierTransformModel.js";
import { FourierTransformScreenSummaryContent } from "./FourierTransformScreenSummaryContent.js";

export class FourierTransformScreenView extends ScreenView {
  private readonly scheduler: FrameRecomputeScheduler;

  public constructor(model: FourierTransformModel, providedOptions?: ScreenViewOptions) {
    const summary = new FourierTransformScreenSummaryContent(model);
    super(
      optionize<ScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
        { screenSummaryContent: summary },
        providedOptions,
      ),
    );

    const manager = StringManager.getInstance();
    const strings = manager.getTransformStrings();
    const common = manager.getCommonStrings();
    const fieldSize = L.fieldSize;
    const apertureImage = new FieldImageNode(fieldSize);
    const focalImage = new FieldImageNode(fieldSize, true);
    const focalHeadingProperty = new DerivedProperty(
      [
        model.logProperty,
        model.phaseProperty,
        strings.logPatternStringProperty,
        strings.linearPatternStringProperty,
        strings.phasePatternStringProperty,
      ],
      (isLog, phase, logTitle, linearTitle, phaseTitle) => (phase ? phaseTitle : isLog ? logTitle : linearTitle),
    );
    const focalHeading = heading(focalHeadingProperty, fieldSize);
    focalHeading.disposeEmitter.addListener(() => focalHeadingProperty.dispose());

    const focalLengthLabelProperty = new PatternStringProperty(strings.distanceStringProperty, {
      value: model.focalLengthProperty,
    });
    const schematic = new LensSchematicNode(strings.waveStringProperty, strings.apertureStringProperty, [
      { lens: strings.lensStringProperty, plane: strings.focalPlaneStringProperty, distance: focalLengthLabelProperty },
    ]);
    schematic.disposeEmitter.addListener(() => focalLengthLabelProperty.dispose());

    const barLabelProperty = new DerivedProperty(
      [model.focalStepProperty, model.focalCropProperty, strings.micrometersStringProperty],
      (step, crop, micrometers) =>
        StringUtils.fillIn(micrometers, {
          value: toFixed((step * crop * MICROMETERS_PER_MILLIMETER * L.scaleBarWidth) / fieldSize, 0),
        }),
    );
    const apertureBarLabelProperty = new DerivedProperty(
      [model.apertureCropProperty, strings.micrometersStringProperty],
      (crop, pattern) =>
        StringUtils.fillIn(pattern, {
          value: toFixed((crop * model.pitchUm * L.scaleBarWidth) / fieldSize, 0),
        }),
    );
    const scaleBar = createScaleBar(barLabelProperty);
    const apertureScaleBar = createScaleBar(apertureBarLabelProperty);

    const profileLine = new Path(null, { stroke: Colors.accentColorProperty, lineWidth: L.plotStroke });
    const profileTransform = ModelViewTransform2.createRectangleInvertedYMapping(
      new Bounds2(0, 0, 1, 1),
      new Bounds2(L.plotStroke, L.plotStroke, fieldSize - L.plotStroke, L.chartHeight - L.plotStroke),
    );
    const profile = new VBox({
      spacing: L.smallGap,
      children: [
        label(strings.profileStringProperty, { maxWidth: fieldSize }),
        new Node({
          children: [
            new Rectangle(0, 0, fieldSize, L.chartHeight, { fill: Colors.plotBackgroundColorProperty }),
            profileLine,
          ],
        }),
      ],
    });

    const normalPlayArea = new VBox({
      spacing: L.gap,
      children: [
        schematic,
        new HBox({
          align: "top",
          spacing: L.gap * 2,
          children: [
            new VBox({
              spacing: L.smallGap,
              children: [
                heading(strings.apertureStringProperty, fieldSize),
                apertureImage,
                apertureScaleBar,
                label(strings.narrowerStringProperty, { maxWidth: fieldSize }),
              ],
            }),
            new VBox({
              spacing: L.smallGap,
              children: [focalHeading, focalImage, scaleBar, profile],
            }),
          ],
        }),
      ],
    });

    const swappedImages = [
      { name: strings.objectAStringProperty, field: () => model.objectA },
      { name: strings.objectBStringProperty, field: () => model.objectB },
      { name: strings.resultAStringProperty, field: () => model.reconstructionA },
      { name: strings.resultBStringProperty, field: () => model.reconstructionB },
    ].map(({ name, field }) => {
      const image = new FieldImageNode(L.swapImageSize);
      const tile = new VBox({
        spacing: L.smallGap,
        children: [heading(name, L.swapImageSize), image],
      });
      return { field, image, tile };
    });
    const swapPlayArea = new VBox({
      spacing: L.gap,
      children: [
        new HBox({ spacing: L.gap * 2, children: swappedImages.slice(0, 2).map(({ tile }) => tile) }),
        new HBox({ spacing: L.gap * 2, children: swappedImages.slice(2).map(({ tile }) => tile) }),
        label(strings.swapHintStringProperty, { maxWidth: L.schematicWidth }),
      ],
    });
    const playArea = new VBox({
      children: [normalPlayArea, swapPlayArea],
      minContentWidth: L.schematicWidth,
    });

    const popupLayer = new Node();
    const names = manager.getAperturesStrings();
    const choices = APERTURE_KINDS.map((value) => ({ value, name: names[`${value}StringProperty`] }));
    const dimensionStrings = manager.getDimensionsStrings();
    const dimensionControls = Object.entries(model.dimensions).map(([id, property]) => {
      const key = id as keyof typeof model.dimensions;
      return {
        key,
        node: numberControl(
          dimensionStrings[`${key}StringProperty`],
          property,
          key === "innerRatio" ? 1 : model.pitchUm,
        ),
      };
    });
    const dimensions = new VBox({
      align: "left",
      spacing: L.smallGap,
      children: dimensionControls.map(({ node }) => node),
    });
    const swapControls = new VBox({
      align: "left",
      spacing: L.gap,
      children: [
        combo(strings.objectAStringProperty, model.objectAProperty, choices, popupLayer),
        combo(strings.objectBStringProperty, model.objectBProperty, choices, popupLayer),
      ],
    });
    const log = checkbox(strings.logStringProperty, model.logProperty);
    const tint = checkbox(strings.tintStringProperty, model.tintProperty);
    const exposure = numberControl(common.exposureStringProperty, model.exposureProperty);
    const normalControls = new VBox({
      align: "left",
      spacing: L.smallGap,
      children: [
        combo(strings.apertureStringProperty, model.apertureProperty, choices, popupLayer),
        dimensions,
        numberControl(strings.wavelengthStringProperty, model.wavelengthProperty),
        numberControl(strings.focalLengthStringProperty, model.focalLengthProperty),
        log,
        checkbox(strings.phaseStringProperty, model.phaseProperty),
        tint,
        numberControl(
          strings.fieldOfViewStringProperty,
          model.focalViewProperty,
          FOCAL_VIEW_MM.step,
          strings.fieldOfViewHelpStringProperty,
          model.focalViewRangeProperty,
        ),
        new RectangularPushButton({
          ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
          accessibleName: strings.fitPatternStringProperty,
          accessibleHelpText: strings.fitPatternHelpStringProperty,
          content: label(strings.fitPatternStringProperty, { fill: Colors.controlSurfaceTextColorProperty }),
          listener: () => model.fitPattern(),
        }),
        exposure,
      ],
    });
    const panel = new FourierOpticsPanel(
      new VBox({
        align: "left",
        spacing: L.gap,
        children: [checkbox(strings.swapStringProperty, model.swapProperty), normalControls, swapControls],
      }),
      { minWidth: L.controlWidth },
    );

    const reset = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      accessibleHelpText: manager.getCommonStrings().resetHelpStringProperty,
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
      pdomOrder: [status, panel, reset],
    });
    this.addChild(content);

    const visibility = Multilink.multilink(
      [model.swapProperty, model.apertureProperty, model.logProperty, model.phaseProperty],
      (swap, kind, isLog, isPhase) => {
        normalPlayArea.visible = !swap;
        swapPlayArea.visible = swap;
        normalControls.visible = !swap;
        swapControls.visible = swap;
        log.enabled = !isPhase;
        tint.enabled = !isPhase;
        exposure.visible = isLog && !isPhase;
        const keys: readonly string[] = APERTURE_DIMENSIONS[kind];
        for (const { key, node } of dimensionControls) {
          node.visible = keys.includes(key);
        }
      },
    );

    const displayLink = Multilink.lazyMultilinkAny(
      [
        model.phaseProperty,
        model.logProperty,
        model.tintProperty,
        model.exposureProperty,
        model.wavelengthProperty,
        model.focalLengthProperty,
        model.focalViewProperty,
      ],
      () => model.inputsChangedEmitter.emit(),
    );
    this.scheduler = new FrameRecomputeScheduler(model.inputsChangedEmitter, () =>
      model.submit((ops) => {
        model.recompute(ops);
        if (model.swapProperty.value) {
          const pictures = swappedImages.map(({ image, field }) =>
            image.capture(ops, field(), "intensity", model.apertureCropProperty.value),
          );
          return () => {
            for (const paint of pictures) {
              paint();
            }
          };
        }
        const crop = model.focalCropProperty.value;
        const mode = model.phaseProperty.value ? "phase" : model.logProperty.value ? "log" : "intensity";
        const aperture = apertureImage.capture(ops, model.object, "amplitude", model.apertureCropProperty.value);
        const focal = focalImage.capture(
          ops,
          model.spectrum,
          mode,
          crop,
          model.exposureProperty.value,
          model.tintProperty.value ? model.wavelengthProperty.value : undefined,
        );
        const row = ops.readRow(model.spectrum, crop);
        return () => {
          aperture();
          focal();
          updateProfile(row, profileLine, profileTransform);
        };
      }),
    );

    content.disposeEmitter.addListener(() => {
      this.scheduler.dispose();
      visibility.dispose();
      displayLink.dispose();
    });
  }

  public override step(_dt: number): void {
    this.scheduler.step();
  }
}

function updateProfile(data: Float32Array, line: Path, transform: ModelViewTransform2): void {
  const crop = data.length / 2;
  const dc = Math.abs(data[2 * (crop / 2)] ?? 0);
  const norm = dc > 0 ? 1 / (dc * dc) : 0;
  const shape = new Shape();
  for (let x = 0; x < crop; x++) {
    const index = 2 * x;
    const real = data[index] ?? 0;
    const imaginary = data[index + 1] ?? 0;
    const y = Math.min(1, (real * real + imaginary * imaginary) * norm);
    const viewX = transform.modelToViewX((x + 0.5) / crop);
    const viewY = transform.modelToViewY(y);
    if (x === 0) {
      shape.moveTo(viewX, viewY);
    } else {
      shape.lineTo(viewX, viewY);
    }
  }
  line.shape = shape;
}

function createScaleBar(barLabelProperty: TReadOnlyProperty<string> & { dispose(): void }): VBox {
  const halfBar = L.scaleBarWidth / 2;
  const scaleBar = new VBox({
    spacing: L.smallGap / 2,
    children: [
      new Path(
        new Shape()
          .moveTo(-halfBar, 0)
          .lineTo(-halfBar, L.smallGap)
          .moveTo(-halfBar, L.smallGap / 2)
          .lineTo(halfBar, L.smallGap / 2)
          .moveTo(halfBar, 0)
          .lineTo(halfBar, L.smallGap),
        { stroke: Colors.textColorProperty, lineWidth: L.plotStroke },
      ),
      label(barLabelProperty),
    ],
  });
  scaleBar.disposeEmitter.addListener(() => barLabelProperty.dispose());
  return scaleBar;
}
