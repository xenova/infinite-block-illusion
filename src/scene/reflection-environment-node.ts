import * as THREE from "three";
import { NodeMaterial, PMREMGenerator } from "three/webgpu";
import type { Renderer } from "three/webgpu";
import {
  Fn,
  abs,
  clamp,
  cos,
  dot,
  exp,
  float,
  max,
  mix,
  normalize,
  positionGeometry,
  pow,
  smoothstep,
  uniform,
} from "three/tsl";

type EnvironmentPalette = {
  zenith: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  ground: THREE.ColorRepresentation;
  sun: THREE.ColorRepresentation;
  sunIntensity: number;
  skyIntensity: number;
  sunSize: number;
  sunDirection: THREE.Vector3;
};

type SceneEnvironment = {
  readonly texture: THREE.Texture;
  update: (palette: EnvironmentPalette) => THREE.Texture;
  capture: () => { texture: THREE.Texture; dispose: () => void };
  dispose: () => void;
};

const REFERENCE_SUN_SIZE = 0.085;

function createEnvironmentUniforms() {
  return {
    zenith: uniform(new THREE.Color()),
    horizon: uniform(new THREE.Color()),
    ground: uniform(new THREE.Color()),
    sunColor: uniform(new THREE.Color()),
    sunDirection: uniform(new THREE.Vector3(0, 1, 0)),
    sunIntensity: uniform(1),
    skyIntensity: uniform(1),
    sunSize: uniform(0.09),
  };
}

type EnvironmentUniforms = ReturnType<typeof createEnvironmentUniforms>;

function skyColorNode(u: EnvironmentUniforms) {
  return Fn(() => {
    const direction = normalize(positionGeometry).toVar("environmentDirection");
    const height = direction.y.toVar("environmentHeight");

    const sky = mix(u.horizon, u.zenith, smoothstep(0, 0.62, height));
    const lit = mix(u.ground, sky, smoothstep(-0.06, 0.05, height))
      .add(u.horizon.mul(0.22).mul(exp(abs(height).negate().mul(12))))
      .toVar("environmentLit");

    const cosAngle = dot(direction, normalize(u.sunDirection)).toVar("environmentCosAngle");
    const sizeRatio = float(REFERENCE_SUN_SIZE).div(max(u.sunSize, 0.02));
    const discRadiance = clamp(sizeRatio.mul(sizeRatio), 0.02, 1);
    const haloPower = mix(float(26), float(4), clamp(u.sunSize.div(0.6), 0, 1));
    const disc = smoothstep(cos(u.sunSize.mul(2.2)), cos(u.sunSize), cosAngle);
    const halo = pow(max(cosAngle, 0), haloPower);
    const sun = u.sunColor
      .mul(u.sunIntensity)
      .mul(disc.mul(discRadiance).add(halo.mul(0.07)));

    return lit.mul(u.skyIntensity).add(sun);
  })();
}

export function createSceneEnvironmentNode(renderer: Renderer): SceneEnvironment {
  const environment = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(24, 48, 32);
  const uniforms = createEnvironmentUniforms();

  // A bare NodeMaterial avoids applying a lighting model to the emitted sky.
  const material = new NodeMaterial();
  material.colorNode = skyColorNode(uniforms);
  material.side = THREE.BackSide;
  material.depthWrite = false;
  material.toneMapped = false;

  environment.add(new THREE.Mesh(geometry, material));

  const generator = new PMREMGenerator(renderer);
  let target: THREE.RenderTarget | null = null;
  let ownsTarget = false;

  const requireTarget = () => {
    if (!target) throw new Error("The scene environment has not been baked yet");
    return target;
  };

  const update = (palette: EnvironmentPalette) => {
    uniforms.zenith.value.set(palette.zenith);
    uniforms.horizon.value.set(palette.horizon);
    uniforms.ground.value.set(palette.ground);
    uniforms.sunColor.value.set(palette.sun);
    uniforms.sunDirection.value.copy(palette.sunDirection);
    uniforms.sunIntensity.value = palette.sunIntensity;
    uniforms.skyIntensity.value = palette.skyIntensity;
    uniforms.sunSize.value = palette.sunSize;

    const next = generator.fromScene(environment);
    if (ownsTarget) target?.dispose();
    target = next;
    ownsTarget = true;
    return next.texture;
  };

  return {
    get texture() {
      return requireTarget().texture;
    },
    update,
    capture: () => {
      const captured = requireTarget();
      ownsTarget = false;
      return {
        texture: captured.texture,
        dispose: () => captured.dispose(),
      };
    },
    dispose: () => {
      if (ownsTarget) target?.dispose();
      generator.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
