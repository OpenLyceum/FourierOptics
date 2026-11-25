# Model — Fourier Optics

The model samples a monochromatic scalar field $U$ on a periodic square grid. Each sample stores a complex amplitude, and the measured intensity is $I=|U|^2$. The discrete power is $\sum |U|^2$. Multiply by the sample area for an area-weighted sum.

## Sampling and transforms

Fields use row-major interleaved Float32Array samples in real, imaginary order. The grid size $N$ is a power of two. The simulation range is 64–1024. Both object and Fourier grids place their origin at index $(N/2,N/2)$. The $x$ axis points right and $y$ points down through the rows. Positive angles turn from $+x$ toward $+y$.

The raw forward FFT uses $e^{-2\pi i(k_xx+k_yy)/N}$ with unit scale. The inverse has the positive exponent and divides by $N^2$ in 2D. The engine applies ifftshift before a raw transform and fftshift after it. DC is therefore at the centre, a positive complex tilt appears at positive frequency, and the Nyquist bin occupies the negative edge on each axis.

The numerical rasterizer takes lengths in samples. On the Fourier Transform screen, the aperture controls specify lengths in µm, which the model divides by the fixed 10 µm sample pitch. Increasing $N$ adds surrounding grid area for finite apertures and reduces the frequency-bin spacing while preserving aperture size. Slits and gratings that extend across the periodic grid keep their widths or periods. Hard aperture edges average complex transmission over a 4×4 subpixel grid. A phase disk transmits $e^{i\varphi}$ inside and 1 outside. Smooth gratings are sampled at grid points as $b[1+\sum_j c_j\cos(2\pi(x\cos\theta_j+y\sin\theta_j)/p_j+\phi_j)]$ with up to three terms. Fourier mask radii and slit widths are measured in bins. Masks are sampled at bin centres, and composed masks multiply their complex transmissions. A slit angle points along its normal.

## Physical scales

| Quantity | API unit | Default | Suggested control range |
|---|---|---:|---:|
| Grid size $N$ | Samples per side | 256 | Powers of two, 64–1024 |
| Grid pitch $\Delta x$ | µm | 10 | Fixed in the simulation |
| Wavelength $\lambda$ | nm | 550 | 380–750 |
| Focal lengths $f_1, f_2$ | mm | 100 each | 25–250 |
| Iris diameter $D$ | mm | 2 | 0–10 |
| Propagation distance $\Delta z$ | mm | — | Signed |

Spatial frequency is measured in cycles/µm, with bin spacing $\Delta\nu=1/(N\Delta x)$. With wavelength converted to µm, $x_f=\lambda f\nu$ gives the focal-plane coordinate in mm. The displayed focal span is the crop width in bins multiplied by $\lambda f\Delta\nu$. Its maximum is the full sampled span $\lambda f/\Delta x$. The default circle has a radius of 180 µm. At 550 nm and 100 mm focal length, about five Airy minima fit along the radius of the 1.65 mm default view. The pupil radius in bins is $\nu_c/\Delta\nu$, where $\nu_c=D/(2\lambda f_1)$ is the object-side coherent cutoff. The limiting coherent period is $1/\nu_c$, and the incoherent cutoff is $2\nu_c$.

## Propagation and imaging

- **Chapter 7, Angular Spectrum Method.** Propagation multiplies the spectrum by $H=\exp[i2\pi\Delta z\sqrt{\lambda^{-2}-\nu_x^2-\nu_y^2}]$ using µm throughout the phase. Evanescent bins are zeroed for either sign of distance. Propagating bins recover their original phase after an equal reverse step.
- **Chapter 7, Fourier Optics.** A lens maps the complex transform to its focal plane. The on-axis-normalized rectangle amplitude is $\operatorname{sinc}(a\nu_x)\operatorname{sinc}(b\nu_y)$, with $\operatorname{sinc}(s)=\sin(\pi s)/(\pi s)$. A circular opening of diameter $d$ gives $2J_1(u)/u$ with $u=\pi d\lvert\boldsymbol{\nu}\rvert$, producing the first dark ring at $1.22\lambda f/d$.
- **Chapter 7, Imaging by a lens.** Incoherent imaging filters the object's intensity spectrum by the normalized pupil autocorrelation $C[k]=\sum_j P[j+k]P[j]^*/\sum_j \lvert P[j]\rvert^2$. The pupil is zero-padded before correlation to avoid periodic overlap. A closed pupil yields zero output. The image is the real part of the discrete result. Practical resolution is also limited by Nyquist sampling.
- **Chapter 7, Spatial Light Modulators and Optical Fourier Filtering.** In ideal filtering, the masked spectrum goes through the inverse FFT. In 4f mode lens 2 performs another forward FFT, so an open pupil yields $U(-x,-y)$ with periodic indices. The second forward FFT is divided by $N^2$ to match ideal-filter amplitude. Signed magnification is $-f_2/f_1$. The returned array already includes the inversion, with physical image spacing $\lvert f_2/f_1\rvert\Delta x$.
- **Chapter 9, Phase Contrast Microscope.** With a weak phase object $U\approx1+i\varphi$, adding $+\pi/2$ to the undeviated DC term makes phase variation visible. Intensity contrast relative to the surrounding medium is approximately $2\varphi$. A DC block instead removes the mean field. A wider blocked neighbourhood also suppresses slowly varying structure, emphasizing edges.

The model omits absolute lens phase and throughput factors, polarization, and partial coherence. Finite sampling clips the representable frequency band and makes object-plane convolutions periodic.
