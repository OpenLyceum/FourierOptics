# Implementation notes — Fourier Optics

The four screen models own optical parameters and sampled inputs. The views schedule computation, render fields through `FieldImageNode`, and expose accessible controls and summaries. Numerical conventions and units are documented in [Model](model.md).

## Engines and frames

`FourierEngine.submit(encode)` gives a synchronous callback access to `FourierOperations`. The CPU runs the reference algorithms inline and returns the callback's value immediately. The GPU encodes a command stream and resolves with the callback's value after requested readbacks complete. Output fields may feed later operations in the same submission. GPU callers request numerical readback explicitly.

The GPU uses radix-2 Stockham autosort in interleaved f32 storage buffers. It dispatches once per stage on each axis, alternates between two work buffers, and caches twiddles per engine and transform size. A checkerboard sign before and after each centred transform implements the CPU's two shifts on an even square grid. The forward exponent is negative. Ideal inversion uses the positive exponent and 1/N² scaling. Two-lens imaging uses the negative exponent on both transforms and scales the second by 1/N². Propagation uses the same sampled angular-spectrum transfer as the CPU.

Complex masks, phase swaps, camera resampling, peak reduction, and intensity, log, and phase-hue mapping run on the GPU. A reusable staging buffer maps once per frame. The live screens request packed RGBA8 tiles, one complex spectrum row for the diffraction profile, and one scalar for the transmitted power readout.

`FrameRecomputeScheduler` allows one pending submission per screen. Changes increment a revision and coalesce until the next available step. A completed frame's paint callback runs only if its revision is current. During a rebuild the previous painted image stays in place until the new backend finishes a frame. Backend or grid changes dispose the old engine and its buffers. The models replace sampled field sets on the next access at the new grid size. A painted Fourier mask starts open on a new grid.

Startup checks the compilation diagnostics and creates each compute pipeline before launch. Device loss or a runtime GPU error demotes to the CPU. A single dismissible message explains fallback across the screens for that run.

## Pupil cache

Both engines cache the normalized, centred OTF on their own grid. The first incoherent frame for a pupil zero-pads it to 2N per side, transforms it, squares the spectrum magnitude, transforms back, then extracts the centred lags and divides by zero lag. A closed pupil yields an all-zero OTF. The cache key covers grid size and pitch, iris diameter, wavelength, first focal length and defocus. Magnification enters the key when defocus changes the transfer function on the sampled pupil. Changes to the object or camera magnification at zero defocus can reuse the OTF.

## Spectrum zoom and measurement

Screens 2–4 offer ×1, ×2, ×4, and ×8 centred crops. The transform screen's profile and physical scale follow the crop. The filtering and 4f views use the same bin-to-view mapping for the raster, overlay and input tools. Aperture and preset selections choose an initial zoom that shows the relevant features. At higher resolution a fixed-size aperture has more surrounding zero samples, so its diffraction pattern is sampled more finely over the same frequency span. The focal image also interpolates the displayed pixels when scaled to the panel.

`?timing` logs median completed-frame time after the first frame, including display conversion, GPU readback and canvas update. It uses up to 60 recent samples per screen, backend, grid and illumination mode. Spatial Filtering uses coherent illumination. The 4f screen supports both coherent and incoherent measurements.
