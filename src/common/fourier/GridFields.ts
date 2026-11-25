import { ComplexField } from "../model/ComplexField.js";

/** Replaces a screen's complete set of sample buffers when its grid changes. */
export class GridFields<Key extends string> {
  private readonly names: readonly Key[];
  private size = 0;
  private fields: Partial<Record<Key, ComplexField>> = {};

  public constructor(...names: Key[]) {
    this.names = names;
  }

  public get(name: Key, size: number): ComplexField {
    if (size !== this.size) {
      this.fields = {};
      for (const key of this.names) {
        this.fields[key] = new ComplexField(size);
      }
      this.size = size;
    }
    const field = this.fields[name];
    if (!field) {
      throw new Error("Unknown Fourier field.");
    }
    return field;
  }
}
