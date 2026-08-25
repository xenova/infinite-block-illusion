import * as THREE from "three";
import { PhysicalLightingModel } from "three/webgpu";
import type { MeshPhysicalNodeMaterial, Node, NodeBuilder } from "three/webgpu";
import {
  Fn,
  If,
  diffuseColor,
  dot,
  exp,
  float,
  max,
  mix,
  normalWorld,
  normalize,
  positionWorld,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";

export const cavityUniforms = {
  color: uniform(new THREE.Color(0x1264ff)),
  strength: uniform(0),
  worldCenter: uniform(new THREE.Vector3()),
  scale: uniform(1),
  aboveBounce: uniform(0.16),
};

// Keep these functions inline: layouts cannot safely close over shared uniforms.
const cavityWallField = /*@__PURE__*/ Fn((
  [worldPosition, worldNormal]: [Node<"vec3">, Node<"vec3">],
) => {
  const safeScale = max(cavityUniforms.scale, 0.00001);
  const localPosition = worldPosition
    .sub(cavityUniforms.worldCenter)
    .div(safeScale)
    .toVar("cavityLocalPosition");
  const localNormal = normalize(worldNormal).toVar("cavityLocalNormal");

  const radial2 = dot(localPosition.xz, localPosition.xz).toVar("cavityRadial2");
  const footprint = float(1).div(
    float(1)
      .add(float(0.62).mul(radial2))
      .add(float(0.1).mul(radial2).mul(radial2)),
  );

  const sourceDirection = normalize(vec3(0, -0.72, 0).sub(localPosition));
  const sourceFacing = smoothstep(-0.75, 0.85, dot(localNormal, sourceDirection));
  const normalResponse = float(0.28).add(float(0.72).mul(sourceFacing));

  const signedDepth = localPosition.y.negate().toVar("cavitySignedDepth");
  const depth = max(float(0), signedDepth).toVar("cavityDepth");
  const wallFade = smoothstep(-0.1, 0.42, signedDepth).toVar("cavityWallFade");
  const aboveHeight = max(localPosition.y, float(0)).toVar("cavityAboveHeight");
  const aboveBounce = cavityUniforms.aboveBounce
    .mul(exp(float(-0.5).mul(aboveHeight).mul(aboveHeight).div(0.52 * 0.52)))
    .toVar("cavityAboveBounce");
  const verticalResponse = wallFade.add(aboveBounce).sub(wallFade.mul(aboveBounce));
  const deepAbsorption = float(1).div(
    float(1).add(float(0.22).mul(depth).mul(depth)),
  );
  const sourceBand = float(0.68).add(float(0.32).mul(smoothstep(0.04, 0.72, depth)));

  const apertureFacing = float(1).sub(smoothstep(-0.4, 0.25, localNormal.y));
  const facingGate = mix(apertureFacing, float(1), smoothstep(0, 0.18, signedDepth));

  return footprint
    .mul(normalResponse)
    .mul(verticalResponse)
    .mul(deepAbsorption)
    .mul(sourceBand)
    .mul(facingGate);
});

// The branch avoids normalize(0) when the effect is disabled.
const cavityWallContribution = /*@__PURE__*/ Fn(() => {
  const out = vec3(0).toVar("cavityContribution");
  If(cavityUniforms.strength.greaterThan(0.0001), () => {
    const radiance = cavityWallField(positionWorld, normalWorld).toVar("cavityRadiance");
    const aggregate = mix(vec3(0.42), diffuseColor.rgb, 0.58).toVar("cavityAggregate");
    out.assign(
      cavityUniforms.color.mul(cavityUniforms.strength).mul(radiance).mul(aggregate),
    );
  });
  return out;
});

type Vec3Node = ReturnType<typeof vec3>;
type CavityLightingContext = { reflectedLight: { indirectDiffuse: Vec3Node } };

class CavityWallLightingModel extends PhysicalLightingModel {
  indirect(builder: NodeBuilder) {
    this.indirectDiffuse(builder);
    this.indirectSpecular(builder);
    const { reflectedLight } = builder.context as CavityLightingContext;
    reflectedLight.indirectDiffuse.addAssign(cavityWallContribution());
    this.ambientOcclusion(builder);
  }
}

export function addCavityWallLightNode(material: MeshPhysicalNodeMaterial) {
  // PhysicalLightingModel defaults every optional lobe to false.
  material.setupLightingModel = () => new CavityWallLightingModel(
    material.useClearcoat,
    material.useSheen,
    material.useIridescence,
    material.useAnisotropy,
    material.useTransmission,
    material.useDispersion,
  );

  // The custom lighting model is not part of the node graph's cache key.
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () =>
    `${previousProgramCacheKey()}|cavity-wall-light-node`;
}
