import {
  BASE_CAMERA_POSITION,
  BASE_CAMERA_TARGET,
  CAMERA_FOV,
  CAMERA_ROLL,
} from "../scene/constants";
import { radToDeg } from "../util/math";

export const DEFAULT_VISUAL_TUNING = {
  cameraX: BASE_CAMERA_POSITION.x,
  cameraY: BASE_CAMERA_POSITION.y,
  cameraZ: BASE_CAMERA_POSITION.z,
  cameraTargetX: BASE_CAMERA_TARGET.x,
  cameraTargetY: BASE_CAMERA_TARGET.y,
  cameraTargetZ: BASE_CAMERA_TARGET.z,
  cameraFov: CAMERA_FOV,
  cameraRoll: radToDeg(CAMERA_ROLL),
  exposure: 0.9,
  brightness: 1,
  lift: 0,
  gamma: 1,
  vibrance: 1.1,
  temperature: 0.04,
  vignette: 1,
  albedo: 1,
  key: 0.5,
  fill: 1.35,
  hemisphere: 1,
  ambient: 1,
  reflections: 1,
  environmentYaw: 0,
  keyX: -5.8,
  keyY: 2.8,
  keyZ: 5.6,
  keyTargetY: 0,
  keyHue: 0,
  keyChroma: 1,
  skyHue: 0,
  skyChroma: 1,
  groundHue: 0,
  groundChroma: 1,
  ambientHue: 0,
  ambientChroma: 1,
  roughnessOffset: 0,
  metalnessOffset: 0,
  specular: 1,
  clearcoat: 1,
  clearcoatRoughness: 1,
  bump: 1,
  textureScale: 1,
  ior: 1.5,
  rearBrightness: 1,
  rearRoughnessOffset: 0,
  rearSpecular: 1,
  shadowStrength: 1,
  shadowSoftness: 1.15,
  shadowBias: -0.00012,
  shadowNormalBias: 1,
  shadowFrustum: 1,
  shadowNear: 1,
  shadowFar: 1,
  cavityLight: 1,
  cavityHue: 0,
  cavityChroma: 1,
  cavityDepth: 1.75,
  cavityReach: 1,
  cavityAngle: 15,
  cavityPenumbra: 0.88,
  cavityDecay: 2,
  cavityLift: 1.6,
  voidLevel: 1,
  contrast: 1.26,
  saturation: 1.12,
  ao: 0.93,
  aoRadius: 0.17,
  aoDistanceExponent: 1.5,
  aoThickness: 0.82,
  aoFalloff: 0.78,
  aoScale: 1.25,
  aoDenoiseLuma: 5,
  aoDenoiseDepth: 2,
  aoDenoiseNormal: 4,
  aoDenoiseRadius: 4,
  bloom: 0.75,
  bloomRadius: 0.14,
  bloomThreshold: 1.85,
  dofFocus: 0.18,
  dofAperture: 0.22,
  dofBlur: 0.42,
  grain: 0.34,
  aberration: 0.6,
} as const;

export type VisualTuning = {
  -readonly [Key in keyof typeof DEFAULT_VISUAL_TUNING]: number;
};

export type VisualTuningKey = keyof VisualTuning;

/** Text a control is mid-edit, before it parses into a number. */
export type VisualTuningDrafts = Partial<Record<VisualTuningKey, string>>;

export type VisualTuningGroupId =
  | "camera"
  | "tone"
  | "lights"
  | "material"
  | "shadows"
  | "cavity"
  | "ao"
  | "bloom"
  | "optics";

export type VisualTuningControl = {
  key: VisualTuningKey;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  digits?: number;
};

type VisualTuningGroup = {
  id: VisualTuningGroupId;
  label: string;
  controls: readonly VisualTuningControl[];
};

