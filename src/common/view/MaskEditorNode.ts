import type { NumberProperty } from "scenerystack/axon";
import { Bounds2, clamp, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import {
  CanvasNode,
  Circle,
  DragListener,
  HotkeyData,
  InteractiveHighlighting,
  KeyboardDragListener,
  KeyboardListener,
  Node,
  Path,
  Rectangle,
} from "scenerystack/scenery";
import Colors from "../../FourierOpticsColors.js";
import { IMAGING_LAYOUT as I, OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { MaskSpec } from "../model/masks.js";
import { OpticsDragHandle } from "./OpticsDragHandle.js";
import { spectrumTransform } from "./spectrumZoom.js";

const a11y = StringManager.getInstance().getSpatialFilteringA11yStrings();
export const BRUSH_STAMP_HOTKEY = new HotkeyData({
  keys: ["space", "enter"],
  repoName: "fourier-optics",
  keyboardHelpDialogLabelStringProperty: a11y.stampStringProperty,
  keyboardHelpDialogPDOMLabelStringProperty: a11y.brushHelpStringProperty,
});

type MaskEditing = {
  radiusProperty: NumberProperty;
  innerRadiusProperty: NumberProperty;
  slitWidthProperty: NumberProperty;
  slitAngleProperty: NumberProperty;
  brushRadiusProperty: NumberProperty;
  getMask: () => MaskSpec;
  paint: (point: Vector2, previous: Vector2) => void;
};

/** Shares FieldImageNode's centered crop and half-pixel bin-center convention. */
export class MaskEditorNode extends Node {
  private readonly shade: MaskShade;
  private readonly outline: Path;
  private binTransform: ModelViewTransform2;
  private readonly drawSize: number;
  private refreshBrush: (() => void) | undefined;
  private readonly updateHandles: ((spec: MaskSpec) => void) | undefined;
  private resetCursor: (() => void) | undefined;

  public constructor(drawSize: number, cropSize: number, size: number, editing?: MaskEditing) {
    super({ clipArea: Shape.rect(0, 0, drawSize, drawSize), pickable: editing ? null : false });
    this.drawSize = drawSize;
    this.binTransform = spectrumTransform(drawSize, cropSize);
    this.shade = new MaskShade(drawSize, cropSize, size);
    this.outline = new Path(null, {
      stroke: Colors.maskOutlineColorProperty,
      lineWidth: L.plotStroke,
      pickable: false,
    });
    this.children = [this.shade, this.outline];
    this.updateHandles = editing ? this.createTools(editing, drawSize) : undefined;
  }

  public update(spec: MaskSpec, transmission: Float32Array, crop = this.shade.cropSize, size = this.shade.size): void {
    if (crop !== this.shade.cropSize || size !== this.shade.size) {
      this.binTransform = spectrumTransform(this.drawSize, crop);
      this.shade.setGrid(crop, size);
      this.refreshBrush?.();
    }
    this.shade.update(transmission);
    this.updateHandles?.(spec);
    const centre = this.binTransform.modelToViewPosition(Vector2.ZERO);
    const circle = (radius: number) =>
      Shape.circle(centre.x, centre.y, Math.max(L.plotStroke, this.binTransform.modelToViewDeltaX(radius)));
    this.outline.shape = null;
    switch (spec.kind) {
      case "open":
      case "painted":
        break;
      case "lowPass":
      case "highPass":
      case "phaseDot":
      case "dcBlock":
        this.outline.shape = circle(spec.radius);
        break;
      case "bandPass":
        this.outline.shape =
          spec.inner > 0
            ? circle(spec.outer).circle(centre, this.binTransform.modelToViewDeltaX(spec.inner))
            : circle(spec.outer);
        break;
      case "slit": {
        const far = this.shade.cropSize;
        const shape = new Shape();
        for (const side of [-1, 1]) {
          const edge = Vector2.createPolar((side * spec.width) / 2, spec.angle);
          const along = Vector2.createPolar(far, spec.angle + Math.PI / 2);
          const a = this.binTransform.modelToViewPosition(edge.minus(along));
          const b = this.binTransform.modelToViewPosition(edge.plus(along));
          shape.moveTo(a.x, a.y).lineTo(b.x, b.y);
        }
        this.outline.shape = shape;
        break;
      }
    }
  }

  public reset(): void {
    this.resetCursor?.();
  }

  private createTools(edit: MaskEditing, drawSize: number): (spec: MaskSpec) => void {
    const set = (property: NumberProperty, value: number) => {
      property.value = clamp(value, property.range.min, property.range.max);
    };
    const handle = (name: typeof a11y.radiusStringProperty, move: (point: Vector2) => void) => {
      const node = new OpticsDragHandle(name, a11y.dragHelpStringProperty, () => this.binTransform, move);
      this.addChild(node);
      return node;
    };
    const outer = handle(a11y.radiusStringProperty, (point) => {
      const minimum = edit.getMask().kind === "bandPass" ? edit.innerRadiusProperty.value + 1 : 0;
      set(edit.radiusProperty, Math.max(minimum, point.x));
    });
    const inner = handle(a11y.innerRadiusStringProperty, (point) => {
      set(edit.innerRadiusProperty, Math.min(edit.radiusProperty.value - 1, -point.x));
    });
    const width = handle(a11y.slitWidthStringProperty, (point) => {
      const spec = edit.getMask();
      if (spec.kind === "slit") {
        set(edit.slitWidthProperty, 2 * point.dot(Vector2.createPolar(1, spec.angle)));
      }
    });
    const angle = handle(a11y.slitAngleStringProperty, (point) => {
      const spec = edit.getMask();
      if (spec.kind === "slit" && point.magnitude > 0) {
        const base = spec.angle - (edit.slitAngleProperty.value * Math.PI) / 180;
        const degrees = ((point.angle - Math.PI / 2 - base) * 180) / Math.PI;
        set(edit.slitAngleProperty, ((degrees + 540) % 360) - 180);
      }
    });
    const brush = this.createBrush(edit, drawSize);

    return (spec) => {
      outer.visible = spec.kind === "lowPass" || spec.kind === "highPass" || spec.kind === "bandPass";
      inner.visible = spec.kind === "bandPass";
      width.visible = spec.kind === "slit";
      angle.visible = spec.kind === "slit";
      brush.visible = spec.kind === "painted";
      if (spec.kind === "lowPass" || spec.kind === "highPass" || spec.kind === "bandPass") {
        outer.translation = this.binTransform.modelToViewPosition(
          new Vector2(spec.kind === "bandPass" ? spec.outer : spec.radius, 0),
        );
        if (spec.kind === "bandPass") {
          inner.translation = this.binTransform.modelToViewPosition(new Vector2(-spec.inner, 0));
        }
      } else if (spec.kind === "slit") {
        width.translation = this.binTransform.modelToViewPosition(Vector2.createPolar(spec.width / 2, spec.angle));
        angle.translation = this.binTransform.modelToViewPosition(
          Vector2.createPolar(this.binTransform.viewToModelDeltaX(I.angleHandleRadius), spec.angle + Math.PI / 2),
        );
      }
    };
  }

  private createBrush(edit: MaskEditing, drawSize: number): Node {
    const target = new (InteractiveHighlighting(Rectangle))(0, 0, drawSize, drawSize, {
      tagName: "div",
      ariaRole: "button",
      focusable: true,
      accessibleName: a11y.brushStringProperty,
      accessibleHelpText: a11y.brushHelpStringProperty,
      cursor: "crosshair",
    });
    const ring = new Circle(L.handleRadius, {
      stroke: Colors.secondGratingColorProperty,
      lineWidth: L.plotStroke,
      pickable: false,
    });
    target.mouseArea = target.touchArea = Shape.rect(0, 0, drawSize, drawSize);
    target.addChild(ring);
    this.addChild(target);
    let point = Vector2.ZERO;
    const move = (next: Vector2) => {
      const low = this.binTransform.viewToModelPosition(Vector2.ZERO).plusXY(0.5, 0.5);
      const high = this.binTransform.viewToModelPosition(new Vector2(drawSize, drawSize)).minusXY(0.5, 0.5);
      point = new Vector2(clamp(next.x, low.x, high.x), clamp(next.y, low.y, high.y));
      ring.translation = this.binTransform.modelToViewPosition(point);
    };
    const paint = (next: Vector2, connect: boolean) => {
      const previous = point;
      move(next);
      edit.paint(point, connect ? previous : point);
    };
    const pointer = new DragListener({
      applyOffset: false,
      start: (_event, drag) => paint(this.binTransform.viewToModelPosition(drag.parentPoint), false),
      drag: (_event, drag) => paint(this.binTransform.viewToModelPosition(drag.parentPoint), true),
    });
    const keyboard = new KeyboardDragListener({
      dragDelta: L.handleStep,
      shiftDragDelta: L.fineHandleStep,
      drag: (_event, drag) => move(point.plus(this.binTransform.viewToModelDelta(drag.modelDelta))),
    });
    const stamp = new KeyboardListener({
      keyStringProperties: BRUSH_STAMP_HOTKEY.keyStringProperties,
      fire: (event) => {
        event?.preventDefault();
        edit.paint(point, point);
      },
    });
    target.addInputListener(pointer);
    target.addInputListener(keyboard);
    target.addInputListener(stamp);
    const resize = (radius: number) => {
      ring.radius = this.binTransform.modelToViewDeltaX(radius);
    };
    edit.brushRadiusProperty.link(resize);
    this.refreshBrush = () => {
      move(point);
      resize(edit.brushRadiusProperty.value);
    };
    this.resetCursor = () => move(Vector2.ZERO);
    this.resetCursor();
    target.disposeEmitter.addListener(() => {
      edit.brushRadiusProperty.unlink(resize);
      for (const listener of [pointer, keyboard, stamp]) {
        target.removeInputListener(listener);
        listener.dispose();
      }
    });
    return target;
  }
}

class MaskShade extends CanvasNode {
  private transmission: Float32Array | undefined;
  private readonly sampleCanvas = document.createElement("canvas");
  private readonly sampleContext = this.sampleCanvas.getContext("2d");
  private imageData: ImageData | undefined;
  private readonly repaint = () => this.refreshPixels();

  private readonly drawSize: number;
  public cropSize: number;
  public size: number;

  public constructor(drawSize: number, cropSize: number, size: number) {
    super({ canvasBounds: new Bounds2(0, 0, drawSize, drawSize), pickable: false });
    this.drawSize = drawSize;
    this.cropSize = cropSize;
    this.size = size;
    this.sampleCanvas.width = this.sampleCanvas.height = cropSize;
    this.imageData = this.sampleContext?.createImageData(cropSize, cropSize);
    Colors.maskShadeColorProperty.lazyLink(this.repaint);
    Colors.thirdGratingColorProperty.lazyLink(this.repaint);
  }

  public setGrid(crop: number, size: number): void {
    this.cropSize = crop;
    this.size = size;
    this.sampleCanvas.width = this.sampleCanvas.height = crop;
    this.imageData = this.sampleContext?.createImageData(crop, crop);
  }

  public update(transmission: Float32Array): void {
    this.transmission = transmission;
    this.refreshPixels();
  }

  private refreshPixels(): void {
    const data = this.transmission;
    if (!(data && this.imageData && this.sampleContext)) {
      return;
    }
    const first = (this.size - this.cropSize) / 2;
    const blocked = Colors.maskShadeColorProperty.value;
    const shifted = Colors.thirdGratingColorProperty.value;
    const pixels = this.imageData.data;
    let pixel = 0;
    for (let y = first; y < first + this.cropSize; y++) {
      for (let x = first; x < first + this.cropSize; x++) {
        const i = 2 * (y * this.size + x);
        const color = data[i + 1] ? shifted : data[i] === 0 ? blocked : undefined;
        pixels[pixel] = color?.red ?? 0;
        pixels[pixel + 1] = color?.green ?? 0;
        pixels[pixel + 2] = color?.blue ?? 0;
        pixels[pixel + 3] = color ? I.maskShadeAlpha : 0;
        pixel += 4;
      }
    }
    this.sampleContext.putImageData(this.imageData, 0, 0);
    this.invalidatePaint();
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(this.sampleCanvas, 0, 0, this.drawSize, this.drawSize);
    context.restore();
  }

  public override dispose(): void {
    Colors.maskShadeColorProperty.unlink(this.repaint);
    Colors.thirdGratingColorProperty.unlink(this.repaint);
    this.transmission = undefined;
    this.imageData = undefined;
    this.sampleCanvas.width = this.sampleCanvas.height = 0;
    super.dispose();
  }
}
