import { ComplexField } from "../../model/ComplexField.js";
import type { FieldDisplay, FourierEngine, FourierOperations, ImagingMode } from "../FourierEngine.js";
import { demoteGpuContext, type GpuContext } from "./GpuContext.js";

const LANES = 64;
const SAMPLE_BYTES = 8;
const PARAM_BYTES = 32;
const STORAGE = () => GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
const displayModes = { intensity: 0, log: 1, amplitude: 2, phase: 3 };

type Kernel = keyof GpuContext["pipelines"];
type Readback = { buffer: GPUBuffer; start: number; target: Uint8Array<ArrayBuffer> };
type Parameter = readonly [
  n: number,
  stage?: number,
  op?: number,
  flags?: number,
  a?: number,
  b?: number,
  c?: number,
  d?: number,
];

/** One command stream and one staging map per submission. Only requested results leave the device. */
export class WebGpuFourierEngine implements FourierEngine {
  public readonly backend = "webgpu";
  public readonly size: number;
  private readonly context: GpuContext;
  private readonly buffers = new Set<GPUBuffer>();
  private readonly pool = new Map<string, GPUBuffer[]>();
  private readonly twiddles = new Map<number, GPUBuffer>();
  private staging: GPUBuffer | undefined;
  private otf: GPUBuffer | undefined;
  private pupilKey: string | undefined;
  private active = false;
  private disposed = false;

  public constructor(size: number, context: GpuContext) {
    ComplexField.checkSize(size);
    if (size < 2 || size > context.maxGridSize) {
      throw new RangeError("Fourier grid exceeds the device's supported range.");
    }
    this.size = size;
    this.context = context;
  }