export const VISUAL_TUNING_GROUPS: readonly VisualTuningGroup[] = [
  {
    id: "camera",
    label: "Camera",
    controls: [
      { key: "cameraX", label: "Position X", min: -8, max: 8, step: 0.0001, digits: 4 },
      { key: "cameraY", label: "Position Y", min: 0.1, max: 8, step: 0.0001, digits: 4 },
      { key: "cameraZ", label: "Position Z", min: -8, max: 8, step: 0.0001, digits: 4 },
      { key: "cameraTargetX", label: "Target X", min: -8, max: 8, step: 0.0001, digits: 4 },
      { key: "cameraTargetY", label: "Target Y", min: -4, max: 4, step: 0.0001, digits: 4 },
      { key: "cameraTargetZ", label: "Target Z", min: -8, max: 8, step: 0.0001, digits: 4 },
      { key: "cameraFov", label: "Field of view", min: 20, max: 90, step: 0.1, digits: 1, suffix: "°" },
      { key: "cameraRoll", label: "Roll", min: -45, max: 45, step: 0.01, digits: 2, suffix: "°" },
    ],
  },
  {
    id: "tone",
    label: "Tone & color",
    controls: [
      { key: "exposure", label: "Exposure", min: 0.05, max: 4, step: 0.01 },
      { key: "brightness", label: "Surface gain", min: 0.1, max: 3, step: 0.01, suffix: "×" },
      { key: "albedo", label: "Albedo gain", min: 0.1, max: 3, step: 0.01, suffix: "×" },
      { key: "lift", label: "Shadow lift", min: -0.35, max: 0.35, step: 0.005, digits: 3 },
      { key: "gamma", label: "Gamma", min: 0.25, max: 3, step: 0.01 },
      { key: "contrast", label: "Contrast", min: 0.1, max: 4, step: 0.01, suffix: "×" },
      { key: "saturation", label: "Saturation", min: 0, max: 4, step: 0.01, suffix: "×" },
      { key: "vibrance", label: "Vibrance", min: 0, max: 4, step: 0.01, suffix: "×" },
      { key: "temperature", label: "Temperature", min: -1, max: 1, step: 0.01 },
      { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    id: "lights",
    label: "Scene lights",
    controls: [
      { key: "key", label: "Key intensity", min: 0, max: 12, step: 0.01, suffix: "×" },
      { key: "fill", label: "Fill master", min: 0, max: 12, step: 0.01, suffix: "×" },
      { key: "hemisphere", label: "Hemisphere", min: 0, max: 8, step: 0.01, suffix: "×" },
      { key: "ambient", label: "Ambient", min: 0, max: 12, step: 0.01, suffix: "×" },
      { key: "reflections", label: "Environment", min: 0, max: 10, step: 0.01, suffix: "×" },
      { key: "environmentYaw", label: "Environment yaw", min: -180, max: 180, step: 1, suffix: "°", digits: 0 },
      { key: "keyX", label: "Key X", min: -15, max: 15, step: 0.1, digits: 1 },
      { key: "keyY", label: "Key Y", min: 0.1, max: 15, step: 0.1, digits: 1 },
      { key: "keyZ", label: "Key Z", min: -15, max: 15, step: 0.1, digits: 1 },
      { key: "keyTargetY", label: "Key target Y", min: -4, max: 4, step: 0.05, digits: 2 },
      { key: "keyHue", label: "Key hue", min: -180, max: 180, step: 1, suffix: "°", digits: 0 },
      { key: "keyChroma", label: "Key chroma", min: 0, max: 3, step: 0.01, suffix: "×" },
      { key: "skyHue", label: "Sky hue", min: -180, max: 180, step: 1, suffix: "°", digits: 0 },
      { key: "skyChroma", label: "Sky chroma", min: 0, max: 3, step: 0.01, suffix: "×" },
      { key: "groundHue", label: "Ground hue", min: -180, max: 180, step: 1, suffix: "°", digits: 0 },
      { key: "groundChroma", label: "Ground chroma", min: 0, max: 3, step: 0.01, suffix: "×" },
      { key: "ambientHue", label: "Ambient hue", min: -180, max: 180, step: 1, suffix: "°", digits: 0 },
      { key: "ambientChroma", label: "Ambient chroma", min: 0, max: 3, step: 0.01, suffix: "×" },
    ],
  },
  {
    id: "material",
    label: "Material",
    controls: [
      { key: "roughnessOffset", label: "Roughness Δ", min: -1, max: 1, step: 0.01 },
      { key: "metalnessOffset", label: "Metalness Δ", min: -1, max: 1, step: 0.01 },
      { key: "specular", label: "Specular", min: 0, max: 5, step: 0.01, suffix: "×" },
      { key: "clearcoat", label: "Clearcoat", min: 0, max: 5, step: 0.01, suffix: "×" },
      { key: "clearcoatRoughness", label: "Coat roughness", min: 0, max: 4, step: 0.01, suffix: "×" },
      { key: "bump", label: "Surface depth", min: 0, max: 10, step: 0.01, suffix: "×" },
      { key: "textureScale", label: "Texture scale", min: 0.1, max: 8, step: 0.01, suffix: "×" },
      { key: "ior", label: "IOR", min: 1, max: 2.5, step: 0.01 },
      { key: "rearBrightness", label: "Rear gain", min: 0, max: 5, step: 0.01, suffix: "×" },
      { key: "rearRoughnessOffset", label: "Rear roughness Δ", min: -1, max: 1, step: 0.01 },
      { key: "rearSpecular", label: "Rear specular", min: 0, max: 5, step: 0.01, suffix: "×" },
    ],
  },
  {
    id: "shadows",
    label: "Key shadows",
    controls: [
      { key: "shadowStrength", label: "Strength", min: 0, max: 1, step: 0.01 },
      { key: "shadowSoftness", label: "Softness", min: 0, max: 12, step: 0.1, digits: 1 },
      { key: "shadowBias", label: "Bias", min: -0.005, max: 0.005, step: 0.00001, digits: 5 },
      { key: "shadowNormalBias", label: "Normal bias", min: 0, max: 10, step: 0.01, suffix: "×" },
      { key: "shadowFrustum", label: "Coverage", min: 0.25, max: 4, step: 0.01, suffix: "×" },
      { key: "shadowNear", label: "Near plane", min: 0.1, max: 8, step: 0.01, suffix: "×" },
      { key: "shadowFar", label: "Far plane", min: 0.25, max: 4, step: 0.01, suffix: "×" },
    ],
  },
  {
    id: "cavity",
    label: "Hole light",
    controls: [
      { key: "cavityLight", label: "Light intensity", min: 0, max: 10, step: 0.01, suffix: "×" },
      { key: "cavityHue", label: "Light hue", min: -180, max: 180, step: 1, suffix: "°", digits: 0 },
      { key: "cavityChroma", label: "Light chroma", min: 0, max: 3, step: 0.01, suffix: "×" },
      { key: "cavityDepth", label: "Light depth", min: 0.1, max: 12, step: 0.05, digits: 2 },
      { key: "cavityReach", label: "Light reach", min: 0.1, max: 6, step: 0.01, suffix: "×" },
      { key: "cavityAngle", label: "Cone angle", min: 1, max: 85, step: 0.5, suffix: "°", digits: 1 },
      { key: "cavityPenumbra", label: "Penumbra", min: 0, max: 1, step: 0.01 },
      { key: "cavityDecay", label: "Decay", min: 0, max: 6, step: 0.01 },
      { key: "cavityLift", label: "Floor rest depth", min: 1.05, max: 4, step: 0.05, digits: 2 },
      { key: "voidLevel", label: "Void visibility", min: 0, max: 20, step: 0.01, suffix: "×" },
    ],
  },
  {
    id: "ao",
    label: "Contact AO",
    controls: [
      { key: "ao", label: "Strength", min: 0, max: 3, step: 0.01, suffix: "×" },
      { key: "aoRadius", label: "Radius", min: 0.005, max: 2, step: 0.005, digits: 3 },
      { key: "aoDistanceExponent", label: "Distance exponent", min: 0.1, max: 8, step: 0.05, digits: 2 },
      { key: "aoThickness", label: "Thickness", min: 0.01, max: 5, step: 0.01 },
      { key: "aoFalloff", label: "Falloff", min: 0, max: 3, step: 0.01 },
      { key: "aoScale", label: "Scale", min: 0.1, max: 5, step: 0.01 },
      { key: "aoDenoiseLuma", label: "Denoise luma", min: 0, max: 20, step: 0.1, digits: 1 },
      { key: "aoDenoiseDepth", label: "Denoise depth", min: 0, max: 10, step: 0.1, digits: 1 },
      { key: "aoDenoiseNormal", label: "Denoise normal", min: 0, max: 20, step: 0.1, digits: 1 },
      { key: "aoDenoiseRadius", label: "Denoise radius", min: 0, max: 16, step: 0.1, digits: 1 },
    ],
  },
  {
    id: "bloom",
    label: "Bloom",
    controls: [
      { key: "bloom", label: "Strength", min: 0, max: 12, step: 0.01, suffix: "×" },
      { key: "bloomRadius", label: "Radius", min: 0, max: 1, step: 0.01 },
      { key: "bloomThreshold", label: "Threshold", min: 0, max: 5, step: 0.01 },
    ],
  },
  {
    id: "optics",
    label: "Lens",
    controls: [
      { key: "dofFocus", label: "Focus offset", min: -3, max: 3, step: 0.01 },
      { key: "dofAperture", label: "Aperture", min: 0, max: 6, step: 0.01, suffix: "×" },
      { key: "dofBlur", label: "Max blur", min: 0, max: 4, step: 0.01, suffix: "×" },
      { key: "grain", label: "Film grain", min: 0, max: 3, step: 0.01, suffix: "×" },
      { key: "aberration", label: "Aberration", min: 0, max: 3, step: 0.01, suffix: "×" },
    ],
  },
];

export const VISUAL_TUNING_CONTROLS: readonly VisualTuningControl[] =
  VISUAL_TUNING_GROUPS.flatMap((group) => group.controls);

export const VISUAL_TUNING_CONTROL_BY_KEY: ReadonlyMap<
  VisualTuningKey,
  VisualTuningControl
> = new Map(VISUAL_TUNING_CONTROLS.map((control) => [control.key, control]));

export function countModified(tuning: VisualTuning) {
  let modified = 0;
  for (const control of VISUAL_TUNING_CONTROLS) {
    if (tuning[control.key] !== DEFAULT_VISUAL_TUNING[control.key]) modified += 1;
  }
  return modified;
}
