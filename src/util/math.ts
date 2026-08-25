export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number) {
  return clamp(value, 0, 1);
}

/** Modulo that always returns a non-negative result, unlike `%`. */
export function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

/** Cosine ease-in-out over [0, 1]. */
export function sineEase(value: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(value));
}

/** Perlin's quintic smootherstep: zero first *and* second derivative at both ends. */
export function smootherstep(value: number) {
  const x = clamp01(value);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number) {
  return (radians * 180) / Math.PI;
}

/** Deterministic 32-bit PRNG so generated textures are identical every load. */
export function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function toCssColor(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}
