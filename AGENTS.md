# AGENTS.md — Fourier Optics

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

Fourier Optics (`fourier-optics`) is a four-screen SceneryStack simulation for
QuadriviumPress's *Optics* textbook. The spatial frequency, transform, filtering and 4f
experiments are based on Chapter 7 § Fourier Optics
(`QuadriviumPress/opticsTextbook/content/Chap07Diffraction/Diffraction.md`). The weak-phase
preset illustrates Chapter 9 § Phase Contrast Microscope
(`QuadriviumPress/opticsTextbook/content/Chap09AdvancedInstruments/AdvancedInstruments.md`).

## Screens

| Screen | Experiment |
|---|---|
| Spatial Frequencies | Compose sinusoidal gratings or inspect the odd harmonics of square-wave bars. |
| Fourier Transform | Change a physical aperture and measure the focal pattern, or exchange the Fourier phases of two objects. |
| Spatial Filtering | Apply, edit, or paint a Fourier mask. Compare Abbe–Porter, dark field, phase contrast, and edge enhancement. |
| 4f Optical System | Adjust two lenses, an iris and a camera. Compare coherent and incoherent resolution. |

## Things to know first

- Wavelength is in nm. Focal lengths, iris diameter and defocus are in mm. Screen 2 aperture dimensions are in µm and use a fixed 10 µm grid pitch. Other object sizes remain in samples and painted masks are indexed in FFT bins.
- Both grids are centred at `(N/2, N/2)`, with positive y down. The forward FFT uses the negative exponent. Ideal filtering reconstructs upright with the inverse FFT. The second forward transform in 4f imaging produces periodic inversion. See [the model](doc/model.md).
- `FourierEngine.submit(encode)` receives a synchronous operation-building callback. The CPU returns its result inline. WebGPU returns a promise after readback. The scheduler publishes only the latest revision.
- The WGSL, device and buffer lifecycle live in `src/common/fourier/gpu/`. The screen models own physical parameters and issue backend-neutral Fourier operations.
- `?backend=auto|cpu|gpu` defaults to Automatic. Explicit CPU skips GPU acquisition. `?resolution=256|512|1024` overrides the default of 256² CPU or 512² GPU, with a 512² CPU cap.
- Automatic skips reported fallback adapters. A median above 30 ms over the first eight GPU submissions on any screen switches all screens in Automatic to CPU at 256² and updates the badge and fallback notice. Explicit GPU bypasses both guards.
- `?timing` logs warm-frame timings on the filtering and 4f screens. See [implementation notes](doc/implementation-notes.md).

## Key files

| File | Purpose |
|---|---|
| `src/FourierOpticsColors.ts` | All `ProfileColorProperty` instances |
| `src/FourierOpticsConstants.ts` | Named numeric constants |
| `src/FourierOpticsNamespace.ts` | Namespace for color property names |
| `src/common/fourier/FourierEngine.ts` | Frame submission contract and Fourier operations |
| `src/common/fourier/createFourierEngine.ts` | Backend selection and effective resolution |
| `src/common/fourier/gpu/` | Device acquisition, WGSL kernels, GPU solver and staging readback |
| `src/common/view/FrameRecomputeScheduler.ts` | Coalescing and latest-frame publication |
| `src/preferences/` | Backend and resolution preferences and startup query parameters |
| `src/i18n/StringManager.ts` | Singleton localized string accessor |
| `src/common/FourierOpticsPanel.ts` | Pre-themed `Panel` wrapper |
| `src/common/FourierOpticsButtonOptions.ts` | Flat button / combo-box option bundles |
| `src/spatial-frequencies/SpatialFrequenciesScreen.ts` | Screen wrapper |
| `src/spatial-frequencies/model/SpatialFrequenciesModel.ts` | Simulation state and logic |
| `src/spatial-frequencies/view/SpatialFrequenciesScreenView.ts` | Visual nodes, layout, a11y wiring |
| `src/fourier-transform/FourierTransformScreen.ts` | Screen wrapper |
| `src/fourier-transform/model/FourierTransformModel.ts` | Simulation state and logic |
| `src/fourier-transform/view/FourierTransformScreenView.ts` | Visual nodes, layout, a11y wiring |
| `src/spatial-filtering/SpatialFilteringScreen.ts` | Screen wrapper |
| `src/spatial-filtering/model/SpatialFilteringModel.ts` | Simulation state and logic |
| `src/spatial-filtering/view/SpatialFilteringScreenView.ts` | Visual nodes, layout, a11y wiring |
| `src/four-f-optical-system/FourFOpticalSystemScreen.ts` | Screen wrapper |
| `src/four-f-optical-system/model/FourFOpticalSystemModel.ts` | Simulation state and logic |
| `src/four-f-optical-system/view/FourFOpticalSystemScreenView.ts` | Visual nodes, layout, a11y wiring |

## Accessibility

Each screen wires a localized live `ScreenSummaryContent` and its own keyboard help.
A wrapper node owns PDOM traversal, with Reset All last among screen controls. Named drag
targets use Scenery keyboard drag listeners. The brush stamp shares its key binding with
keyboard help. Filter changes, phase-contrast state changes and crossings of the finest
bar cutoff queue contextual screen-reader responses.

## Compliance carve-outs
- `playwright.browser.config.ts`: Separate Playwright projects exercise forced WebGPU and WebGPU-disabled fallback with different Chromium launch flags.
- **Template drift:** Biome sorts `package.json` `scripts` alphabetically, so the sim-specific `test:browser` entry sorts with the shared test scripts.

- **Hardcoded colors (computed colours of light).** `spectralColor.ts` and `FieldImageNode.ts` compute wavelength tints, phase hues, and sample brightness. UI colours use profile properties.
- **WebGPU solver.** `src/common/fourier/gpu/` owns the WGSL, device, buffers, and compute engine.
  The screen models own optics parameters and issue backend-neutral Fourier operations.
- `memory-leak:WebGpuFourierEngine`: Needs a real `GPUDevice`, which Vitest/happy-dom cannot provide, so the screen leak suite uses the CPU backend. It lives as long as its `FourierScreenModel`, whose `dispose()` disposes it. The suite covers that teardown path with `CpuFourierEngine` and the browser parity spec submits and disposes the GPU engine.
- `memory-leak:MaskShade`: The private raster layer is exercised and disposed through `MaskEditorNode.disposeSubtree()` in `tests/memory-leak.test.ts`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite for local development |
| `npm run lint`, `npm run check` | Biome and TypeScript validation |
| `npm run check:architecture`, `npm run check:unused` | Dependency boundaries and unused code |
| `npm run build` | Build the production PWA |
| `bash ../Baton/scripts/check-repo-compliance.sh --local .` | Run the local fleet compliance audit |

## Testing

Vitest uses the template's `happy-dom` environment. `npm test` includes numerical,
state, scheduling and disposal checks. `npm run test:fuzz:quick` runs 10 seconds each of
pointer and keyboard fuzz. `npm run test:soak:headless` exercises controls, screen steps,
reset and locale and profile changes while monitoring retained state.

Run `npm run test:browser` for GPU parity and the feature-disabled CPU fallback. The parity spec skips
when headless Chromium cannot acquire an adapter with the configured unsafe-WebGPU and Vulkan flags.
