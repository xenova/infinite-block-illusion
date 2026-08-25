import * as THREE from "three";

import {
  AMBIENT_LIGHT_INTENSITY_SCALE,
  BLOOM_STRENGTH_SCALE,
  HEMISPHERE_LIGHT_INTENSITY_SCALE,
  KEY_LIGHT_INTENSITY_SCALE,
} from "./constants";
import type { ResolvedSceneProfile } from "./scenes";

const NUMBER_FIELDS = {
  roughness: (profile) => profile.roughness,
  metalness: (profile) => profile.metalness,
  specular: (profile) => profile.specularIntensity,
  bump: (profile) => profile.bumpScale,
  normalStrength: (profile) => profile.normalStrength,
  aoMapIntensity: (profile) => profile.aoMapIntensity,
  clearcoat: (profile) => profile.clearcoat,
  clearcoatRoughness: (profile) => profile.clearcoatRoughness,
  rearClearcoat: (profile) => profile.rearClearcoat,
  rearClearcoatRoughness: (profile) => profile.rearClearcoatRoughness,
  sheen: (profile) => profile.sheen,
  sheenRoughness: (profile) => profile.sheenRoughness,
  iridescence: (profile) => profile.iridescence,
  iridescenceIOR: (profile) => profile.iridescenceIOR,
  iridescenceMin: (profile) => profile.iridescenceThicknessRange[0],
  iridescenceMax: (profile) => profile.iridescenceThicknessRange[1],
  transmission: (profile) => profile.transmission,
  thickness: (profile) => profile.thickness,
  attenuationDistance: (profile) => profile.attenuationDistance,
  emissiveIntensity: (profile) => profile.emissiveIntensity,
  ior: (profile) => profile.ior,
  textureScale: (profile) => profile.textureScale,
  surfaceBrightness: (profile) => profile.surfaceBrightness,
  exposure: (profile) => profile.exposure,
  saturation: (profile) => profile.surfaceGrade.saturation,
  contrast: (profile) => profile.surfaceGrade.contrast,
  key: (profile) => profile.keyIntensity * KEY_LIGHT_INTENSITY_SCALE,
  keyGain: (profile) => profile.keyGain,
  fillGain: (profile) => profile.fillGain,
  hemisphereGain: (profile) => profile.hemisphereGain,
  environment: (profile) => profile.environmentIntensity,
  hemisphere: (profile) => profile.hemisphereIntensity * HEMISPHERE_LIGHT_INTENSITY_SCALE,
  ambient: (profile) => profile.ambientIntensity * AMBIENT_LIGHT_INTENSITY_SCALE,
  ao: (profile) => profile.aoIntensity,
  shadowStrength: (profile) => profile.shadowStrength,
  bloom: (profile) => profile.bloomStrength * BLOOM_STRENGTH_SCALE,
  bloomGain: (profile) => profile.bloomGain,
  bloomRadius: (profile) => profile.bloomRadius,
  bloomThreshold: (profile) => profile.bloomThreshold,
  cavityLightStrength: (profile) => profile.cavityLightStrength,
  cavityLightGain: (profile) => profile.cavityLightGain,
  cavityAngle: (profile) => profile.cavityAngle,
  cavityReach: (profile) => profile.cavityReach,
  cavityDepth: (profile) => profile.cavityDepth,
  cavitySpotLight: (profile) => profile.cavitySpotLight,
  cavityVoidGlow: (profile) => profile.cavityVoidGlow,
  cavityWallGlow: (profile) => profile.cavityWallGlow,
  cavityAboveBounce: (profile) => profile.cavityAboveBounce,
  rearGlow: (profile) => profile.cavityRearGlow,
  accentIntensity: (profile) => profile.accentIntensity,
  accentMotion: (profile) => profile.accentMotion,
} satisfies Record<string, (profile: ResolvedSceneProfile) => number>;

const COLOR_FIELDS = {
  materialColor: (profile) => profile.materialColor,
  sheenColor: (profile) => profile.sheenColor,
  attenuationColor: (profile) => profile.attenuationColor,
  emissive: (profile) => profile.emissive,
  rearColor: (profile) => profile.rearColor,
  cavityColor: (profile) => profile.cavityColor,
  cavityLightColor: (profile) => profile.cavityLight,
  keyColor: (profile) => profile.keyColor,
  hemisphereSkyColor: (profile) => profile.hemisphereSkyColor,
  hemisphereGroundColor: (profile) => profile.hemisphereGroundColor,
  ambientColor: (profile) => profile.ambientColor,
  accentColor: (profile) => profile.accentColor,
  accentSecondary: (profile) => profile.accentSecondary,
} satisfies Record<string, (profile: ResolvedSceneProfile) => number>;

type NumberKey = keyof typeof NUMBER_FIELDS;
type ColorKey = keyof typeof COLOR_FIELDS;
export type VisualProfile = Record<NumberKey, number>
  & Record<ColorKey, THREE.Color>;

const numberEntries = Object.entries(NUMBER_FIELDS) as [
  NumberKey,
  (profile: ResolvedSceneProfile) => number,
][];
const colorEntries = Object.entries(COLOR_FIELDS) as [
  ColorKey,
  (profile: ResolvedSceneProfile) => number,
][];

export function createVisualProfile(): VisualProfile {
  const visual = {} as VisualProfile;
  const numbers = visual as Record<NumberKey, number>;
  const colors = visual as Record<ColorKey, THREE.Color>;
  for (const [key] of numberEntries) numbers[key] = 0;
  for (const [key] of colorEntries) colors[key] = new THREE.Color();
  return visual;
}

export function applySceneProfile(
  visual: VisualProfile,
  profile: ResolvedSceneProfile,
) {
  for (const [key, read] of numberEntries) visual[key] = read(profile);
  for (const [key, read] of colorEntries) visual[key].setHex(read(profile));
}
