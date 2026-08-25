import type { Node } from "three/webgpu";
import {
  Fn,
  convertToTexture,
  dot,
  fract,
  screenUV,
  sin,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

export const filmGrainUniforms = {
  grainAmount: /*@__PURE__*/ uniform(0.055),
  aberration: /*@__PURE__*/ uniform(0.0016),
  time: /*@__PURE__*/ uniform(0),
};

const grainHash = /*@__PURE__*/ Fn(([point]: [Node<"vec2">]) =>
  fract(sin(dot(point, vec2(12.9898, 78.233))).mul(43758.5453)),
);
grainHash.setLayout({
  name: "grainHash",
  type: "float",
  inputs: [{ name: "point", type: "vec2" }],
});

export function filmGrainNode(input: Node<"vec4">) {
  const source = convertToTexture(input);

  return Fn(() => {
    const centered = screenUV.sub(0.5).toVar("grainCentered");
    const radius = dot(centered, centered);
    const offset = centered.mul(radius).mul(filmGrainUniforms.aberration).toVar("grainOffset");

    const color = vec4(
      source.sample(screenUV.add(offset)).r,
      source.sample(screenUV).g,
      source.sample(screenUV.sub(offset)).b,
      1,
    ).toVar("grainColor");

    const luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    const shadowWeight = smoothstep(1, 0.15, luma);
    const noise = grainHash(
      screenUV.mul(1024).add(fract(filmGrainUniforms.time).mul(91.7)),
    ).sub(0.5);

    color.rgb.addAssign(noise.mul(filmGrainUniforms.grainAmount).mul(shadowWeight));
    return color;
  })();
}
