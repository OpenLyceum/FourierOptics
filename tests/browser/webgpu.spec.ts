import { expect, test } from "@playwright/test";

test("WebGPU matches the reference transform and 4f imaging", async ({ page }) => {
  await page.goto("/?backend=cpu");
  const result = await page.evaluate(async () => {
    function load<T>(url: string): Promise<T> {
      return import(url);
    }
    const { initializeGpuContext, gpuContextProperty } = await load<
      typeof import("../../src/common/fourier/gpu/GpuContext.js")
    >("/src/common/fourier/gpu/GpuContext.ts");
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      return { noAdapter: true } as const;
    }
    await initializeGpuContext(false);
    const context = gpuContextProperty.value;
    if (!context) {
      throw new Error("A WebGPU adapter was present, but Fourier Optics could not initialize its pipelines.");
    }
    const { createFourierEngine } = await load<typeof import("../../src/common/fourier/createFourierEngine.js")>(
      "/src/common/fourier/createFourierEngine.ts",
    );
    const { WebGpuFourierEngine } = await load<typeof import("../../src/common/fourier/gpu/WebGpuFourierEngine.js")>(
      "/src/common/fourier/gpu/WebGpuFourierEngine.ts",
    );
    const { ComplexField } = await load<typeof import("../../src/common/model/ComplexField.js")>(
      "/src/common/model/ComplexField.ts",
    );
    const { rasterizeAperture } = await load<typeof import("../../src/common/model/apertures.js")>(
      "/src/common/model/apertures.ts",
    );
    const { rasterizeMask } =
      await load<typeof import("../../src/common/model/masks.js")>("/src/common/model/masks.ts");
    const { angularSpectrumTransfer } = await load<typeof import("../../src/common/model/opticalSystem.js")>(
      "/src/common/model/opticalSystem.ts",
    );

    const n = 256;
    const gpu = new WebGpuFourierEngine(n, context);
    const cpu = createFourierEngine(n);
    const aperture = new ComplexField(n);
    rasterizeAperture({ kind: "letterF", width: 48, height: 70, thickness: 11 }, aperture);
    const pupil = rasterizeMask({ kind: "lowPass", radius: 11 }, n);
    pupil[2 * ((n / 2 + 1) * n + n / 2) + 1] = 0.35;
    const transfer = angularSpectrumTransfer(n, 10, 550, 2);
    const intensity = aperture.intensity();

    async function run(engine: typeof cpu | typeof gpu) {
      const spectrum = new ComplexField(n);
      const coherent = new ComplexField(n);
      const propagated = new ComplexField(n);
      const incoherent = new Float32Array(n * n);
      const runFrame = () =>
        engine.submit((ops) => {
          ops.forward(aperture, spectrum);
          ops.filterAndInverse(spectrum, pupil, coherent, "4f");
          ops.propagate(coherent, transfer, propagated);
          ops.imageThroughSystem(intensity, pupil, incoherent, "4f", "fixed pupil");
          ops.read(spectrum);
          ops.read(coherent);
          ops.read(propagated);
          ops.readIntensity(incoherent);
          const power = ops.readPower(coherent);
          const rgba = ops.display(spectrum, { crop: 36, mode: "phase", exposure: 50, tint: [1, 1, 1] });
          return { power, rgba };
        });
      await runFrame();
      // The second frame exercises the OTF cache and reused staging allocation.
      const { rgba, power } = await runFrame();
      return { spectrum, coherent, propagated, incoherent, rgba, power: power() };
    }

    const relativeError = (reference: Float32Array, actual: Float32Array) => {
      let maxError = 0;
      let maxReference = 0;
      for (let i = 0; i < reference.length; i++) {
        maxError = Math.max(maxError, Math.abs(reference[i]! - actual[i]!));
        maxReference = Math.max(maxReference, Math.abs(reference[i]!));
      }
      return maxError / maxReference;
    };
    try {
      const expected = await run(cpu);
      const actual = await run(gpu);
      const dc = 4 * (18 * 36 + 18);
      return {
        noAdapter: false,
        forward: relativeError(expected.spectrum.data, actual.spectrum.data),
        coherent: relativeError(expected.coherent.data, actual.coherent.data),
        propagated: relativeError(expected.propagated.data, actual.propagated.data),
        incoherent: relativeError(expected.incoherent, actual.incoherent),
        power: actual.power / expected.power,
        dcPixel: Array.from(actual.rgba?.slice(dc, dc + 4) ?? []),
      } as const;
    } finally {
      gpu.dispose();
      cpu.dispose();
    }
  });

  test.skip(result.noAdapter, "Headless Chromium returned no WebGPU adapter with Vulkan enabled.");
  if (!result.noAdapter) {
    for (const error of [result.forward, result.coherent, result.propagated, result.incoherent]) {
      expect(error).toBeLessThan(1e-3);
    }
    expect(result.power).toBeCloseTo(1, 4);
    expect(result.dcPixel).toEqual([255, 0, 0, 255]);
    await page.goto("/?screens=2&backend=gpu&ea");
    await expect(page.getByText("Compute backend GPU, grid 512 by 512 samples.")).toBeAttached();
  }
});
