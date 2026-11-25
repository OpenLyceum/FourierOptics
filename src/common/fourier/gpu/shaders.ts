const bindings = /* wgsl */ `
struct Params {
  n: u32, stage: u32, operation: u32, flags: u32,
  a: f32, b: f32, c: f32, d: f32,
}
@group(0) @binding(0) var<storage, read> source: array<vec2f>;
@group(0) @binding(1) var<storage, read> extra: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> output: array<u32>;
@group(0) @binding(3) var<storage, read_write> peak: atomic<u32>;
@group(0) @binding(4) var<uniform> p: Params;

fn writeComplex(i: u32, value: vec2f) {
  output[2u * i] = bitcast<u32>(value.x);
  output[2u * i + 1u] = bitcast<u32>(value.y);
}
fn multiply(a: vec2f, b: vec2f) -> vec2f {
  return vec2f(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}
fn intensity(z: vec2f) -> f32 { return dot(z, z); }
`;

export const FFT_SHADER =
  bindings +
  /* wgsl */ `
fn index(along: u32, line: u32) -> u32 {
  return select(line * p.n + along, along * p.n + line, (p.flags & 1u) != 0u);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let half = p.n / 2u;
  // Adjacent lanes always visit adjacent physical columns, including the vertical passes.
  let vertical = (p.flags & 1u) != 0u;
  let i = select(id.x, id.y, vertical);
  let line = select(id.y, id.x, vertical);
  if (i >= half || line >= p.n) { return; }
  let j = i % p.stage;
  let k = 2u * (i - j) + j;
  var w = extra[j * (half / p.stage)];
  if ((p.flags & 2u) != 0u) { w.y = -w.y; }
  let a = source[index(i, line)];
  let b = multiply(w, source[index(i + half, line)]);
  writeComplex(index(k, line), a + b);
  writeComplex(index(k + p.stage, line), a - b);
}
`;

export const FIELD_SHADER =
  bindings +
  /* wgsl */ `
fn realSample(i: u32) -> f32 {
  return source[i / 2u][i % 2u];
}
fn cameraSample(point: vec2i) -> f32 {
  let n = i32(p.n);
  if (any(point < vec2i(0)) || any(point >= vec2i(n))) { return 0.0; }
  let i = u32(point.y * n + point.x);
  if (p.flags == 1u) { return max(0.0, source[i].x); }
  return intensity(source[i]);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = id.x;
  let y = id.y;
  if (x >= p.n || y >= p.n) { return; }
  let i = y * p.n + x;
  var value: vec2f;
  switch p.operation {
    case 0u: { // Modulation and scaling on either side of the unshifted FFT.
      let sign = select(1.0, -1.0, p.flags == 1u && ((x + y) & 1u) != 0u);
      value = source[i] * (p.a * sign);
    }
    case 1u: { value = multiply(source[i], extra[i]); }
    case 2u: { // Pad pupil in the upper-left corner for linear autocorrelation.
      let n = p.n / 2u;
      if (x < n && y < n) { value = source[y * n + x]; }
    }
    case 3u: { value = vec2f(intensity(source[i]), 0.0); }
    case 4u: { value = vec2f(realSample(i), 0.0); }
    case 5u: {
      let donor = extra[i];
      let lengthDonor = length(donor);
      var phase = vec2f(1.0, 0.0);
      if (lengthDonor > 0.0) { phase = donor / lengthDonor; }
      value = length(source[i]) * phase;
    }
    case 6u: { // Camera, with intensity interpolation at fixed object-side pitch.
      let c = f32(p.n / 2u);
      let position = (vec2f(f32(x), f32(y)) - c) / p.a + c;
      let cell = vec2i(floor(position));
      let weight = fract(position);
      let top = mix(cameraSample(cell), cameraSample(cell + vec2i(1, 0)), weight.x);
      let bottom = mix(cameraSample(cell + vec2i(0, 1)), cameraSample(cell + vec2i(1, 1)), weight.x);
      value = vec2f(sqrt(mix(top, bottom, weight.y)), 0.0);
    }
    case 7u: { // Normalize at zero lag and extract the centred N x N OTF.
      let padded = 2u * p.n;
      let lag = (vec2u(x, y) + padded - p.n / 2u) % padded;
      let dc = source[0].x;
      if (dc > 0.0) { value = source[lag.y * padded + lag.x] / dc; }
    }
    case 8u: { output[i] = bitcast<u32>(source[i].x); return; }
    default: {}
  }
  writeComplex(i, value);
}
`;

export const REDUCE_SHADER =
  bindings +
  /* wgsl */ `
var<workgroup> values: array<f32, 64>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u,
        @builtin(local_invocation_index) lane: u32, @builtin(workgroup_id) group: vec3u) {
  let i = id.x + id.y * p.n;
  var v = 0.0;
  if (p.flags == 2u) {
    for (var offset = lane; offset < p.stage; offset += 64u) {
      v += source[offset / 2u][offset % 2u];
    }
  } else if (id.x < p.n) { v = intensity(source[i]); }
  values[lane] = v;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride /= 2u) {
    if (lane < stride) {
      let next = values[lane + stride];
      values[lane] = select(max(values[lane], next), values[lane] + next, p.flags != 0u);
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    if (p.flags != 0u) {
      output[group.y * ((p.n + 63u) / 64u) + group.x] = bitcast<u32>(values[0]);
    } else {
      atomicMax(&peak, bitcast<u32>(values[0]));
    }
  }
}
`;

export const DISPLAY_SHADER =
  bindings +
  /* wgsl */ `
fn hueChannel(hue: f32, offset: f32) -> f32 {
  let k = (hue + offset) % 6.0;
  return 1.0 - clamp(min(k, 4.0 - k), 0.0, 1.0);
}
fn srgb(linear: vec3f) -> vec3f {
  let x = clamp(linear, vec3f(0.0), vec3f(1.0));
  return select(12.92 * x, 1.055 * pow(x, vec3f(1.0 / 2.4)) - 0.055, x > vec3f(0.0031308));
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let crop = p.stage;
  if (id.x >= crop || id.y >= crop) { return; }
  let start = (p.n - crop) / 2u;
  let z = source[(id.y + start) * p.n + id.x + start];
  let maximum = bitcast<f32>(atomicLoad(&peak));
  var color = vec3f(0.0);
  if (maximum > 0.0) {
    let level = intensity(z) / maximum;
    if (p.flags == 3u) {
      let hue = (6.0 * atan2(z.y, z.x) / 6.28318530718 + 6.0) % 6.0;
      if (level > 0.0) {
        color = sqrt(level) * vec3f(hueChannel(hue, 5.0), hueChannel(hue, 3.0), hueChannel(hue, 1.0));
      }
    } else {
      var brightness = level;
      if (p.flags == 1u) { brightness = max(0.0, 1.0 + 10.0 * log2(max(level, 1e-38)) / log2(10.0) / p.a); }
      if (p.flags == 2u) { brightness = sqrt(level); }
      color = brightness * vec3f(p.b, p.c, p.d);
    }
  }
  output[id.y * crop + id.x] = pack4x8unorm(vec4f(srgb(color), 1.0));
}
`;
