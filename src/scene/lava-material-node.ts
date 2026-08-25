import type { MeshPhysicalNodeMaterial, Node } from "three/webgpu";
import {
  Fn,
  abs,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  mat2,
  materialEmissive,
  max,
  mix,
  normalGeometry,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";

import { surfaceGradeColor } from "./surface-grade-node";

const lavaPhase = /*@__PURE__*/ uniform(0);

// TSL's row-major argument order requires the transposed GLSL rotation matrix.
const LAVA_ROTATION = /*@__PURE__*/ mat2(0.8, -0.6, 0.6, 0.8);

const lavaHash = /*@__PURE__*/ Fn(([point]: [Node<"vec2">]) =>
  fract(sin(dot(point, vec2(127.1, 311.7))).mul(43758.5453123)),
);
lavaHash.setLayout({
  name: "lavaHash",
  type: "float",
  inputs: [{ name: "point", type: "vec2" }],
});

const lavaNoise = /*@__PURE__*/ Fn(([point]: [Node<"vec2">]) => {
  const cell = floor(point).toVar();
  const local = fract(point).toVar();
  const curve = local.mul(local).mul(float(3).sub(local.mul(2))).toVar();
  const a = lavaHash(cell);
  const b = lavaHash(cell.add(vec2(1, 0)));
  const c = lavaHash(cell.add(vec2(0, 1)));
  const d = lavaHash(cell.add(vec2(1, 1)));
  return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
});
lavaNoise.setLayout({
  name: "lavaNoise",
  type: "float",
  inputs: [{ name: "point", type: "vec2" }],
});

const lavaFbm = /*@__PURE__*/ Fn(([startPoint]: [Node<"vec2">]) => {
  let point: Node<"vec2"> = vec2(startPoint);
  let value: Node<"float"> = float(0);
  let amplitude = 0.5;
  for (let octave = 0; octave < 5; octave += 1) {
    value = value.add(lavaNoise(point).mul(amplitude));
    point = LAVA_ROTATION.mul(point).mul(2.03).add(vec2(13.7, 9.2));
    amplitude *= 0.5;
  }
  return value;
});
lavaFbm.setLayout({
  name: "lavaFbm",
  type: "float",
  inputs: [{ name: "startPoint", type: "vec2" }],
});

const lavaField = /*@__PURE__*/ (() => {
  const objectNormal = normalGeometry.normalize();
  const alignment = max(
    abs(objectNormal.x),
    max(abs(objectNormal.y), abs(objectNormal.z)),
  );
  const edgeCooling = float(1)
    .sub(smoothstep(0.72, 0.999, alignment))
    .toVar("lavaEdgeCooling");

  const orbitA = vec2(cos(lavaPhase), sin(lavaPhase));
  const swirl = lavaPhase.mul(-2).add(1.7);
  const orbitB = vec2(cos(swirl), sin(swirl));
  const point = uv().mul(3.6);

  const warpA = lavaFbm(point.mul(1.15).add(orbitA.mul(0.62))).toVar("lavaWarpA");
  const warpB = lavaFbm(
    point.mul(2.05).add(orbitB.mul(0.42)).add(warpA.mul(1.85)),
  ).toVar("lavaWarpB");
  const field = lavaFbm(
    point.add(vec2(warpA, warpB).mul(2.45)).add(orbitB.mul(0.24)),
  ).toVar("lavaFieldValue");

  const fissureA = float(1).sub(smoothstep(0.018, 0.115, abs(field.sub(0.52))));
  const fissureB = float(1)
    .sub(smoothstep(0.018, 0.09, abs(warpB.sub(0.61))))
    .mul(0.58);
  const pulse = float(0.84).add(sin(lavaPhase.add(field.mul(12))).mul(0.16));
  const heat = clamp(max(fissureA, fissureB).mul(pulse), 0, 1).toVar("lavaHeat");

  return { heat, edgeCooling, field };
})();

const lavaSurface = /*@__PURE__*/ (() => {
  const { heat, field } = lavaField;
  const ember = smoothstep(0.58, 0.82, field).mul(0.28);
  const crust = mix(
    vec3(0.011, 0.0035, 0.0018),
    vec3(0.33, 0.15, 0.086),
    smoothstep(0.16, 0.84, field),
  );
  const hotRock = vec3(0.95, 0.085, 0.004);
  const surface = crust.add(hotRock.mul(heat.mul(0.44).add(ember.mul(0.12))));
  return surfaceGradeColor(surface);
})();

const lavaRoughness = /*@__PURE__*/ (() => {
  const { heat, edgeCooling } = lavaField;
  const base = mix(float(0.78), float(0.24), heat).toVar();
  return mix(base, max(base, 0.68), edgeCooling.mul(0.45));
})();

// `emissiveNode` replaces the material value, so preserve the base emission.
const lavaEmission = /*@__PURE__*/ (() => {
  const { heat, edgeCooling } = lavaField;
  const glow = vec3(3.15, 0.34, 0.012)
    .mul(pow(heat, 1.35))
    .mul(mix(float(1), float(0.55), edgeCooling));
  return materialEmissive.rgb.add(glow);
})();

export function addLavaShaderNode(material: MeshPhysicalNodeMaterial) {
  material.colorNode = lavaSurface;
  material.roughnessNode = lavaRoughness;
  material.emissiveNode = lavaEmission;
}

export function setLavaPhase(phase: number) {
  lavaPhase.value = phase;
}
