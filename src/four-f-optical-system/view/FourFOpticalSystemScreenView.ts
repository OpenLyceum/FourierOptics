import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { HBox, Node, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { AquaRadioButtonGroup } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/FourierOpticsButtonOptions.js";
import { FourierOpticsPanel } from "../../common/FourierOpticsPanel.js";
import { backendStatus } from "../../common/view/backendStatus.js";
import { combo, heading, label, numberControl, zoomControl } from "../../common/view/controls.js";
import { FieldImageNode } from "../../common/view/FieldImageNode.js";
import { FrameRecomputeScheduler } from "../../common/view/FrameRecomputeScheduler.js";
import { LensSchematicNode } from "../../common/view/LensSchematicNode.js";
import { MaskEditorNode } from "../../common/view/MaskEditorNode.js";
import { zoomCrop } from "../../common/view/spectrumZoom.js";
import { IMAGING_LAYOUT as I, OPTICS_LAYOUT as L, SCREEN_VIEW_MARGIN } from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { type FourFOpticalSystemModel, ILLUMINATION, SYSTEM_OBJECTS } from "../model/FourFOpticalSystemModel.js";
import { FourFOpticalSystemScreenSummaryContent } from "./FourFOpticalSystemScreenSummaryContent.js";

export class FourFOpticalSystemScreenView extends ScreenView {
  private readonly scheduler: FrameRecomputeScheduler;

  public constructor(model: FourFOpticalSystemModel, options: ScreenViewOptions) {
    super({ screenSummaryContent: new FourFOpticalSystemScreenSummaryContent(model), ...options });
    const manager = StringManager.getInstance();
    const strings = manager.getFourFStrings();
    const a11y = manager.getFourFOpticalSystemA11yStrings();
    const common = manager.getCommonStrings();
    const filtering = manager.getFilteringStrings();
    const objects = manager.getImagingObjectStrings();

    const presetZoom = (value: typeof model.objectProperty.value) => {
      model.zoomProperty.value = value === "letterF" ? 4 : 2;
    };
    model.objectProperty.link(presetZoom);
    const displayChanged = () => model.inputsChangedEmitter.emit();
    model.zoomProperty.lazyLink(displayChanged);
    const diagram = new LensSchematicNode({
      f1: model.f1Property,
      f2: model.f2Property,
      iris: model.irisProperty,
      defocus: model.defocusProperty,
      stations: [
        strings.objectPlaneStringProperty,
        strings.lens1StringProperty,
        filtering.fourierPlaneStringProperty,
        strings.lens2StringProperty,
        strings.cameraStringProperty,
      ],
      distances: [
        strings.f1SymbolStringProperty,
        strings.f1SymbolStringProperty,
        strings.f2SymbolStringProperty,
        strings.f2SymbolStringProperty,
      ],
      irisName: a11y.irisStringProperty,
      irisHelp: a11y.irisHelpStringProperty,
    });
    const object = new FieldImageNode(I.fieldSize);
    const spectrum = new FieldImageNode(I.fieldSize);
    const iris = new MaskEditorNode(I.fieldSize, I.irisBins, model.size);
    const camera = new FieldImageNode(I.fieldSize);

    const picture = (title: Parameters<typeof heading>[0], image: Node, detail: Parameters<typeof label>[0]) =>
      new FourierOpticsPanel(
        new VBox({
          spacing: L.smallGap,
          children: [heading(title, I.fieldSize), image, label(detail, { maxWidth: I.fieldSize })],
        }),
      );
    const panels = new HBox({
      spacing: L.gap,
      align: "top",
      children: [
        picture(common.objectStringProperty, object, strings.objectIntensityStringProperty),
        picture(
          filtering.fourierPlaneStringProperty,
          new Node({ children: [spectrum, iris] }),
          strings.irisCutoffStringProperty,
        ),
        picture(strings.cameraImageStringProperty, camera, strings.fixedViewStringProperty),
      ],
    });

    const popup = new Node();
    const objectChoice = combo(
      common.objectStringProperty,
      model.objectProperty,
      SYSTEM_OBJECTS.map((value) => ({ value, name: objects[`${value}StringProperty`] })),
      popup,
    );
    const illumination = new AquaRadioButtonGroup(
      model.illuminationProperty,
      ILLUMINATION.map((value) => ({
        value,
        createNode: () => label(strings[`${value}StringProperty`]),
        options: { accessibleName: strings[`${value}StringProperty`] },
      })),
      { accessibleName: strings.illuminationStringProperty, tandem: Tandem.OPT_OUT },
    );
    const lensControls = new VBox({
      spacing: L.smallGap,
      align: "left",
      children: [
        numberControl(strings.f1StringProperty, model.f1Property),
        numberControl(strings.f2StringProperty, model.f2Property),
      ],
    });
    const irisControls = new VBox({
      spacing: L.smallGap,
      align: "left",
      children: [
        numberControl(strings.irisStringProperty, model.irisProperty, 0.01),
        numberControl(strings.defocusStringProperty, model.defocusProperty, 0.1),
      ],
    });
    const illumControls = new VBox({
      spacing: L.smallGap,
      align: "left",
      children: [
        label(strings.illuminationStringProperty),
        illumination,
        numberControl(manager.getTransformStrings().wavelengthStringProperty, model.wavelengthProperty),
      ],
    });
    const controls = new FourierOpticsPanel(
      new HBox({
        spacing: L.gap,
        align: "top",
        children: [
          new VBox({ align: "left", spacing: L.smallGap, children: [objectChoice, zoomControl(model.zoomProperty)] }),
          lensControls,
          irisControls,
          illumControls,
        ],
      }),
    );

    const mProperty = new DerivedProperty([model.magnificationProperty], (value) => toFixed(value, 2));
    const cutoffProperty = new DerivedProperty([model.coherentCutoffProperty], (value) => toFixed(value, 4));
    const incoherentProperty = new DerivedProperty([model.incoherentCutoffProperty], (value) => toFixed(value, 4));
    const periodProperty = new DerivedProperty([model.periodProperty], (value) =>
      Number.isFinite(value) ? toFixed(value, 1) : "∞",
    );
    const mTextProperty = new PatternStringProperty(strings.magnificationStringProperty, { value: mProperty });
    const cutoffTextProperty = new PatternStringProperty(strings.cutoffStringProperty, { value: cutoffProperty });
    const incoherentTextProperty = new PatternStringProperty(strings.incoherentCutoffStringProperty, {
      value: incoherentProperty,
    });
    const periodTextProperty = new PatternStringProperty(strings.periodStringProperty, { value: periodProperty });
    const incoherentLabel = label(incoherentTextProperty);
    const note = label(strings.incoherentNoteStringProperty, { maxWidth: I.schematicWidth });
    const readouts = new FourierOpticsPanel(
      new VBox({
        spacing: L.smallGap,
        align: "left",
        children: [
          new HBox({
            spacing: L.gap,
            children: [label(mTextProperty), label(cutoffTextProperty), incoherentLabel, label(periodTextProperty)],
          }),
          note,
        ],
      }),
    );
    const updateIllumination = (value: typeof model.illuminationProperty.value) => {
      incoherentLabel.visible = note.visible = value === "incoherent";
    };
    model.illuminationProperty.link(updateIllumination);
    const body = new VBox({
      spacing: L.smallGap,
      children: [diagram, panels, controls, readouts],
      centerX: this.layoutBounds.centerX,
      top: this.layoutBounds.minY + SCREEN_VIEW_MARGIN / 2,
    });
    const reset = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
      listener: () => {
        this.interruptSubtreeInput();
        model.reset();
      },
    });
    const status = backendStatus(model, this.layoutBounds);
    const content = new Node({ children: [body, reset, popup, status], pdomOrder: [status, controls, diagram, reset] });
    this.addChild(content);
    this.scheduler = new FrameRecomputeScheduler(
      model.inputsChangedEmitter,
      () =>
        model.submit((ops) => {
          const pupil = model.recompute(ops);
          const crop = zoomCrop(I.irisBins, model.zoomProperty.value, model.size);
          const size = model.size;
          const radius = model.pupilRadiusProperty.value;
          const paintObject = object.capture(ops, model.object, "intensity");
          const paintSpectrum = spectrum.capture(ops, model.spectrum, "log", crop);
          const paintCamera = camera.capture(ops, model.camera, "intensity");
          return () => {
            paintObject();
            paintSpectrum();
            iris.update({ kind: "lowPass", radius }, pupil, crop, size);
            paintCamera();
          };
        }),
      model.preferences?.timing
        ? () => `screen4 ${model.engineInfoProperty.value.backend} ${model.size} ${model.illuminationProperty.value}`
        : undefined,
    );
    content.disposeEmitter.addListener(() => {
      this.scheduler.dispose();
      model.objectProperty.unlink(presetZoom);
      model.zoomProperty.unlink(displayChanged);
      model.illuminationProperty.unlink(updateIllumination);
      for (const property of [
        mTextProperty,
        cutoffTextProperty,
        incoherentTextProperty,
        periodTextProperty,
        mProperty,
        cutoffProperty,
        incoherentProperty,
        periodProperty,
      ]) {
        property.dispose();
      }
    });
  }

  public override step(_dt: number): void {
    this.scheduler.step();
  }
}
