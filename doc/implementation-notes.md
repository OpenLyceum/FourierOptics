# Implementation notes — Fourier Optics

The four screen models own optical parameters and sampled inputs. The views schedule computation, render fields through `FieldImageNode`, and expose accessible controls and summaries. Numerical conventions and units are documented in [Model](model.md).

## Engines and frames

`FourierEngine.submit(encode)` gives a synchronous callback access to `FourierOperations`. The CPU runs the reference algorithms inline and returns the callback's value immediately. The GPU encodes a command stream and resolves with the callback's value after requested readbacks complete. Output fields may feed later operations in the same submission. GPU callers request numerical readback explicitly.

The GPU uses radix-2 Stockham autosort in interleaved f32 storage buffers. It dispatches once per stage on each axis, alternates between two work buffers, and caches twiddles per engine and transform size. A checkerboard sign before and after each centred transform implements the CPU's two shifts on an even square grid. The forward exponent is negative. Ideal inversion uses the positive exponent and 1/N² scaling. Two-lens imaging uses the negative exponent on both transforms and scales the second by 1/N². Propagation uses the same sampled angular-spectrum transfer as the CPU.

Complex masks, phase swaps, camera resampling, peak reduction, and intensity, log, and phase-hue mapping run on the GPU. A reusable staging buffer maps once per frame. The live screens request packed RGBA8 tiles, one complex spectrum row for the diffraction profile, and one scalar for the transmitted power readout.

`FrameRecomputeScheduler` allows one pending submission per screen. Changes increment a revision and coalesce until the next available step. A completed frame's paint callback runs only if its revision is current. During a rebuild the previous painted image stays in place until the new backend finishes a frame. Backend or grid changes dispose the old engine and its buffers. The models replace sampled field sets on the next access at the new grid size. A painted Fourier mask starts open on a new grid.

Automatic mode requests the default adapter and skips device creation when the adapter identifies itself as a fallback. Explicit GPU can use that adapter. Startup checks shader diagnostics and creates each pipeline before launch. Once an Automatic GPU screen completes eight submissions, the screen model tests their median elapsed time, including readback. Above 30 ms, a shared preference flag switches all screens in Automatic to the 256² CPU default even if a larger grid was requested. Explicit GPU bypasses that timing check. Device loss and runtime GPU errors also trigger CPU fallback. The badge shows the effective backend and resolution. A single dismissible notice explains the fallback for that session.

## Pupil cache

Both engines cache the normalized, centred OTF on their own grid. The first incoherent frame for a pupil zero-pads it to 2N per side, transforms it, squares the spectrum magnitude, transforms back, then extracts the centred lags and divides by zero lag. A closed pupil yields an all-zero OTF. The cache key covers grid size and pitch, iris diameter, wavelength, first focal length and defocus. Magnification enters the key when defocus changes the transfer function on the sampled pupil. Changes to the object or camera magnification at zero defocus can reuse the OTF.

## Spectrum zoom and measurement

Screen 2 sets the requested focal-plane span in mm. The control is limited to the physical
span supported by the current wavelength, focal length and fixed pitch. Fit pattern estimates
the diffraction extent from the current aperture dimensions and lens mapping. It targets the
fifth Airy minimum for a circle and uses characteristic widths or grating orders for the other
shapes. The displayed crop is rounded to even bins. The centreline profile and focal scale bar
use that crop, and the aperture view has its own µm scale. Focal image interpolation smooths the
display between samples.

Screens 3 and 4 offer ×1, ×2, ×4, ×8, ×16 and ×32 centred crops. Object and preset choices set an
initial zoom. Adjustable masks start at a wider view to keep their handles in reach. The raster,
overlays, iris outline and input coordinates share the same even-bin crop and half-pixel centring.
The weak phase object uses a diverging palette centred on neutral grey at zero phase. Its legend
spans ±0.2 rad, and the view colours the CPU-resident object raster on either backend.

`?timing` logs median completed-frame time after the first frame, including display conversion, GPU readback and canvas update. It uses up to 60 recent samples per screen, backend, grid and illumination mode. Spatial Filtering uses coherent illumination. The 4f screen supports both coherent and incoherent measurements.
