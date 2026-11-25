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

## Compliance carve-outs

- **Hardcoded colors (computed colours of light).** `spectralColor.ts` and `FieldImageNode.ts` compute wavelength tints, phase hues, and sample brightness. UI colours use profile properties.

Vitest uses the template's `happy-dom` environment.
