import type { TReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Node, Path } from "scenerystack/scenery";
import Colors from "../../FourierOpticsColors.js";
import { OPTICS_LAYOUT as L } from "../../FourierOpticsConstants.js";
import { label } from "./controls.js";

type LensLabels = {
  lens: TReadOnlyProperty<string>;
  plane: TReadOnlyProperty<string>;
  distance: TReadOnlyProperty<string>;
};

/** Side view of the planes. Each lens adds one focal plane and a labeled distance. */
export class LensSchematicNode extends Node {
  public constructor(
    waveLabel: TReadOnlyProperty<string>,
    apertureLabel: TReadOnlyProperty<string>,
    lenses: readonly LensLabels[],
  ) {
    super({ pickable: false });
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
}
