import { Circle, Line, Node, Rectangle } from "scenerystack/scenery";
import { ScreenIcon } from "scenerystack/sim";
import Colors from "../FourierOpticsColors.js";
import { SCREEN_ICONS as I } from "../FourierOpticsConstants.js";

function iconFrom(motif: Node[]): ScreenIcon {
  return new ScreenIcon(
    new Node({
      children: [
        new Rectangle(0, 0, I.width, I.height, { fill: Colors.backgroundColorProperty }),
        new Node({ x: I.width / 2, y: I.height / 2, children: motif }),
      ],
    }),
    {
      maxIconWidthProportion: 1,
      maxIconHeightProportion: 1,
      fill: Colors.backgroundColorProperty,
    },
  );
}

function line(x1: number, y1: number, x2: number, y2: number): Line {
  return new Line(x1, y1, x2, y2, {
    stroke: Colors.textColorProperty,
    lineWidth: I.stroke,
    lineCap: "round",
  });
}

function ring(radius: number): Circle {
  return new Circle(radius, { stroke: Colors.textColorProperty, lineWidth: I.stroke });
}

function dot(radius: number, x = 0, y = 0): Circle {
  return new Circle(radius, { x, y, fill: Colors.accentColorProperty });
}

export function createSpatialFrequenciesIcon(): ScreenIcon {
  return iconFrom([
    line(-I.span, 0, I.span, 0),
    line(0, -I.height / 3, 0, I.height / 3),
    dot(I.dot, -I.offset),
    dot(I.dot, I.offset),
  ]);
}

export function createFourierTransformIcon(): ScreenIcon {
  return iconFrom([ring(I.aperture), ring(I.offset / 2), dot(I.dot)]);
}

export function createSpatialFilteringIcon(): ScreenIcon {
  return iconFrom([ring(I.aperture), dot(I.dot), dot(I.dot, I.offset / 2), dot(I.dot, 0, -I.offset / 2)]);
}

export function createFourFOpticalSystemIcon(): ScreenIcon {
  return iconFrom([
    line(-I.span, 0, I.span, 0),
    line(-I.offset, -I.aperture, -I.offset, I.aperture),
    line(I.offset, -I.aperture, I.offset, I.aperture),
    dot(I.dot),
  ]);
}
