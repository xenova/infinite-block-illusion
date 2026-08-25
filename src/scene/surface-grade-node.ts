import type { MeshPhysicalNodeMaterial, Node } from "three/webgpu";
import {
  Fn,
  dot,
  float,
  materialColor,
  mix,
  pow,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";

const LUMA = /*@__PURE__*/ vec3(0.2126, 0.7152, 0.0722);

const gradeUniforms = {
  saturation: uniform(1),
  contrast: uniform(1),
  brightness: uniform(1),
  lift: uniform(0),
  gamma: uniform(1),
  vibrance: uniform(1),
  temperature: uniform(0),
};

export const surfaceGradeColor = /*@__PURE__*/ Fn(([source]: [Node<"vec3">]) => {
  const base = source.clamp(0, 1).toVar();

  base.assign(base.mul(gradeUniforms.brightness).add(vec3(gradeUniforms.lift)).max(vec3(0)));
  base.mulAssign(vec3(
    float(1).add(gradeUniforms.temperature.mul(0.2)),
    float(1),
    float(1).sub(gradeUniforms.temperature.mul(0.2)),
  ));

  const luma = dot(base, LUMA).toVar();
  base.assign(mix(vec3(luma), base, gradeUniforms.saturation).max(vec3(0)));

  const saturatedLuma = dot(base, LUMA).toVar();
  const chroma = base.r.max(base.g).max(base.b)
    .sub(base.r.min(base.g).min(base.b)).toVar();
  const vibranceWeight = float(1).sub(smoothstep(0, 0.8, chroma)).toVar();
  const vibranceAmount = mix(float(1), gradeUniforms.vibrance, vibranceWeight).toVar();
  base.assign(mix(vec3(saturatedLuma), base, vibranceAmount).max(vec3(0)));

  base.assign(pow(
    base.max(vec3(0.00001)),
    vec3(float(1).div(gradeUniforms.gamma.max(0.05))),
  ));

  const gradedLuma = dot(base, LUMA).toVar();
  const contrastedLuma = pow(gradedLuma.clamp(0, 1), gradeUniforms.contrast).toVar();
  base.mulAssign(contrastedLuma.div(gradedLuma.max(0.0001)));

  return base.clamp(0, 1);
});
// Sharing this graph keeps equivalent materials on the same pipeline cache key.
const GRADED_MATERIAL_COLOR = /*@__PURE__*/ surfaceGradeColor(materialColor.rgb);

export function addSurfaceGradeNode(
  material: MeshPhysicalNodeMaterial,
) {
  material.colorNode = GRADED_MATERIAL_COLOR;
}

type SurfaceGrade = Record<keyof typeof gradeUniforms, number>;

export function setSurfaceGrade(values: SurfaceGrade) {
  gradeUniforms.saturation.value = values.saturation;
  gradeUniforms.contrast.value = values.contrast;
  gradeUniforms.brightness.value = values.brightness;
  gradeUniforms.lift.value = values.lift;
  gradeUniforms.gamma.value = values.gamma;
  gradeUniforms.vibrance.value = values.vibrance;
  gradeUniforms.temperature.value = values.temperature;
}
