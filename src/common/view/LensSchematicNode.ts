import { Multilink, type NumberProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { clamp, roundSymmetric, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Node, Path } from "scenerystack/scenery";
import Colors from "../../FourierOpticsColors.js";
import { IMAGING_LAYOUT as I, OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";
import { label } from "./controls.js";
import { OpticsDragHandle } from "./OpticsDragHandle.js";

type LensLabels = {
  lens: TReadOnlyProperty<string>;
  plane: TReadOnlyProperty<string>;
  distance: TReadOnlyProperty<string>;
};

type FourFDiagram = {
  f1: NumberProperty;
  f2: NumberProperty;
  iris: NumberProperty;
  defocus: NumberProperty;
  stations: readonly TReadOnlyProperty<string>[];
  distances: readonly TReadOnlyProperty<string>[];
  irisName: TReadOnlyProperty<string>;
  irisHelp: TReadOnlyProperty<string>;
};

/** Side view of the planes. Each lens adds one focal plane and a labeled distance. */
export class LensSchematicNode extends Node {
  public constructor(
    waveLabel: TReadOnlyProperty<string>,
    apertureLabel: TReadOnlyProperty<string>,
    lenses: readonly LensLabels[],
  );
  public constructor(diagram: FourFDiagram);
  public constructor(
    waveLabel: TReadOnlyProperty<string> | FourFDiagram,
    apertureLabel?: TReadOnlyProperty<string>,
    lenses: readonly LensLabels[] = [],
  ) {
    super();
    if ("f1" in waveLabel) {
      this.addFourFDiagram(waveLabel);
      return;
    }
    this.pickable = false;
    if (!apertureLabel) {
      throw new Error("An aperture label is required for the single-lens schematic.");
    }
    const spacing = L.schematicPlaneSpacing;
    const axisY = L.schematicHeight / 2;
    const planeHeight = axisY - L.gap;
    const xAt = (station: number) => (station + 0.5) * spacing;
    const apertureX = xAt(1);
    const end = xAt(2 * lenses.length + 1);
    const geometry = new Shape().moveTo(0, axisY).lineTo(end + spacing / 2, axisY);
    const beam = new Shape();
    const stationLabel = (text: TReadOnlyProperty<string>, x: number, top: number) => {
      const node = label(text, { maxWidth: spacing - L.smallGap });
      this.addChild(node);
      const center = () => {
        node.centerX = x;
        node.top = top;
      };
      node.localBoundsProperty.link(center);
      node.disposeEmitter.addListener(() => node.localBoundsProperty.unlink(center));
    };
    for (let i = 1; i <= 3; i++) {
      const x = xAt(0) + (i - 2) * L.gap;
      beam.moveTo(x, axisY - planeHeight).lineTo(x, axisY + planeHeight);
    }
    for (const direction of [-1, 1]) {
      const y = axisY + direction * planeHeight;
      geometry.moveTo(apertureX, y).lineTo(apertureX, axisY + direction * L.smallGap);
    }
    stationLabel(waveLabel, xAt(0), 0);
    stationLabel(apertureLabel, apertureX, 0);
    lenses.forEach(({ lens, plane, distance }, index) => {
      const lensX = xAt(2 * index + 2);
      const planeX = xAt(2 * index + 3);
      const y = axisY + planeHeight + L.smallGap;
      const curvature = 0.75 * planeHeight;
      beam
        .moveTo(lensX, axisY - planeHeight)
        .quadraticCurveTo(lensX + curvature, axisY, lensX, axisY + planeHeight)
        .quadraticCurveTo(lensX - curvature, axisY, lensX, axisY - planeHeight);
      geometry.moveTo(planeX, axisY - planeHeight).lineTo(planeX, axisY + planeHeight);
      geometry
        .moveTo(lensX, y - L.smallGap / 2)
        .lineTo(lensX, y + L.smallGap / 2)
        .moveTo(lensX, y)
        .lineTo(planeX, y)
        .lineTo(planeX, y + L.smallGap / 2)
        .moveTo(planeX, y)
        .lineTo(planeX, y - L.smallGap / 2);
      stationLabel(lens, lensX, 0);
      stationLabel(plane, planeX, 0);
      stationLabel(distance, (lensX + planeX) / 2, y + L.smallGap / 2);
    });
    this.addChild(new Path(geometry, { stroke: Colors.textColorProperty, lineWidth: L.plotStroke }));
    this.addChild(new Path(beam, { stroke: Colors.accentColorProperty, lineWidth: L.plotStroke }));
  }

  private addFourFDiagram(diagram: FourFDiagram): void {
    const { f1, f2, iris, defocus } = diagram;
    const width = I.schematicWidth;
    const axis = I.schematicHeight / 2;
    const height = axis - L.gap;
    const start = I.schematicMargin;
    const span = width - 2 * start;
    const axisShape = new Shape().moveTo(0, axis).lineTo(width, axis);
    const axisPath = new Path(axisShape, { stroke: Colors.textColorProperty, lineWidth: L.plotStroke });
    const geometry = new Path(null, { stroke: Colors.accentColorProperty, lineWidth: L.plotStroke });
    const idealPlane = new Path(null, {
      stroke: Colors.imageAxisColorProperty,
      lineWidth: L.plotStroke,
      lineDash: [L.smallGap, L.smallGap],
    });
    const labelLeader = new Path(null, { stroke: Colors.imageAxisColorProperty, lineWidth: L.plotStroke });
    const positions = diagram.stations.map(() => 0);
    const distancePositions = diagram.distances.map(() => 0);
    const labels = diagram.stations.map((text) => label(text, { maxWidth: 2 * start - L.smallGap }));
    const distanceLabels = diagram.distances.map((text) => label(text));
    let irisTransform = ModelViewTransform2.createIdentity();
    const handle = new OpticsDragHandle(
      diagram.irisName,
      diagram.irisHelp,
      () => irisTransform,
      (point) => {
        const diameter = clamp(-point.y, iris.range.min, iris.range.max);
        iris.value = roundSymmetric(diameter * 100) / 100;
      },
    );
    this.children = [axisPath, idealPlane, geometry, labelLeader, ...labels, ...distanceLabels, handle];
    this.pickable = null;
    for (const node of [axisPath, idealPlane, geometry, labelLeader, ...labels, ...distanceLabels]) {
      node.pickable = false;
    }
    const placeLabels = () => {
      labels.forEach((node, index) => {
        node.centerX = positions[index] ?? 0;
        node.top = index % 2 === 0 ? 0 : I.schematicHeight - L.gap;
      });
      const [objectLabel, , fourierLabel, , cameraLabel] = labels;
      const fourierX = positions[2];
      if (objectLabel && fourierLabel && cameraLabel && fourierX !== undefined) {
        // Keep the three top labels legible at extreme ratios of f₁ to f₂.
        cameraLabel.right = Math.min(cameraLabel.right, width);
        fourierLabel.centerX = clamp(
          fourierX,
          objectLabel.right + L.smallGap + fourierLabel.width / 2,
          cameraLabel.left - L.smallGap - fourierLabel.width / 2,
        );
        labelLeader.shape =
          fourierX === fourierLabel.centerX
            ? null
            : new Shape().moveTo(fourierLabel.centerX, fourierLabel.bottom).lineTo(fourierX, axis - height);
      }
      distanceLabels.forEach((node, index) => {
        node.centerX = distancePositions[index] ?? 0;
        node.top = axis + L.smallGap;
      });
    };
    const tracking = Multilink.multilink([f1, f2, iris, defocus], (first, second, diameter, offset) => {
      const scale = span / (2 * (first + second));
      const lens1 = start + first * scale;
      const fourier = start + 2 * first * scale;
      const lens2 = fourier + second * scale;
      const ideal = start + span;
      const camera = ideal + offset * scale;
      idealPlane.shape = offset === 0 ? null : new Shape().moveTo(ideal, axis - height).lineTo(ideal, axis + height);
      positions.splice(0, positions.length, start, lens1, fourier, lens2, camera);
      distancePositions.splice(
        0,
        distancePositions.length,
        (start + lens1) / 2,
        (lens1 + fourier) / 2,
        (fourier + lens2) / 2,
        (lens2 + ideal) / 2,
      );
      placeLabels();

      irisTransform = ModelViewTransform2.createSinglePointScaleMapping(
        Vector2.ZERO,
        new Vector2(fourier, axis),
        I.irisTravel / iris.range.max,
      );
      handle.translation = irisTransform.modelToViewPosition(new Vector2(0, -diameter));
      const gap = axis - handle.y;
      const shape = new Shape();
      for (const x of [start, camera]) {
        shape.moveTo(x, axis - height).lineTo(x, axis + height);
      }
      for (const x of [lens1, lens2]) {
        shape
          .moveTo(x, axis - height)
          .quadraticCurveTo(x + height * 0.65, axis, x, axis + height)
          .quadraticCurveTo(x - height * 0.65, axis, x, axis - height);
      }
      for (const sign of [-1, 1]) {
        shape.moveTo(fourier, axis + sign * height).lineTo(fourier, axis + sign * gap);
      }
      geometry.shape = shape;
    });
    for (const node of [...labels, ...distanceLabels]) {
      node.localBoundsProperty.lazyLink(placeLabels);
      node.disposeEmitter.addListener(() => node.localBoundsProperty.unlink(placeLabels));
    }
    this.disposeEmitter.addListener(() => tracking.dispose());
  }
}
