import * as THREE from "three";
import { PointsNodeMaterial } from "three/webgpu";
import {
  Discard,
  Fn,
  If,
  abs,
  attribute,
  cameraProjectionMatrix,
  clamp,
  cos,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  positionView,
  screenDPR,
  sin,
  smoothstep,
  step,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

import { mulberry32, positiveModulo } from "../util/math";
import type { AtmosphereStyle, ResolvedSceneProfile } from "./scenes";

const ATMOSPHERE_LEVEL_CYCLE = 4;

// Mode values also seed the palette mix; changing them changes scene colors.
const ATMOSPHERE_MODE: Record<AtmosphereStyle, number> = {
  none: 0,
  dust: 1,
  embers: 2,
  aurora: 6,
  neon: 11,
};

const ATMOSPHERE_SPREAD = 30;
const ATMOSPHERE_MAX_PIXELS = 46;
const TAU = 6.28318530718;

function createQuadTemplate() {
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
      3,
    ),
  );
  quad.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  // Prevent flat-shading derivatives from writing NaNs into the normal MRT.
  quad.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
  );
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  return quad;
}

function createAtmosphereGeometry(
  count: number,
  cavityCenter: THREE.Vector3,
  cavityOnly: boolean,
  seed: number,
) {
  const random = mulberry32(seed);
  const centers = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    if (cavityOnly) {
      const radius = Math.sqrt(random()) * 0.72;
      const angle = random() * Math.PI * 2;
      centers[offset] = cavityCenter.x + Math.cos(angle) * radius;
      centers[offset + 1] = -0.22 - random() * 2.6;
      centers[offset + 2] = cavityCenter.z + Math.sin(angle) * radius;
      sizes[index] = 0.7 + random() * 1.3;
    } else {
      centers[offset] = (random() - 0.5) * 7.2;
      centers[offset + 1] = 0.05 + random() * 2.9;
      centers[offset + 2] = (random() - 0.5) * 7.2;
      sizes[index] = 0.45 + random() * 1.15;
    }
    seeds[index] = random();
  }

  const geometry = createQuadTemplate();
  geometry.instanceCount = count;
  geometry.setAttribute(
    "effectCenter",
    new THREE.InstancedBufferAttribute(centers, 3),
  );
  geometry.setAttribute(
    "effectSeed",
    new THREE.InstancedBufferAttribute(seeds, 1),
  );
  geometry.setAttribute(
    "effectSize",
    new THREE.InstancedBufferAttribute(sizes, 1),
  );
  return geometry;
}

function createAtmosphereUniforms() {
  return {
    phase: uniform(0),
    depthScale: uniform(1),
    rate: uniform(3),
    strength: uniform(0),
    weight: uniform(0),
    mode: uniform(ATMOSPHERE_MODE.none),
    colorA: uniform(new THREE.Color(0xffffff)),
    colorB: uniform(new THREE.Color(0x8ab9ff)),
    squareness: uniform(0),
  };
}

type AtmosphereUniforms = ReturnType<typeof createAtmosphereUniforms>;

function atmospherePosition(u: AtmosphereUniforms) {
  const center = attribute<"vec3">("effectCenter", "vec3");
  const seed = attribute<"float">("effectSeed", "float");

  return Fn(() => {
    const age = fract(
      u.phase.mul(u.rate.add(floor(seed.mul(4)))).add(seed),
    ).toVar("atmosphereAge");

    const point = vec3(center).toVar("atmospherePoint");
    const orbit = u.phase.mul(TAU);
    const wave = sin(orbit.mul(float(2).add(floor(seed.mul(3)))).add(seed.mul(31)));
    const swirl = cos(orbit.mul(float(1).add(floor(seed.mul(2)))).add(seed.mul(19)));

    If(u.mode.greaterThanEqual(ATMOSPHERE_MODE.dust), () => {
      If(u.mode.lessThan(ATMOSPHERE_MODE.embers), () => {
        point.x.addAssign(wave.mul(0.13));
        point.y.addAssign(swirl.mul(0.09));
        point.z.addAssign(sin(orbit.mul(3).add(seed.mul(23))).mul(0.11));
      }).ElseIf(u.mode.lessThan(ATMOSPHERE_MODE.aurora), () => {
        point.x.addAssign(wave.mul(float(0.12).add(age.mul(0.24))));
        point.y.addAssign(age.mul(float(1.2).add(seed.mul(1.25))));
        point.z.addAssign(swirl.mul(float(0.12).add(age.mul(0.2))));
      }).ElseIf(u.mode.lessThan(ATMOSPHERE_MODE.neon), () => {
        point.x.addAssign(
          sin(orbit.mul(2).add(point.y.mul(2.4)).add(seed.mul(14))).mul(0.34),
        );
        point.z.addAssign(
          cos(orbit.add(point.y.mul(2.1)).add(seed.mul(16))).mul(0.24),
        );
        point.y.addAssign(sin(orbit.mul(3).add(seed.mul(11))).mul(0.16));
      }).Else(() => {
        point.x.addAssign(wave.mul(0.08));
        point.y.addAssign(sin(orbit.mul(5).add(seed.mul(37))).mul(0.08));
        point.z.addAssign(swirl.mul(0.08));
      });
    });

    return point;
  })();
}

