/** Normalized sinc, with x in cycles. */
export function sinc(x: number): number {
  return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
}

/** On-axis-normalized far-field amplitude. Dimensions and frequencies use reciprocal units. */
export function rectangularApertureAmplitude(width: number, height: number, fx: number, fy: number): number {
  return sinc(width * fx) * sinc(height * fy);
}

// J₁ approximation from OpenLyceum/DiffractionLab src/common/model/airy.ts,
// based on Numerical Recipes in C, 2nd ed., §6.5 (bessj1).
function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const numerator =
      x *
      (72362614232.0 +
        y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const denominator =
      144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return numerator / denominator;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const p = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const q = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const result = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
  return x < 0 ? -result : result;
}

/** On-axis-normalized Airy amplitude at radial frequency, in reciprocal diameter units. */
export function airyAmplitude(diameter: number, radialFrequency: number): number {
  const u = Math.PI * diameter * radialFrequency;
  return Math.abs(u) < 1e-4 ? 1 - (u * u) / 8 : (2 * besselJ1(u)) / u;
}