  public async submit<T>(encode: (operations: FourierOperations) => T): Promise<T> {
    if (this.active || this.disposed) {
      throw new Error("The WebGPU Fourier engine must be idle and active before submitting.");
    }
    this.active = true;
    const { device } = this.context;
    const taken = new Map<string, number>();
    try {
      const frame = new GpuFrame(
        this.context,
        this.size,
        (bytes, usage) => {
          const key = `${bytes}/${usage}`;
          const index = taken.get(key) ?? 0;
          taken.set(key, index + 1);
          const pool = this.pool.get(key) ?? [];
          this.pool.set(key, pool);
          const buffer = pool[index] ?? this.allocate(bytes, usage);
          pool[index] = buffer;
          return buffer;
        },
        (n) => this.getTwiddles(n),
        (key, build) => {
          this.otf ??= this.allocate(SAMPLE_BYTES * this.size ** 2, STORAGE());
          if (key === undefined || key !== this.pupilKey) {
            build(this.otf);
            this.pupilKey = key;
          }
          return this.otf;
        },
      );
      const result = encode(frame);
      frame.finish();
      if (frame.readbackBytes > (this.staging?.size ?? 0)) {
        if (this.staging) {
          this.staging.destroy();
          this.buffers.delete(this.staging);
        }
        this.staging = this.allocate(frame.readbackBytes, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
      }
      const staging = this.staging;
      if (staging && frame.readbackBytes > 0) {
        frame.copyReadbacks(staging);
        device.queue.submit([frame.encoder.finish()]);
        await staging.mapAsync(GPUMapMode.READ, 0, frame.readbackBytes);
        if (!this.disposed) {
          try {
            frame.resolveReadbacks(staging.getMappedRange(0, frame.readbackBytes));
          } finally {
            staging.unmap();
          }
        }
      } else {
        device.queue.submit([frame.encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
      }
      return result;
    } catch (error) {
      this.pupilKey = undefined;
      if (!this.disposed) {
        demoteGpuContext(this.context);
      }
      throw error;
    } finally {
      this.active = false;
    }
  }

  private allocate(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    const buffer = this.context.device.createBuffer({ size, usage });
    this.buffers.add(buffer);
    return buffer;
  }

  private getTwiddles(n: number): GPUBuffer {
    const existing = this.twiddles.get(n);
    if (existing) {
      return existing;
    }
    const twiddle = new Float32Array(n);
    for (let k = 0; k < n / 2; k++) {
      const angle = (-2 * Math.PI * k) / n;
      twiddle[2 * k] = Math.cos(angle);
      twiddle[2 * k + 1] = Math.sin(angle);
    }
    const buffer = this.allocate(twiddle.byteLength, STORAGE());
    this.context.device.queue.writeBuffer(buffer, 0, twiddle);
    this.twiddles.set(n, buffer);
    return buffer;
  }

  public dispose(): void {
    this.disposed = true;
    for (const buffer of this.buffers) {
      buffer.destroy();
    }
    this.buffers.clear();
    this.pool.clear();
    this.twiddles.clear();
    this.staging = this.otf = undefined;
  }
}

class GpuFrame implements FourierOperations {
  public readonly encoder: GPUCommandEncoder;
  public readbackBytes = 0;
  private readonly context: GpuContext;
  private readonly size: number;
  private readonly getBuffer: (bytes: number, usage: GPUBufferUsageFlags) => GPUBuffer;
  private readonly twiddles: (size: number) => GPUBuffer;
  private readonly cachedOtf: (key: string | undefined, build: (out: GPUBuffer) => void) => GPUBuffer;
  private readonly pass: GPUComputePassEncoder;
  private readonly fields = new Map<ComplexField, GPUBuffer>();
  private readonly intensities = new Map<Float32Array, GPUBuffer>();
  private readonly scratch = new Map<number, readonly [GPUBuffer, GPUBuffer]>();
  private readonly readbacks: Readback[] = [];
  private readonly dummy: GPUBuffer;
  private readonly dummyPeak: GPUBuffer;

  public constructor(
    context: GpuContext,
    size: number,
    getBuffer: (bytes: number, usage: GPUBufferUsageFlags) => GPUBuffer,
    twiddles: (size: number) => GPUBuffer,
    cachedOtf: (key: string | undefined, build: (out: GPUBuffer) => void) => GPUBuffer,
  ) {
    this.context = context;
    this.size = size;
    this.getBuffer = getBuffer;
    this.twiddles = twiddles;
    this.cachedOtf = cachedOtf;
    this.encoder = context.device.createCommandEncoder();
    this.pass = this.encoder.beginComputePass();
    this.dummy = getBuffer(SAMPLE_BYTES, STORAGE());
    this.dummyPeak = getBuffer(4, STORAGE());
  }

  public forward(input: ComplexField, output: ComplexField): void {
    this.put(output, this.transform(this.get(input), this.size, true, false));
  }

  public filterAndInverse(
    input: ComplexField,
    mask: Float32Array,
    output: ComplexField,
    mode: ImagingMode = "ideal",
  ): void {
    this.checkComplexSamples(mask);
    this.put(output, this.image(this.applyMask(this.get(input), this.upload(mask)), mode));
  }

  public propagate(input: ComplexField, transfer: Float32Array, output: ComplexField): void {
    this.checkComplexSamples(transfer);
    const spectrum = this.transform(this.get(input), this.size, true, false);
    this.put(output, this.image(this.applyMask(spectrum, this.upload(transfer)), "ideal"));
  }

  public imageThroughSystem(
    input: Float32Array,
    pupil: Float32Array,
    output: Float32Array,
    mode: ImagingMode = "4f",
    key?: string,
  ): void {
    const n = this.size;
    this.checkComplexSamples(pupil);
    if (input.length !== n * n || output.length !== n * n) {
      throw new RangeError("Intensities must have one real value per grid sample.");
    }
    const otf = this.cachedOtf(key, (out) => {
      const m = 2 * n;
      const padded = this.fieldBuffer(m);
      this.run("field", this.upload(pupil), padded, [m, 0, 2]);
      const transform = this.transform(padded, m, false, false);
      this.run("field", transform, padded, [m, 0, 3]);
      const correlation = this.transform(padded, m, false, true);
      this.run("field", correlation, out, [n, 0, 7]);
    });
    const expanded = this.fieldBuffer();
    this.run("field", this.upload(input), expanded, [n, 0, 4]);
    const spectrum = this.transform(expanded, n, true, false);
    this.intensities.set(output, this.image(this.applyMask(spectrum, otf), mode));
  }

  public swapPhase(amplitude: ComplexField, phase: ComplexField, output: ComplexField): void {
    const mixed = this.fieldBuffer();
    this.run("field", this.get(amplitude), mixed, [this.size, 0, 5], this.get(phase));
    this.put(output, this.image(mixed, "ideal"));
  }

  public camera(image: ComplexField | Float32Array, output: ComplexField, scale: number): void {
    const source = image instanceof ComplexField ? this.get(image) : this.intensityBuffer(image);
    const result = this.fieldBuffer();
    this.run("field", source, result, [this.size, 0, 6, Number(!(image instanceof ComplexField)), scale]);
    this.put(output, result);
  }

  public read(field: ComplexField): void {
    this.addReadback(this.get(field), new Uint8Array(field.data.buffer as ArrayBuffer));
  }

  public readIntensity(intensity: Float32Array): void {
    const packed = this.getBuffer(intensity.byteLength, STORAGE());
    this.run("field", this.intensityBuffer(intensity), packed, [this.size, 0, 8]);
    this.addReadback(
      packed,
      new Uint8Array(intensity.buffer as ArrayBuffer, intensity.byteOffset, intensity.byteLength),
    );
  }

  public readRow(field: ComplexField, crop: number): Float32Array {
    const row = new Float32Array(2 * crop);
    const first = field.size * (field.size >> 1) + (field.size >> 1) - (crop >> 1);
    this.addReadback(this.get(field), new Uint8Array(row.buffer), SAMPLE_BYTES * first);
    return row;
  }

  public readPower(field: ComplexField): () => number {
    const groups = Math.ceil(this.size / LANES) * this.size;
    const partial = this.getBuffer(4 * groups, STORAGE());
    const total = this.getBuffer(4, STORAGE());
    this.run("reduce", this.get(field), partial, [this.size, 0, 0, 1]);
    this.run("reduce", partial, total, [this.size, groups, 0, 2], this.dummy, this.dummyPeak, 1, 1);
    const result = new Float32Array(1);
    this.addReadback(total, new Uint8Array(result.buffer));
    return () => result[0] ?? 0;
  }

  public display(field: ComplexField, { crop, exposure, mode, tint }: FieldDisplay): Uint8ClampedArray<ArrayBuffer> {
    const source = this.get(field);
    const peak = this.getBuffer(4, STORAGE());
    this.context.device.queue.writeBuffer(peak, 0, new Uint32Array(1));
    const rgba = new Uint8ClampedArray(4 * crop ** 2);
    const output = this.getBuffer(rgba.byteLength, STORAGE());
    this.run("reduce", source, output, [this.size], this.dummy, peak);
    this.run(
      "display",
      source,
      output,
      [this.size, crop, 0, displayModes[mode], exposure, ...tint],
      this.dummy,
      peak,
      crop,
      crop,
    );
    this.addReadback(output, new Uint8Array(rgba.buffer));
    return rgba;
  }

  public finish(): void {
    this.pass.end();
  }

  public copyReadbacks(staging: GPUBuffer): void {
    let offset = 0;
    for (const { buffer, start, target } of this.readbacks) {
      this.encoder.copyBufferToBuffer(buffer, start, staging, offset, target.byteLength);
      offset += target.byteLength;
    }
  }

  public resolveReadbacks(mapped: ArrayBuffer): void {
    let offset = 0;
    for (const { target } of this.readbacks) {
      target.set(new Uint8Array(mapped, offset, target.byteLength));
      offset += target.byteLength;
    }
  }

  private addReadback(buffer: GPUBuffer, target: Uint8Array<ArrayBuffer>, start = 0): void {
    this.readbacks.push({ buffer, start, target });
    this.readbackBytes += target.byteLength;
  }

  private applyMask(source: GPUBuffer, mask: GPUBuffer): GPUBuffer {
    const output = this.fieldBuffer();
    this.run("field", source, output, [this.size, 0, 1], mask);
    return output;
  }

  private image(source: GPUBuffer, mode: ImagingMode): GPUBuffer {
    return this.transform(source, this.size, true, mode === "ideal", true);
  }

  private transform(source: GPUBuffer, n: number, centred: boolean, inverse: boolean, normalize = inverse): GPUBuffer {
    let scratch = this.scratch.get(n);
    if (!scratch) {
      scratch = [this.fieldBuffer(n), this.fieldBuffer(n)];
      this.scratch.set(n, scratch);
    }
    const [first, second] = scratch;
    let input = source;
    let output = first;
    if (centred) {
      this.run("field", input, first, [n, 0, 0, 1, 1]);
      input = first;
      output = second;
    }
    const twiddle = this.twiddles(n);
    for (const axis of [0, 1]) {
      for (let stride = 1; stride < n; stride *= 2) {
        this.run(
          "fft",
          input,
          output,
          [n, stride, 0, axis + (inverse ? 2 : 0)],
          twiddle,
          this.dummyPeak,
          axis === 0 ? n / 2 : n,
          axis === 0 ? n : n / 2,
        );
        input = output;
        output = output === first ? second : first;
      }
    }
    if (!centred) {
      // The autocorrelation is divided by its DC sample, cancelling raw inverse scaling.
      return input;
    }
    const result = this.fieldBuffer(n);
    this.run("field", input, result, [n, 0, 0, 1, normalize ? 1 / n ** 2 : 1]);
    return result;
  }

  private run(
    kernel: Kernel,
    source: GPUBuffer,
    output: GPUBuffer,
    params: Parameter,
    extra = this.dummy,
    peak = this.dummyPeak,
    columns = params[0],
    rows = params[0],
  ): void {
    const { device, layout, pipelines } = this.context;
    const uniform = this.getBuffer(PARAM_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const [n, stage = 0, op = 0, flags = 0, a = 0, b = 0, c = 0, d = 0] = params;
    const data = new ArrayBuffer(PARAM_BYTES);
    new Uint32Array(data, 0, 4).set([n, stage, op, flags]);
    new Float32Array(data, 16, 4).set([a, b, c, d]);
    device.queue.writeBuffer(uniform, 0, data);
    const bindings = device.createBindGroup({
      layout,
      entries: [source, extra, output, peak, uniform].map((buffer, binding) => ({ binding, resource: { buffer } })),
    });
    this.pass.setPipeline(pipelines[kernel]);
    this.pass.setBindGroup(0, bindings);
    this.pass.dispatchWorkgroups(Math.ceil(columns / LANES), rows);
  }

  private fieldBuffer(n = this.size): GPUBuffer {
    return this.getBuffer(SAMPLE_BYTES * n ** 2, STORAGE());
  }

  private checkComplexSamples(samples: Float32Array): void {
    if (samples.length !== 2 * this.size ** 2) {
      throw new RangeError("Complex samples must match the engine's grid.");
    }
  }

  private upload(data: Float32Array): GPUBuffer {
    const buffer = this.getBuffer(Math.max(SAMPLE_BYTES, data.byteLength), STORAGE());
    this.context.device.queue.writeBuffer(buffer, 0, data as Float32Array<ArrayBuffer>);
    return buffer;
  }

  private get(field: ComplexField): GPUBuffer {
    this.checkComplexSamples(field.data);
    const existing = this.fields.get(field);
    if (existing) {
      return existing;
    }
    const source = this.upload(field.data);
    this.fields.set(field, source);
    return source;
  }

  private put(field: ComplexField, buffer: GPUBuffer): void {
    this.checkComplexSamples(field.data);
    this.fields.set(field, buffer);
  }

  private intensityBuffer(intensity: Float32Array): GPUBuffer {
    const buffer = this.intensities.get(intensity);
    if (!buffer) {
      throw new Error("Expected an incoherent image from this submission.");
    }
    return buffer;
  }
}
