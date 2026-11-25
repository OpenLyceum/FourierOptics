import type { Emitter } from "scenerystack/axon";

/** Coalesces input edits until the next ScreenView.step. */
export class FrameRecomputeScheduler {
  private readonly inputsChangedEmitter: Emitter;
  private readonly recompute: () => void;
  private dirty = true;
  private readonly markDirty = (): void => {
    this.dirty = true;
  };

  public constructor(inputsChangedEmitter: Emitter, recompute: () => void) {
    this.inputsChangedEmitter = inputsChangedEmitter;
    this.recompute = recompute;
    inputsChangedEmitter.addListener(this.markDirty);
  }

  public step(): void {
    if (this.dirty) {
      this.dirty = false;
      this.recompute();
    }
  }

  public dispose(): void {
    this.inputsChangedEmitter.removeListener(this.markDirty);
  }
}
