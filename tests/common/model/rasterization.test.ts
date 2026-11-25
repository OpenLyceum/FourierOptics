import { describe, expect, it } from "vitest";
import type { ApertureSpec } from "../../../src/common/model/apertures.js";
import { rasterizeAperture } from "../../../src/common/model/apertures.js";
import { ComplexField } from "../../../src/common/model/ComplexField.js";
import type { MaskSpec } from "../../../src/common/model/masks.js";
import { compose, rasterizeMask } from "../../../src/common/model/masks.js";

describe("ComplexField", () => {
  it("owns interleaved data and derives amplitude, phase, intensity and power", () => {
    const source = Float32Array.of(3, 4, 0, 0, 0, 0, 0, -2);
    const field = new ComplexField(2, source);
    source[0] = 9;
    const copy = field.copy();
    copy.fill(2, -1);
    expect(copy.get(1, 1)).toEqual([2, -1]);
    expect(field.get(0, 0)).toEqual([3, 4]);
    expect([...field.intensity()]).toEqual([25, 0, 0, 4]);
    expect([...field.amplitude()]).toEqual([5, 0, 0, 2]);
    expect(field.phase()[3]).toBeCloseTo(-Math.PI / 2);
    expect(field.totalPower()).toBe(29);
    expect(field.normalizeToPeak()).toBe(5);
    expect(field.amplitude()[0]).toBeCloseTo(1, 7);
    expect(field.phase()[0]).toBeCloseTo(Math.atan2(4, 3), 7);
    expect(new ComplexField(1).normalizeToPeak()).toBe(0);
    expect(() => new ComplexField(3)).toThrow(RangeError);
    expect(() => field.set(2, 0, 1)).toThrow(RangeError);
  });

  it("applies real and complex transmission in place", () => {
    const field = new ComplexField(1);
    field.set(0, 0, 3, 4);
    field.multiplyByMask(Float32Array.of(2));
    field.multiplyByMask(Float32Array.of(0, 1));
    expect(field.get(0, 0)).toEqual([-8, 6]);
    expect(() => field.multiplyByMask(new Float32Array(3))).toThrow(RangeError);
  });
});

describe("aperture rasterization", () => {
  it("averages subpixel area at an edge", () => {
    const field = new ComplexField(64);
    rasterizeAperture({ kind: "slit", width: 4 }, field);
    expect(field.get(32, 32)).toEqual([1, 0]);
    expect(field.get(34, 32)).toEqual([0.5, 0]);
    expect(field.get(35, 32)).toEqual([0, 0]);
  });

  const geometries: [ApertureSpec, [number, number], [number, number]][] = [
    [{ kind: "doubleSlit", width: 4, separation: 12, height: 10 }, [38, 32], [32, 32]],
    [{ kind: "annulus", inner: 3, outer: 8 }, [37, 32], [32, 32]],
    [{ kind: "cross", width: 14, height: 14, thickness: 3 }, [32, 37], [37, 37]],
    [{ kind: "letterF", width: 12, height: 16, thickness: 3 }, [27, 37], [36, 37]],
  ];
  it.each(geometries)("rasterizes %j with its intended openings", (spec, open, blocked) => {
    const field = new ComplexField(64);
    rasterizeAperture(spec, field);
    expect(field.get(...open)).toEqual([1, 0]);
    expect(field.get(...blocked)).toEqual([0, 0]);
  });
});

describe("mask rasterization", () => {
  it("uses bin-centred cutoffs and a slit normal angle", () => {
    const cases: [MaskSpec, [number, number], [number, number]][] = [
      [{ kind: "highPass", radius: 2 }, [7, 4], [6, 4]],
      [{ kind: "bandPass", inner: 1, outer: 2 }, [5, 4], [4, 4]],
      [{ kind: "slit", width: 2, angle: Math.PI / 2 }, [0, 4], [4, 6]],
    ];
    for (const [spec, [openX, openY], [closedX, closedY]] of cases) {
      const mask = rasterizeMask(spec, 8);
      expect(mask[2 * (openY * 8 + openX)]).toBe(1);
      expect(mask[2 * (closedY * 8 + closedX)]).toBe(0);
    }
  });

  it("snapshots painted samples and composes amplitude and phase", () => {
    const paint = new Float32Array(16).fill(0.5);
    const painted = rasterizeMask({ kind: "painted", transmission: paint }, 4);
    paint.fill(0);
    const phase = rasterizeMask({ kind: "phaseDot", radius: 0 }, 4);
    const result = compose([painted, phase]);
    const dc = 2 * (2 * 4 + 2);
    expect(result[dc]).toBeCloseTo(0, 7);
    expect(result[dc + 1]).toBeCloseTo(0.5, 7);
    expect(result[0]).toBeCloseTo(0.5, 7);
    expect(painted[dc]).toBeCloseTo(0.5, 7);
    expect(() => compose([painted, paint])).toThrow(RangeError);
  });
});
