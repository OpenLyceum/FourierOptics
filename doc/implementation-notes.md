# Implementation notes — Fourier Optics

Developer-facing architecture notes for `fourier-optics`.

## Architecture

Screens: src/spatial-frequencies/, src/fourier-transform/, src/spatial-filtering/, src/four-f-optical-system/

- Models own state and `step` / `reset`; views observe Properties and never integrate physics.
- Colors live in `src/FourierOpticsColors.ts`; strings in `src/i18n/` via `StringManager`.
- Preferences shell: `src/preferences/` (empty until sim-specific prefs are added).

## Notes

*Record design decisions, performance constraints, and known limitations here.*
