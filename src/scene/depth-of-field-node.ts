import type { Node } from "three/webgpu";
import {
  Fn,
  clamp,
  convertToTexture,
  screenUV,
  uniform,
  vec2,
  vec4,
} from "three/tsl";

// The original 41-tap BokehShader kernel, using the scene pass's view-space depth.
export const bokehUniforms = {
  focus: /*@__PURE__*/ uniform(1),
  aperture: /*@__PURE__*/ uniform(0.0006),
  maxBlur: /*@__PURE__*/ uniform(0.012),
  /** Drawing-buffer width / height. `BokehShader` corrects only the Y offsets. */
  aspect: /*@__PURE__*/ uniform(1),
};

type Tap = readonly [number, number];

const RING: readonly Tap[] = [
  [0.0, 0.4],
  [0.15, 0.37],
  [0.29, 0.29],
  [-0.37, 0.15],
  [0.4, 0.0],
  [0.37, -0.15],
  [0.29, -0.29],
  [-0.15, -0.37],
  [0.0, -0.4],
  [-0.15, 0.37],
  [-0.29, 0.29],
  [0.37, 0.15],
  [-0.4, 0.0],
  [-0.37, -0.15],
  [-0.29, -0.29],
  [0.15, -0.37],
];

const RING_OUTER: readonly Tap[] = [
  [0.15, 0.37],
  [-0.37, 0.15],
  [0.37, -0.15],
  [-0.15, -0.37],
  [-0.15, 0.37],
  [0.37, 0.15],
  [-0.37, -0.15],
  [0.15, -0.37],
];

const RING_INNER: readonly Tap[] = [
  [0.29, 0.29],
  [0.4, 0.0],
  [0.29, -0.29],
  [0.0, -0.4],
  [-0.29, 0.29],
  [-0.4, 0.0],
  [-0.29, -0.29],
  [0.0, 0.4],
];

const scaled = (ring: readonly Tap[], factor: number): Tap[] =>
  ring.map(([x, y]) => [x * factor, y * factor] as Tap);

const TAPS: readonly Tap[] = [
  ...RING,
  ...scaled(RING_OUTER, 0.9),
  ...scaled(RING_INNER, 0.7),
  ...scaled(RING_INNER, 0.4),
];

const TAP_COUNT = TAPS.length + 1;

export function bokehNode(input: Node<"vec4">, viewZ: Node<"float">) {
  const source = convertToTexture(input);

  return Fn(() => {
    const blur = clamp(
      bokehUniforms.focus.add(viewZ).mul(bokehUniforms.aperture),
      bokehUniforms.maxBlur.negate(),
      bokehUniforms.maxBlur,
    ).toVar("bokehBlur");
    const radius = vec2(blur, blur.mul(bokehUniforms.aspect)).toVar("bokehRadius");

    const accum = source.sample(screenUV).rgb.toVar("bokehAccum");
    for (const [x, y] of TAPS) {
      accum.addAssign(source.sample(screenUV.add(radius.mul(vec2(x, y)))).rgb);
    }

    return vec4(accum.div(TAP_COUNT), 1);
  })();
}
