import { Emitter } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import { CpuFourierEngine } from "../../../src/common/fourier/cpu/CpuFourierEngine.js";
import { ComplexField } from "../../../src/common/model/ComplexField.js";
import { FrameRecomputeScheduler } from "../../../src/common/view/FrameRecomputeScheduler.js";

describe("Fourier frame submissions", () => {
  it("coalesces edits and publishes CPU results synchronously in order", () => {
    const events = new Emitter();
    const engine = new CpuFourierEngine(4);
    const input = new ComplexField(4);
    const output = new ComplexField(4);
    const history: string[] = [];
    let level = 0;
    const scheduler = new FrameRecomputeScheduler(events, () =>
      engine.submit((ops) => {
        input.fill(level);
        ops.forward(input, output);
        expect(output.get(2, 2)[0]).toBeCloseTo(16 * level);
        history.push(`compute ${level}`);
        return () => {
          history.push(`paint ${level}`);
        };
      }),
    );
    level = 1;
    events.emit();
    level = 2;
    events.emit();
    scheduler.step();
    scheduler.step();
    level = 3;
    events.emit();
    scheduler.step();
    expect(history).toEqual(["compute 2", "paint 2", "compute 3", "paint 3"]);
    scheduler.dispose();
    engine.dispose();
    events.dispose();
  });

  it("allows one asynchronous job, drops stale work, and suppresses paint after disposal", async () => {
    const events = new Emitter();
    const submitted: number[] = [];
    const painted: number[] = [];
    const pending: (() => void)[] = [];
    let input = 1;
    const scheduler = new FrameRecomputeScheduler(events, () => {
      const value = input;
      submitted.push(value);
      return new Promise<() => void>((resolve) => {
        pending.push(() =>
          resolve(() => {
            painted.push(value);
          }),
        );
      });
    });
    scheduler.step();
    for (input of [2, 3]) {
      events.emit();
      scheduler.step();
    }
    expect(submitted).toEqual([1]);
    pending.shift()?.();
    await Promise.resolve();
    expect(painted).toEqual([]);
    scheduler.step();
    pending.shift()?.();
    await Promise.resolve();
    expect(submitted).toEqual([1, 3]);
    expect(painted).toEqual([3]);
    input = 4;
    events.emit();
    scheduler.step();
    scheduler.dispose();
    pending.shift()?.();
    await Promise.resolve();
    expect(submitted).toEqual([1, 3, 4]);
    expect(painted).toEqual([3]);
    events.dispose();
  });
});
