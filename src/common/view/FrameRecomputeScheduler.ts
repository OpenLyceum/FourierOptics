import type { Emitter } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";

type Paint = () => void;

/** Only the latest revision can publish. CPU jobs publish synchronously in step(). */
export class FrameRecomputeScheduler {
  private readonly inputsChangedEmitter: Emitter;
  private readonly recompute: () => Paint | Promise<Paint>;
  private readonly timing: (() => string) | undefined;
  private readonly samples = new Map<string, number[]>();
  private revision = 0;
  private started = -1;
  private inFlight = false;
  private disposed = false;
  private readonly markDirty = (): void => {
    this.revision++;
  };

  public constructor(inputsChangedEmitter: Emitter, recompute: () => Paint | Promise<Paint>, timing?: () => string) {
    this.inputsChangedEmitter = inputsChangedEmitter;
    this.recompute = recompute;
    this.timing = timing;
    inputsChangedEmitter.addListener(this.markDirty);
  }

  public step(): void {
    if (this.disposed || this.inFlight || this.started === this.revision) {
      return;
    }
    this.started = this.revision;
    const revision = this.started;
    const timing = this.timing?.();
    const start = timing ? performance.now() : 0;
    const publish = (paint: Paint) => {
      if (!this.disposed && revision === this.revision) {
        paint();
        if (timing) {
          this.recordTiming(timing, performance.now() - start);
        }
      }
    };
    const frame = this.recompute();
    if (frame instanceof Promise) {
      this.inFlight = true;
      frame.then(
        (paint) => {
          this.inFlight = false;
          publish(paint);
        },
        (error) => {
          this.inFlight = false;
          if (!this.disposed && revision === this.revision) {
            // biome-ignore lint/suspicious/noConsole: Surface unexpected asynchronous frame failures.
            console.error("Fourier Optics frame failed", error);
          }
        },
      );
    } else {
      publish(frame);
    }
  }

  private recordTiming(label: string, milliseconds: number): void {
    const data = this.samples.get(label);
    if (!data) {
      // Ignore the first frame, which includes pipeline and buffer warm-up.
      this.samples.set(label, []);
      // biome-ignore lint/suspicious/noConsole: Opt-in timing output for the warm-up frame.
      console.info(`Fourier Optics warm-up ${label}: ${toFixed(milliseconds, 2)} ms`);
      return;
    }
    const timingWindow = 60;
    data.push(milliseconds);
    if (data.length > timingWindow) {
      data.shift();
    }
    const samples = data.toSorted((a, b) => a - b);
    if (samples.length > 0) {
      const low = samples[Math.floor((samples.length - 1) / 2)] ?? 0;
      const high = samples[Math.floor(samples.length / 2)] ?? 0;
      // biome-ignore lint/suspicious/noConsole: Opt-in timing output for developer measurements.
      console.info(`Fourier Optics timing ${label}: ${toFixed((low + high) / 2, 2)} ms median (n=${samples.length})`);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.inputsChangedEmitter.removeListener(this.markDirty);
  }
}