function atmosphereScale(u: AtmosphereUniforms) {
  const seed = attribute<"float">("effectSeed", "float");
  return Fn(() => {
    const scale = float(0).toVar("atmosphereScale");
    If(u.mode.greaterThanEqual(ATMOSPHERE_MODE.dust), () => {
      If(u.mode.lessThan(ATMOSPHERE_MODE.embers), () => {
        scale.assign(2.6);
      }).ElseIf(u.mode.lessThan(ATMOSPHERE_MODE.aurora), () => {
        scale.assign(3.2);
      }).ElseIf(u.mode.lessThan(ATMOSPHERE_MODE.neon), () => {
        scale.assign(5.7);
      }).Else(() => {
        scale.assign(float(3.5).add(step(0.82, seed).mul(1.5)));
      });
    });
    return scale;
  })();
}

function atmosphereDepth(u: AtmosphereUniforms) {
  return max(0.25, positionView.z.negate().div(u.depthScale));
}

export function createSceneAtmosphereNode(
  scene: THREE.Scene,
  cavityCenter: THREE.Vector3,
) {
  const perSlot = <T>(build: (slot: number) => T) =>
    Array.from({ length: ATMOSPHERE_LEVEL_CYCLE }, (_, slot) => build(slot));
  const ambientGeometries = perSlot((slot) =>
    createAtmosphereGeometry(84, cavityCenter, false, 4219 + slot * 7717),
  );
  const cavityGeometries = perSlot((slot) =>
    createAtmosphereGeometry(42, cavityCenter, true, 9187 + slot * 7717),
  );

  const createEffectLayer = (geometry: THREE.BufferGeometry, cavityOnly: boolean) => {
    const u = createAtmosphereUniforms();
    const seed = attribute<"float">("effectSeed", "float");
    const size = attribute<"float">("effectSize", "float");

    const material = new PointsNodeMaterial();
    material.sizeAttenuation = false;
    material.positionNode = atmospherePosition(u);

    const depth = atmosphereDepth(u);
    const pulse = float(0.72).add(
      sin(u.phase.mul(TAU).mul(4).add(seed.mul(41))).mul(0.28),
    );
    const sprite = size
      .mul(atmosphereScale(u))
      .mul(pulse)
      .mul(float(ATMOSPHERE_SPREAD).div(depth));
    // PointsNodeMaterial applies DPR after sizeNode; keep the clamp in device pixels.
    material.sizeNode = clamp(sprite, 1, ATMOSPHERE_MAX_PIXELS).div(screenDPR);

    const age = fract(u.phase.mul(u.rate.add(floor(seed.mul(4)))).add(seed));
    const life = smoothstep(0, 0.12, age).mul(smoothstep(0.72, 1, age).oneMinus());
    const nearFade = smoothstep(0.35, 1.2, depth);
    const centreClip = cameraProjectionMatrix.mul(vec4(positionView, 1));
    const centreOnScreen = step(
      max(abs(centreClip.x), abs(centreClip.y)),
      centreClip.w,
    );
    const alpha = life
      .mul(u.strength)
      .mul(u.weight)
      .mul(nearFade)
      .mul(centreOnScreen)
      .toVarying("atmosphereAlpha");

    material.colorNode = mix(
      u.colorA,
      u.colorB,
      float(0.5).add(sin(seed.mul(39).add(u.mode.mul(2))).mul(0.5)),
    );

    material.opacityNode = Fn(() => {
      const offset = uv().sub(vec2(0.5)).toVar("atmosphereOffset");
      const radius = length(offset).mul(2);
      const box = max(abs(offset.x), abs(offset.y)).mul(2);
      const roundCore = smoothstep(0, 1, radius).oneMinus().pow(1.55);
      const squareCore = smoothstep(0.78, 0.92, box).oneMinus();
      const core = mix(roundCore, squareCore, u.squareness).toVar("atmosphereCore");
      Discard(core.lessThanEqual(0.002));
      return core.mul(alpha);
    })();

    material.transparent = true;
    material.depthTest = true;
    material.depthWrite = false;
    material.blending = THREE.AdditiveBlending;

    // The mesh path expands each instance into a sized quad on WebGPU.
    const points = new THREE.Mesh(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = cavityOnly ? -5 : 2;
    const root = new THREE.Group();
    root.matrixAutoUpdate = false;
    root.visible = false;
    root.add(points);
    scene.add(root);
    return { root, material, points, uniforms: u };
  };

  const layers = Array.from({ length: 2 }, () => {
    const ambient = createEffectLayer(ambientGeometries[0], false);
    const cavity = createEffectLayer(cavityGeometries[0], true);
    return { ambient, cavity, effects: [ambient, cavity] };
  });
  const allEffects = layers.flatMap((layer) => layer.effects);

  const state = {
    mode: ATMOSPHERE_MODE.none,
    strength: 0,
    rate: 3,
    squareness: 0,
    colorA: new THREE.Color(0xffffff),
    colorB: new THREE.Color(0x8ab9ff),
  };

  const applyState = () => {
    const atmosphereVisible =
      state.strength > 0.0001 && state.mode !== ATMOSPHERE_MODE.none;
    for (const effect of allEffects) {
      effect.root.visible = atmosphereVisible;
      effect.uniforms.mode.value = state.mode;
      effect.uniforms.strength.value = state.strength;
      effect.uniforms.squareness.value = state.squareness;
      effect.uniforms.rate.value = Math.max(1, Math.round(state.rate));
      effect.uniforms.colorA.value.copy(state.colorA);
      effect.uniforms.colorB.value.copy(state.colorB);
    }
  };

  const setProfile = (profile: ResolvedSceneProfile) => {
    state.mode = ATMOSPHERE_MODE[profile.atmosphere];
    state.strength = profile.atmosphereStrength;
    state.rate = profile.atmosphereRate;
    state.squareness = profile.atmosphereSquareness;
    state.colorA.setHex(profile.atmosphereColor);
    state.colorB.setHex(profile.atmosphereSecondary);
    applyState();
  };

  const update = ({
    phase,
    baseLevel,
    depthScale,
    parentMatrix,
    childMatrix,
    parentWeight,
    childWeight,
  }: {
    phase: number;
    baseLevel: number;
    depthScale: number;
    parentMatrix: THREE.Matrix4;
    childMatrix: THREE.Matrix4;
    parentWeight: number;
    childWeight: number;
  }) => {
    // Layer 0 rides the current recursion level, layer 1 the one it hands off to.
    for (const [index, layer] of layers.entries()) {
      const slot = positiveModulo(baseLevel + index, ATMOSPHERE_LEVEL_CYCLE);
      const matrix = index === 0 ? parentMatrix : childMatrix;
      const weight = index === 0 ? parentWeight : childWeight;
      layer.ambient.points.geometry = ambientGeometries[slot];
      layer.cavity.points.geometry = cavityGeometries[slot];
      for (const effect of layer.effects) {
        effect.root.matrix.copy(matrix);
        effect.root.matrixWorldNeedsUpdate = true;
        effect.uniforms.phase.value = phase;
        effect.uniforms.depthScale.value = depthScale;
        effect.uniforms.weight.value = weight;
      }
    }
  };

  return {
    setProfile,
    update,
    dispose: () => {
      for (const effect of allEffects) {
        scene.remove(effect.root);
        effect.material.dispose();
      }
      for (const geometry of [...ambientGeometries, ...cavityGeometries]) {
        geometry.dispose();
      }
    },
  };
}
