import type { ResolvedSceneProfile } from "../scene/scenes";
import { VISUAL_TUNING_CONTROLS, type VisualTuningKey } from "./schema";

type Requirement = {
  active: (profile: ResolvedSceneProfile) => boolean;
  reason: string;
};

const keyLightOff = (profile: ResolvedSceneProfile) =>
  profile.keyIntensity * profile.keyGain <= 0;
const shadowsOff = (profile: ResolvedSceneProfile) =>
  keyLightOff(profile) || profile.shadowStrength <= 0;

const KEY_LIGHT: Requirement = {
  active: (profile) => !keyLightOff(profile),
  reason: "this scene has no key light",
};
const HEMISPHERE: Requirement = {
  active: (profile) =>
    profile.hemisphereIntensity * profile.fillGain * profile.hemisphereGain > 0,
  reason: "this scene has no hemisphere fill",
};
const AMBIENT: Requirement = {
  active: (profile) => profile.ambientIntensity * profile.fillGain > 0,
  reason: "this scene has no ambient fill",
};
const ENVIRONMENT: Requirement = {
  active: (profile) => profile.environmentIntensity > 0,
  reason: "this scene has no environment reflections",
};
const CLEARCOAT: Requirement = {
  active: (profile) => profile.clearcoat > 0,
  reason: "this scene's material has no clearcoat",
};
const SHADOWS: Requirement = {
  active: (profile) => !shadowsOff(profile),
  reason: "this scene casts no key shadow",
};
const SPOT_LIGHT: Requirement = {
  active: (profile) => profile.cavitySpotLight > 0,
  reason: "this scene has no cavity spot light",
};
const CAVITY_LIGHT: Requirement = {
  active: (profile) => profile.cavityLightGain > 0,
  reason: "this scene's cavity light gain is zero",
};
const VOID_GLOW: Requirement = {
  active: (profile) => profile.cavityVoidGlow > 0,
  reason: "this scene's void does not glow",
};
const AMBIENT_OCCLUSION: Requirement = {
  active: (profile) => profile.aoIntensity > 0,
  reason: "this scene has contact AO disabled",
};
const BLOOM: Requirement = {
  active: (profile) => profile.bloomStrength * profile.bloomGain > 0,
  reason: "this scene has no bloom",
};
const SPECULAR: Requirement = {
  active: (profile) => profile.specularIntensity > 0,
  reason: "this scene's material has no specular",
};
const RELIEF: Requirement = {
  active: (profile) => profile.bumpScale > 0 || profile.normalStrength > 0,
  reason: "this scene's material has no surface relief",
};
const REAR_CUBE: Requirement = {
  active: (profile) => profile.id !== "lava",
  reason: "this scene reuses the main material on the rear cube",
};

const REQUIREMENTS: Partial<Record<VisualTuningKey, Requirement>> = {
  key: KEY_LIGHT,
  keyTargetY: KEY_LIGHT,
  keyHue: KEY_LIGHT,
  keyChroma: KEY_LIGHT,
  fill: {
    active: (profile) => HEMISPHERE.active(profile) || AMBIENT.active(profile),
    reason: "this scene has no fill light",
  },
  hemisphere: HEMISPHERE,
  skyHue: HEMISPHERE,
  skyChroma: HEMISPHERE,
  groundHue: HEMISPHERE,
  groundChroma: HEMISPHERE,
  ambient: AMBIENT,
  ambientHue: AMBIENT,
  ambientChroma: AMBIENT,
  reflections: ENVIRONMENT,
  environmentYaw: ENVIRONMENT,

  specular: SPECULAR,
  clearcoat: CLEARCOAT,
  clearcoatRoughness: CLEARCOAT,
  bump: RELIEF,
  rearBrightness: REAR_CUBE,
  rearRoughnessOffset: REAR_CUBE,
  rearSpecular: REAR_CUBE,

  shadowStrength: SHADOWS,
  shadowSoftness: SHADOWS,
  shadowBias: SHADOWS,
  shadowNormalBias: SHADOWS,
  shadowFrustum: SHADOWS,
  shadowNear: SHADOWS,
  shadowFar: SHADOWS,

  cavityLight: CAVITY_LIGHT,
  cavityHue: CAVITY_LIGHT,
  cavityChroma: CAVITY_LIGHT,
  cavityDepth: SPOT_LIGHT,
  cavityReach: SPOT_LIGHT,
  cavityAngle: SPOT_LIGHT,
  cavityPenumbra: SPOT_LIGHT,
  cavityDecay: SPOT_LIGHT,
  voidLevel: VOID_GLOW,

  ao: AMBIENT_OCCLUSION,
  aoRadius: AMBIENT_OCCLUSION,
  aoDistanceExponent: AMBIENT_OCCLUSION,
  aoThickness: AMBIENT_OCCLUSION,
  aoFalloff: AMBIENT_OCCLUSION,
  aoScale: AMBIENT_OCCLUSION,
  aoDenoiseLuma: AMBIENT_OCCLUSION,
  aoDenoiseDepth: AMBIENT_OCCLUSION,
  aoDenoiseNormal: AMBIENT_OCCLUSION,
  aoDenoiseRadius: AMBIENT_OCCLUSION,

  bloom: BLOOM,
  bloomRadius: BLOOM,
  bloomThreshold: BLOOM,
};

export type InactiveControls = ReadonlyMap<VisualTuningKey, string>;

export function findInactiveControls(profile: ResolvedSceneProfile): InactiveControls {
  const inactive = new Map<VisualTuningKey, string>();
  for (const control of VISUAL_TUNING_CONTROLS) {
    const requirement = REQUIREMENTS[control.key];
    if (requirement && !requirement.active(profile)) {
      inactive.set(control.key, requirement.reason);
    }
  }
  return inactive;
}
