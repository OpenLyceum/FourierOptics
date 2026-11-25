# AGENTS.md — Fourier Optics

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

Fourier Optics (`fourier-optics`) is a SceneryStack simulation scaffolded from SceneryStackTemplate.

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

## Backend selection

`?backend=auto|cpu|gpu` defaults to automatic WebGPU detection. One validated device serves all screens.
Explicit CPU selection skips acquisition until GPU or Automatic is selected in Preferences.
`?resolution=256|512|1024` overrides the backend default of 256² on CPU and 512² on GPU.
The CPU caps requests at 512². Each badge reports the effective grid and identifies fallback.
`?timing` logs warm-frame median recompute times for Spatial Filtering and 4f Optical System.

## Compliance carve-outs

- **Hardcoded colors (computed colours of light).** `spectralColor.ts` and `FieldImageNode.ts` compute wavelength tints, phase hues, and sample brightness. UI colours use profile properties.
- **WebGPU solver.** `src/common/fourier/gpu/` owns the WGSL, device, buffers, and compute engine.
  The screen models own optics parameters and issue backend-neutral Fourier operations.
- `memory-leak:WebGpuFourierEngine`: Requires a `GPUDevice` unavailable in Vitest/happy-dom.
  Screen model disposal and resolution rebuilds use the same engine lifecycle for both backends.
  The CPU suite covers model disposal and the browser parity spec submits and disposes the GPU engine.
- `memory-leak:MaskShade`: The private raster layer is exercised and disposed through `MaskEditorNode.disposeSubtree()` in `tests/memory-leak.test.ts`.

Vitest uses the template's `happy-dom` environment.

Run `npm run test:browser` for GPU parity and the feature-disabled CPU fallback. The parity spec skips
when headless Chromium cannot acquire an adapter.
