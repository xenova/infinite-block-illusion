import { DERIVED_TEXTURE_SOURCES, PBR_TEXTURE_SOURCES, type TextureSource } from "./texture-sources";

export type AtmosphereStyle = "none" | "dust" | "embers" | "aurora" | "neon";

type ScenePresentation = Readonly<{
  label: string;
  pageBackground: string;
  background: number;
  rearColor: number;
}>;

type MaterialGrade = Readonly<{ saturation: number; contrast: number }>;

type SceneMaterial = Readonly<{
  color: number;
  roughness: number;
  metalness: number;
  specularIntensity: number;
  bumpScale: number;
  normalStrength: number;
  aoMapIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  rearClearcoat: number;
  rearClearcoatRoughness: number;
  rearDetailMaps: boolean;
  textureScale: number;
  surfaceBrightness: number;
  ior: number;
  sheen: number;
  sheenColor: number;
  sheenRoughness: number;
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThicknessRange: readonly [number, number];
  transmission: number;
  thickness: number;
  attenuationColor: number;
  attenuationDistance: number;
  emissive: number;
  emissiveIntensity: number;
  grade: MaterialGrade;
  accentCubeColor?: number;
  rearTexture?: string;
}>;

type SceneLighting = Readonly<{
  keyColor: number;
  keyIntensity: number;
  keyGain: number;
  fillGain: number;
  hemisphereGain: number;
  skyColor: number;
  groundColor: number;
  hemisphereSkyColor?: number;
  hemisphereGroundColor?: number;
  ambientColor: number;
  hemisphereIntensity: number;
  ambientIntensity: number;
  aoIntensity: number;
  shadowStrength: number;
  environmentIntensity: number;
  environmentSunSize: number;
  environmentSunIntensity?: number;
  environmentSkyIntensity?: number;
}>;

type SceneCavity = Readonly<{
  color: number;
  light: number;
  lightStrength: number;
  lightGain: number;
  angle: number;
  reach: number;
  depth: number;
  spotLight: number;
  voidGlow: number;
  wallGlow: number;
  aboveBounce: number;
  rearGlow: number;
}>;

type ScenePostProcessing = Readonly<{
  exposure: number;
  bloomStrength: number;
  bloomGain: number;
  bloomRadius: number;
  bloomThreshold: number;
}>;

type SceneAtmosphere = Readonly<{
  style: AtmosphereStyle;
  strength: number;
  rate: number;
  squareness: number;
  color: number;
  secondary: number;
  accentColor: number;
  accentSecondary: number;
  accentIntensity: number;
  accentMotion: number;
}>;

type ScenePreset = Readonly<{
  id: string;
  presentation: ScenePresentation;
  textureSource: TextureSource;
  material: SceneMaterial;
  lighting: SceneLighting;
  cavity: SceneCavity;
  post: ScenePostProcessing;
  atmosphere: SceneAtmosphere;
}>;

type SceneAuthoring<Id extends string> = Readonly<{
  id: Id;
  presentation: Readonly<
    Omit<ScenePresentation, "rearColor"> & Partial<Pick<ScenePresentation, "rearColor">>
  >;
  textureSource: TextureSource;
  material: Readonly<
    Pick<SceneMaterial, "color"> &
      Omit<Partial<SceneMaterial>, "color" | "grade"> & {
        grade?: Partial<MaterialGrade>;
      }
  >;
  lighting: Readonly<
    Pick<SceneLighting, "keyColor" | "skyColor" | "groundColor" | "ambientColor"> &
      Partial<SceneLighting>
  >;
  cavity: Readonly<Pick<SceneCavity, "color" | "light"> & Partial<SceneCavity>>;
  post: Partial<ScenePostProcessing>;
  atmosphere: Readonly<
    Pick<SceneAtmosphere, "color" | "secondary"> & Partial<SceneAtmosphere>
  >;
}>;

const DOMAIN_DEFAULTS = Object.freeze({
  presentation: Object.freeze({ rearColor: 0x161318 }),
  material: Object.freeze({
    roughness: 0.3,
    metalness: 0,
    specularIntensity: 0.72,
    bumpScale: 0.024,
    normalStrength: 0.5,
    aoMapIntensity: 0.6,
    clearcoat: 0,
    clearcoatRoughness: 1,
    rearClearcoat: 0,
    rearClearcoatRoughness: 1,
    rearDetailMaps: false,
    textureScale: 0.55,
    surfaceBrightness: 1,
    ior: 1.5,
    sheen: 0,
    sheenRoughness: 1,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: Object.freeze([100, 400] as const),
    transmission: 0,
    thickness: 0,
    attenuationColor: 0xffffff,
    attenuationDistance: Infinity,
    emissive: 0x000000,
    emissiveIntensity: 0,
    grade: Object.freeze({ saturation: 1, contrast: 1 }),
  }),
  lighting: Object.freeze({
    keyIntensity: 3.7,
    keyGain: 1,
    fillGain: 1,
    hemisphereGain: 1,
    hemisphereIntensity: 1.3,
    ambientIntensity: 0.14,
    aoIntensity: 0.68,
    shadowStrength: 1,
    environmentIntensity: 1,
    environmentSunSize: 0.085,
  }),
  cavity: Object.freeze({
    lightStrength: 2.6,
    lightGain: 1,
    angle: 15,
    reach: 1,
    depth: 1.75,
    spotLight: 0,
    voidGlow: 0.1,
    wallGlow: 1.65,
    aboveBounce: 0.16,
    rearGlow: 0,
  }),
  post: Object.freeze({
    exposure: 0.9,
    bloomStrength: 0.025,
    bloomGain: 1,
    bloomRadius: 0.14,
    bloomThreshold: 1.85,
  }),
  atmosphere: Object.freeze({
    style: "none" as const,
    strength: 0,
    rate: 3,
    squareness: 0,
    accentIntensity: 0,
    accentMotion: 1,
  }),
});

function defineScene<const Id extends string>(authored: SceneAuthoring<Id>) {
  const {
    grade: gradePatch,
    iridescenceThicknessRange = DOMAIN_DEFAULTS.material.iridescenceThicknessRange,
    sheenColor = authored.material.color,
    ...materialPatch
  } = authored.material;
  const { accentColor, accentSecondary, ...atmospherePatch } = authored.atmosphere;

  const presentation = Object.freeze({
    ...DOMAIN_DEFAULTS.presentation,
    ...authored.presentation,
  });
  const material = Object.freeze({
    ...DOMAIN_DEFAULTS.material,
    ...materialPatch,
    sheenColor,
    iridescenceThicknessRange: Object.freeze(iridescenceThicknessRange),
    grade: Object.freeze({ ...DOMAIN_DEFAULTS.material.grade, ...gradePatch }),
  });
  const lighting = Object.freeze({ ...DOMAIN_DEFAULTS.lighting, ...authored.lighting });
  const cavity = Object.freeze({ ...DOMAIN_DEFAULTS.cavity, ...authored.cavity });
  const post = Object.freeze({ ...DOMAIN_DEFAULTS.post, ...authored.post });
  const atmosphere = Object.freeze({
    ...DOMAIN_DEFAULTS.atmosphere,
    ...atmospherePatch,
    accentColor: accentColor ?? lighting.keyColor,
    accentSecondary: accentSecondary ?? atmospherePatch.color,
  });

  return Object.freeze({
    id: authored.id,
    presentation,
    textureSource: authored.textureSource,
    material,
    lighting,
    cavity,
    post,
    atmosphere,
  });
}

const SCENE_PRESETS = Object.freeze([
  defineScene({
    id: "stone",
    presentation: {
      label: "Stone", pageBackground: "radial-gradient(circle at 50% 42%, #c3b2ba 0, #8e7d86 72%, #4a3e45 130%)",
      background: 0xb9abb2,
    },
    textureSource: PBR_TEXTURE_SOURCES.stone,
    material: {
      color: 0xf2eef0, roughness: 0.84, specularIntensity: 0.5, bumpScale: 0.045, normalStrength: 1,
      aoMapIntensity: 1.6, textureScale: 0.62,
    },
    lighting: {
      keyColor: 0xfff8f3, skyColor: 0xfff7fb, groundColor: 0x4c3d46, ambientColor: 0xd7cbd1, keyIntensity: 4.7,
      ambientIntensity: 0.13,
    },
    cavity: {
      color: 0x0d47d6, light: 0x1264ff, lightStrength: 2.2, lightGain: 6,
      angle: 31, reach: 0.82, depth: 1.18, wallGlow: 2.4,
    },
    post: { exposure: 2.064, bloomStrength: 0.18, bloomRadius: 0.24, bloomThreshold: 0.72 },
    atmosphere: { color: 0x1264ff, secondary: 0xfff8f3 },
  }),
  defineScene({
    id: "metalpanel",
    presentation: {
      label: "Steel Panel",
      pageBackground: "radial-gradient(circle at 50% 38%, #7d7870 0, #46433e 70%, #1c1a18 130%)",
      background: 0x35322e,
    },
    textureSource: PBR_TEXTURE_SOURCES.metalpanel,
    material: {
      color: 0xb4b0a8, roughness: 0.55, metalness: 0.8, specularIntensity: 0.9, bumpScale: 0.045, normalStrength: 1,
      aoMapIntensity: 1.25, textureScale: 0.45, surfaceBrightness: 1.05,
    },
    lighting: {
      keyColor: 0xfff0dc, skyColor: 0xa0a8b0, groundColor: 0x33302c, ambientColor: 0x807c76, keyIntensity: 3.2,
      keyGain: 0.25 / 0.5, hemisphereIntensity: 1.2, environmentIntensity: 1.1, environmentSunSize: 0.34,
    },
    cavity: {
      color: 0x5c3208, light: 0xffb45c, lightStrength: 2.5, lightGain: 8,
      angle: 31, reach: 0.82, depth: 1.18, wallGlow: 2.3,
    },
    post: { exposure: 0.95, bloomStrength: 0.3, bloomRadius: 0.24, bloomThreshold: 0.72 },
    atmosphere: { color: 0xffb45c, secondary: 0xfff0dc },
  }),
  defineScene({
    id: "glacier",
    presentation: {
      label: "Glacier", pageBackground: "radial-gradient(circle at 50% 38%, #7fc4e2 0, #2f6382 70%, #10293a 130%)",
      background: 0x2c5f7c, rearColor: 0x20242c,
    },
    textureSource: PBR_TEXTURE_SOURCES.glacier,
    material: {
      color: 0xd6f2ff, roughness: 0.18, specularIntensity: 1.1, bumpScale: 0.022, normalStrength: 0.95,
      aoMapIntensity: 0.8, clearcoat: 0.7, clearcoatRoughness: 0.1, textureScale: 0.48, surfaceBrightness: 0.9,
      ior: 1.31, transmission: 0.35, thickness: 0.55, attenuationColor: 0x8fd8ff, attenuationDistance: 1.6,
    },
    lighting: {
      keyColor: 0xeaf9ff, skyColor: 0xa8dcf5, groundColor: 0x22516b, ambientColor: 0x8fd0e8, keyIntensity: 0,
      fillGain: 6 / 1.35, hemisphereGain: 2, hemisphereIntensity: 1.45, ambientIntensity: 0.18,
      environmentSunIntensity: 4.864,
    },
    cavity: {
      color: 0x0b4a68, light: 0x35d8ff, lightStrength: 3, lightGain: 10,
      voidGlow: 0.12, wallGlow: 2.6, rearGlow: 0.85,
    },
    post: { exposure: 0.53, bloomStrength: 0 },
    atmosphere: { color: 0x35d8ff, secondary: 0xeaf9ff },
  }),
  defineScene({
    id: "lava",
    presentation: {
      label: "Lava", pageBackground: "radial-gradient(circle at 50% 42%, #541207 0, #230503 70%, #070101 130%)",
      background: 0x170302, rearColor: 0xff7a12,
    },
    textureSource: DERIVED_TEXTURE_SOURCES.charred,
    material: {
      color: 0x3b0804, roughness: 0.74, specularIntensity: 0.34, bumpScale: 0.016, aoMapIntensity: 1.1,
      clearcoat: 0.04, clearcoatRoughness: 0.7, textureScale: 0.462, emissive: 0x2a0200, emissiveIntensity: 0.34,
      grade: { saturation: 1.24, contrast: 1.16, },
    },
    lighting: {
      keyColor: 0xff7d35, skyColor: 0x5b1208, groundColor: 0x010000, ambientColor: 0x3a0903, keyIntensity: 2.6,
      hemisphereIntensity: 0.95, ambientIntensity: 0.09, aoIntensity: 0.84,
    },
    cavity: { color: 0x160000, light: 0xff3a08, lightStrength: 1.56, spotLight: 0.18, voidGlow: 0.13, wallGlow: 2.8 },
    post: { exposure: 1.017, bloomStrength: 0.18, bloomRadius: 0.3, bloomThreshold: 0.82 },
    atmosphere: {
      style: "embers", strength: 0.38, color: 0xfff1a3, secondary: 0xff2805, accentColor: 0xffb03b,
      accentSecondary: 0xff2908, accentIntensity: 0.6, accentMotion: 1.4,
    },
  }),
  defineScene({
    id: "cobblestone",
    presentation: {
      label: "Cobblestone",
      pageBackground: "radial-gradient(circle at 50% 42%, #c3b2ba 0, #8e7d86 72%, #4a3e45 130%)",
      background: 0xb9abb2,
    },
    textureSource: PBR_TEXTURE_SOURCES.cobblestone,
    material: {
      color: 0xdad5d0, roughness: 0.86, specularIntensity: 0.5, bumpScale: 0.05, normalStrength: 1,
      aoMapIntensity: 1.45, textureScale: 0.6,
    },
    lighting: {
      keyColor: 0xfff8f3, skyColor: 0xfff7fb, groundColor: 0x4c3d46, ambientColor: 0xd7cbd1, keyIntensity: 4.7,
      ambientIntensity: 0.13,
    },
    cavity: {
      color: 0x0d47d6, light: 0x1264ff, lightStrength: 2.2, angle: 31, reach: 0.82, depth: 1.18, wallGlow: 2.4,
    },
    post: { exposure: 1.5, bloomStrength: 0.18, bloomRadius: 0.24, bloomThreshold: 0.72 },
    atmosphere: { color: 0x1264ff, secondary: 0xfff8f3 },
  }),
  defineScene({
    id: "onyxteal",
    presentation: {
      label: "Onyx Teal", pageBackground: "radial-gradient(circle at 50% 38%, #5f8792 0, #2b4449 70%, #0f1a1d 130%)",
      background: 0x18282c, rearColor: 0x20242c,
    },
    textureSource: PBR_TEXTURE_SOURCES.onyxteal,
    material: {
      color: 0xa8c2c4, roughness: 0.13, specularIntensity: 1.35, bumpScale: 0.012, normalStrength: 0.4,
      clearcoat: 0.9, clearcoatRoughness: 0.06, textureScale: 0.42,
    },
    lighting: {
      keyColor: 0xf2fbff, skyColor: 0x86a8b4, groundColor: 0x152226, ambientColor: 0x5f8792, keyIntensity: 2.4,
      fillGain: 12 / 1.35, hemisphereGain: 8, hemisphereIntensity: 1.2,
      environmentSunSize: 0.85,
    },
    cavity: { color: 0x0c4a46, light: 0x59e2d0, lightStrength: 2.8, spotLight: 0.12, voidGlow: 0.07 },
    post: {
      exposure: 0.88, bloomStrength: 0.38, bloomGain: 0.25 / 0.75, bloomThreshold: 1.7,
    },
    atmosphere: { color: 0x59e2d0, secondary: 0xf2fbff },
  }),
  defineScene({
    id: "geometrydash",
    presentation: {
      label: "Dash", pageBackground: "radial-gradient(circle at 50% 40%, #3d2bd8 0, #1c1478 70%, #080530 130%)",
      background: 0x2a1cae, rearColor: 0xffffff,
    },
    textureSource: PBR_TEXTURE_SOURCES.geometrydash,
    material: {
      color: 0xffffff, roughness: 0.48, specularIntensity: 0.9, bumpScale: 0.012, normalStrength: 0.3,
      aoMapIntensity: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.25, textureScale: 1,
      emissive: 0x1a1240, emissiveIntensity: 0.22, rearTexture: "/textures/dash.webp",
      grade: { saturation: 1.2, contrast: 1.08, },
    },
    lighting: {
      keyColor: 0xffffff, skyColor: 0x8fa0ff, groundColor: 0x0a0830, ambientColor: 0x4a4adf, keyIntensity: 0,
      hemisphereIntensity: 13.632, ambientIntensity: 5.12, aoIntensity: 0.6,
      environmentSunSize: 0.5, environmentSunIntensity: 3.576, environmentSkyIntensity: 1.003,
    },
    cavity: {
      color: 0x1c0433, light: 0xff3ad8, lightStrength: 2.4, lightGain: 10,
      spotLight: 0.16, voidGlow: 0.12, wallGlow: 2.2,
      rearGlow: 0.25,
    },
    post: { exposure: 0.42, bloomStrength: 3.552, bloomRadius: 0.35, bloomThreshold: 0.85 },
    atmosphere: {
      style: "dust", strength: 0.3, squareness: 1, color: 0xffffff, secondary: 0xdfeaff,
      accentColor: 0x23eaff, accentSecondary: 0xff36d0, accentIntensity: 0.2, accentMotion: 1.6,
    },
  }),
  defineScene({
    id: "bamboo",
    presentation: {
      label: "Bamboo", pageBackground: "radial-gradient(circle at 50% 42%, #a8895e 0, #6e5638 72%, #2c2114 130%)",
      background: 0x8a7050, rearColor: 0x3a5c40,
    },
    textureSource: PBR_TEXTURE_SOURCES.bamboo,
    material: {
      color: 0xe8d4b0, roughness: 0.62, specularIntensity: 0.5, bumpScale: 0.03, normalStrength: 1,
      aoMapIntensity: 1.1, clearcoat: 0.12, clearcoatRoughness: 0.4, textureScale: 0.5, surfaceBrightness: 1.25,
      grade: { saturation: 1.15, contrast: 1.06, },
    },
    lighting: {
      keyColor: 0xffe9c4, skyColor: 0xc9d8b0, groundColor: 0x2a2012, ambientColor: 0x8a7a58, keyIntensity: 4.2,
      ambientIntensity: 0.15, aoIntensity: 0.8,
      environmentSunSize: 0.25,
    },
    cavity: {
      color: 0x1c2a0a, light: 0xd6e85a, lightStrength: 1.9, spotLight: 0.14, wallGlow: 2,
    },
    post: { exposure: 1, bloomStrength: 0.15, bloomRadius: 0.2, bloomThreshold: 1.2 },
    atmosphere: {
      style: "dust", strength: 0.12, color: 0xfff0c8, secondary: 0xc8e088, accentColor: 0xffe9a0,
      accentSecondary: 0x9ac86a, accentIntensity: 0.25, accentMotion: 0.5,
    },
  }),
  defineScene({
    id: "brick",
    presentation: {
      label: "Brick", pageBackground: "radial-gradient(circle at 50% 38%, #8a6350 0, #533a2e 70%, #241812 130%)",
      background: 0x4a382e,
    },
    textureSource: PBR_TEXTURE_SOURCES.brick,
    material: {
      color: 0xd8b9a6, roughness: 0.88, specularIntensity: 0.34, bumpScale: 0.055, normalStrength: 1.1,
      aoMapIntensity: 1.5, textureScale: 0.42, surfaceBrightness: 1.1,
    },
    lighting: {
      keyColor: 0xfff0dc, skyColor: 0xd8c6b4, groundColor: 0x4a352a, ambientColor: 0xc9a892, keyIntensity: 4.3,
      hemisphereIntensity: 1.25,
    },
    cavity: {
      color: 0x6b3410, light: 0xffa63c, lightStrength: 2.4, lightGain: 8,
      angle: 31, reach: 0.82, depth: 1.18, wallGlow: 2.2,
    },
    post: { exposure: 1.05, bloomStrength: 0.24, bloomRadius: 0.24, bloomThreshold: 0.72 },
    atmosphere: { color: 0xffa63c, secondary: 0xfff0dc },
  }),
  defineScene({
    id: "patchwork",
    presentation: {
      label: "Patchwork", pageBackground: "radial-gradient(circle at 50% 42%, #a77d4c 0, #71502f 72%, #382718 130%)",
      background: 0xa77b4b, rearColor: 0xe8d4ac,
    },
    textureSource: PBR_TEXTURE_SOURCES.patchwork,
    material: {
      color: 0xf6c98e, roughness: 0.44, specularIntensity: 0.55, bumpScale: 0.014, aoMapIntensity: 1, clearcoat: 0.18,
      clearcoatRoughness: 0.4, surfaceBrightness: 1.75, grade: { saturation: 1.36, contrast: 1.2, },
    },
    lighting: {
      keyColor: 0xffc983, skyColor: 0xd89a5b, groundColor: 0x352113, ambientColor: 0x8d572f, keyIntensity: 3.8,
      hemisphereIntensity: 1.26, aoIntensity: 0.84,
    },
    cavity: {
      color: 0x351503, light: 0xffae38, lightStrength: 1.105, spotLight: 0.15, voidGlow: 0.08, wallGlow: 1.55,
    },
    post: { exposure: 0.229 },
    atmosphere: { color: 0xffae38, secondary: 0xffc983 },
  }),
  defineScene({
    id: "darkrock",
    presentation: {
      label: "Basalt", pageBackground: "radial-gradient(circle at 50% 40%, #3d4150 0, #1f222b 70%, #0a0b10 130%)",
      background: 0x1c1f26, rearColor: 0xe0b264,
    },
    textureSource: PBR_TEXTURE_SOURCES.darkrock,
    material: {
      color: 0xcfc3b2, roughness: 0.78, specularIntensity: 0.85, bumpScale: 0.042, normalStrength: 1.15,
      aoMapIntensity: 1.25, clearcoat: 0.12, clearcoatRoughness: 0.38, textureScale: 0.52, surfaceBrightness: 2,
      grade: { saturation: 1.24, contrast: 1.1, },
    },
    lighting: {
      keyColor: 0xdde8ff, skyColor: 0x5f6c82, groundColor: 0x0c0b09, ambientColor: 0x424a5a, keyIntensity: 3.3,
      hemisphereIntensity: 1.05, ambientIntensity: 0.12, aoIntensity: 0.82,
      environmentSunSize: 0.4,
    },
    cavity: {
      color: 0x2a1504, light: 0xffb547, lightStrength: 1.8, spotLight: 0.14, wallGlow: 2.3,
    },
    post: { exposure: 0.95, bloomStrength: 0.3, bloomRadius: 0.26, bloomThreshold: 0.95 },
    atmosphere: {
      style: "dust", strength: 0.13, color: 0xffd98c, secondary: 0x8fa3c8, accentColor: 0xffc36a,
      accentSecondary: 0x5f7fd8, accentIntensity: 0.38, accentMotion: 0.75,
    },
  }),
  defineScene({
    id: "checkertile",
    presentation: {
      label: "Checkerboard",
      pageBackground: "radial-gradient(circle at 50% 38%, #9aa2ae 0, #4a4f57 70%, #1d1f23 130%)",
      background: 0x2f333a, rearColor: 0x20242c,
    },
    textureSource: PBR_TEXTURE_SOURCES.checkertile,
    material: {
      color: 0xe4dccf, roughness: 0.22, specularIntensity: 1.1, bumpScale: 0.02, aoMapIntensity: 0.9, clearcoat: 0.65,
      clearcoatRoughness: 0.1, textureScale: 1,
    },
    lighting: {
      keyColor: 0xfff6e8, skyColor: 0xc4cbd6, groundColor: 0x30343c, ambientColor: 0x9aa2ae, keyIntensity: 2.8,
      hemisphereIntensity: 1.35, ambientIntensity: 0.16, environmentSunSize: 0.8,
    },
    cavity: {
      color: 0x6b4a10, light: 0xffcf6b, lightStrength: 2.4, lightGain: 8,
      spotLight: 0.12, voidGlow: 0.07,
    },
    post: {
      exposure: 0.88, bloomStrength: 0.28, bloomGain: 0.2 / 0.75, bloomThreshold: 1.7,
    },
    atmosphere: { color: 0xffcf6b, secondary: 0xfff6e8 },
  }),
  defineScene({
    id: "weathered",
    presentation: {
      label: "Weathered", pageBackground: "radial-gradient(circle at 50% 42%, #7a6450 0, #4a3a2c 72%, #1d1610 130%)",
      background: 0x55432f, rearColor: 0xe8d8c0,
    },
    textureSource: PBR_TEXTURE_SOURCES.weathered,
    material: {
      color: 0xd8c8b4, roughness: 0.62, specularIntensity: 0.55, bumpScale: 0.035, normalStrength: 1.1,
      aoMapIntensity: 1.15, textureScale: 0.5, surfaceBrightness: 2.4,
      grade: { saturation: 1.12, contrast: 1.1, },
    },
    lighting: {
      keyColor: 0xffcf9a, skyColor: 0x9a8a74, groundColor: 0x140e08, ambientColor: 0x6e5c46, keyIntensity: 4,
      keyGain: 5 / 0.5, hemisphereIntensity: 1.35, ambientIntensity: 0.16, aoIntensity: 0.8, environmentIntensity: 5,
      environmentSunSize: 0.25,
    },
    cavity: {
      color: 0x2a1206, light: 0xff9440, lightStrength: 2, spotLight: 0.14, voidGlow: 0.1, wallGlow: 2.2,
    },
    post: { exposure: 0.62, bloomStrength: 0.16, bloomThreshold: 1.2 },
    atmosphere: {
      style: "dust", strength: 0.12, color: 0xffdfae, secondary: 0xa08a6e, accentColor: 0xffb964,
      accentSecondary: 0x8a9a74, accentIntensity: 0.28, accentMotion: 0.6,
    },
  }),
  defineScene({
    id: "obsidian",
    presentation: {
      label: "Obsidian", pageBackground: "radial-gradient(circle at 50% 40%, #241238 0, #150b23 72%, #0b0612 130%)",
      background: 0x120a1c, rearColor: 0xf0e8ff,
    },
    textureSource: PBR_TEXTURE_SOURCES.obsidian,
    material: {
      color: 0x352c4c, roughness: 0.9, specularIntensity: 1.35, bumpScale: 0.05, normalStrength: 0.7,
      aoMapIntensity: 1.3, clearcoat: 0.2, clearcoatRoughness: 0.34,
      rearClearcoat: 0.42, rearClearcoatRoughness: 0.48,
      rearDetailMaps: true, textureScale: 1, surfaceBrightness: 1.2,
      emissive: 0x2a1140, emissiveIntensity: 0.18, rearTexture: "/textures/pbr/onyxdark_color.webp",
      grade: { saturation: 1.16 },
    },
    lighting: {
      keyColor: 0x8f6fd0, skyColor: 0x2a1745, groundColor: 0x0e0716, ambientColor: 0x3a2258, keyIntensity: 2.3,
      hemisphereIntensity: 0.95, ambientIntensity: 0.16, aoIntensity: 0.86,
      environmentSunSize: 0.75,
    },
    cavity: {
      color: 0x0c0326, light: 0x825cff, lightStrength: 1.066, reach: 1.5,
      spotLight: 0.16, wallGlow: 2.2, rearGlow: 0.16,
    },
    post: { exposure: 1.7, bloomStrength: 0.42, bloomThreshold: 1.05 },
    atmosphere: {
      strength: 0.14, rate: 1, color: 0x825cff, secondary: 0x8f6fd0, accentColor: 0xb45cff, accentSecondary: 0x6a2bd8,
      accentIntensity: 0.2,
    },
  }),
  defineScene({
    id: "cliffside",
    presentation: {
      label: "Canyon", pageBackground: "radial-gradient(circle at 50% 40%, #a8663a 0, #5c3018 70%, #200e06 130%)",
      background: 0x53311c, rearColor: 0xffb35c,
    },
    textureSource: PBR_TEXTURE_SOURCES.cliffside,
    material: {
      color: 0xe0c0a0, roughness: 0.85, specularIntensity: 0.5, bumpScale: 0.05, normalStrength: 1.2,
      aoMapIntensity: 1.2, surfaceBrightness: 1.65, grade: { saturation: 1.05, contrast: 1.1, },
    },
    lighting: {
      keyColor: 0xffb160, skyColor: 0xb0785a, groundColor: 0x2a140a, ambientColor: 0x6a4a5c, keyIntensity: 4.8,
      hemisphereIntensity: 1.1, aoIntensity: 0.8,
      environmentSunSize: 0.2,
    },
    cavity: {
      color: 0x2c1206, light: 0xff8c3a, lightStrength: 2.2, spotLight: 0.15, voidGlow: 0.12, wallGlow: 2.5,
    },
    post: { exposure: 1.1, bloomStrength: 0.22, bloomRadius: 0.24, bloomThreshold: 0.9 },
    atmosphere: {
      style: "dust", strength: 0.16, color: 0xffc98a, secondary: 0xd88a4e, accentColor: 0xffa04c,
      accentSecondary: 0x8a5adf, accentIntensity: 0.4, accentMotion: 0.7,
    },
  }),
  defineScene({
    id: "onyxdark",
    presentation: {
      label: "Onyx", pageBackground: "radial-gradient(circle at 50% 38%, #6e675e 0, #38342f 70%, #151311 130%)",
      background: 0x22201d, rearColor: 0x20242c,
    },
    textureSource: PBR_TEXTURE_SOURCES.onyxdark,
    material: {
      color: 0xbfb4a6, roughness: 0.14, specularIntensity: 1.35, bumpScale: 0.012, normalStrength: 0.4,
      clearcoat: 0.9, clearcoatRoughness: 0.06, textureScale: 0.42, accentCubeColor: 0xd9a34e,
    },
    lighting: {
      keyColor: 0xfff4e2, skyColor: 0x8e8478, groundColor: 0x1c1a18, ambientColor: 0x6e675e, keyIntensity: 2.4,
      fillGain: 12 / 1.35, hemisphereGain: 8, hemisphereIntensity: 1.1, ambientIntensity: 0.13,
      environmentSunSize: 0.85,
    },
    cavity: {
      color: 0x6b4410, light: 0xffc46a, lightGain: 8, spotLight: 0.12, voidGlow: 0.07,
    },
    post: { bloomStrength: 0.36, bloomGain: 0.25 / 0.75, bloomThreshold: 1.7 },
    atmosphere: { color: 0xffc46a, secondary: 0xfff4e2 },
  }),
  defineScene({
    id: "parquet",
    presentation: {
      label: "Parquet", pageBackground: "radial-gradient(circle at 50% 42%, #735c50 0, #49382f 72%, #211813 130%)",
      background: 0x55453e, rearColor: 0xd6b485,
    },
    textureSource: PBR_TEXTURE_SOURCES.parquet,
    material: {
      color: 0xb59070, roughness: 0.48, specularIntensity: 0.48, bumpScale: 0.019, aoMapIntensity: 0.95,
      clearcoat: 0.16, clearcoatRoughness: 0.42, surfaceBrightness: 3, grade: { saturation: 1.24, contrast: 1.12, },
    },
    lighting: {
      keyColor: 0xe8b895, skyColor: 0xb18975, groundColor: 0x1a100c, ambientColor: 0x63483d, keyIntensity: 4.1,
      hemisphereIntensity: 1.32, ambientIntensity: 0.15, aoIntensity: 0.84,
    },
    cavity: {
      color: 0x281205, light: 0xff9c35, lightStrength: 1.066, spotLight: 0.14, voidGlow: 0.08, wallGlow: 1.55,
    },
    post: { exposure: 0.859, bloomStrength: 0.03 },
    atmosphere: { color: 0xff9c35, secondary: 0xe8b895 },
  }),
  defineScene({
    id: "heartwood",
    presentation: {
      label: "Heartwood", pageBackground: "radial-gradient(circle at 50% 42%, #886951 0, #5c4436 72%, #30221c 130%)",
      background: 0x76594a, rearColor: 0xd68b05,
    },
    textureSource: PBR_TEXTURE_SOURCES.heartwood,
    material: {
      color: 0xf4e8d6, roughness: 0.36, specularIntensity: 0.42, bumpScale: 0.02, normalStrength: 0.35,
      clearcoat: 0.22, clearcoatRoughness: 0.42, surfaceBrightness: 1.1,
    },
    lighting: {
      keyColor: 0xfff4e4, skyColor: 0xd8c4a8, groundColor: 0x4a382a, ambientColor: 0xb8a288, keyIntensity: 4.6,
      hemisphereIntensity: 0.85, ambientIntensity: 0.07, aoIntensity: 0.88,
      environmentSunSize: 0.22,
    },
    cavity: { color: 0x3a0701, light: 0xff4a12, lightStrength: 1.456, spotLight: 0.16, wallGlow: 2.15 },
    post: { exposure: 1.25 },
    atmosphere: { color: 0xff4a12, secondary: 0xfff4e4 },
  }),
  defineScene({
    id: "leather",
    presentation: {
      label: "Leather", pageBackground: "radial-gradient(circle at 50% 42%, #7a4a26 0, #4a2a14 72%, #1c0f07 130%)",
      background: 0x5c3a1e, rearColor: 0xf0ddc0,
    },
    textureSource: PBR_TEXTURE_SOURCES.leather,
    material: {
      color: 0xd8a468, roughness: 0.6, specularIntensity: 0.6, bumpScale: 0.03, normalStrength: 0.7,
      aoMapIntensity: 0.9, clearcoat: 0.18, clearcoatRoughness: 0.5, textureScale: 0.46, surfaceBrightness: 1.3,
      sheen: 0.15, sheenColor: 0xffdaa0, sheenRoughness: 0.5, grade: { saturation: 1.2, contrast: 1.1, },
    },
    lighting: {
      keyColor: 0xffd9a0, skyColor: 0xb08858, groundColor: 0x241206, ambientColor: 0x7a5330, keyIntensity: 3.9,
      hemisphereIntensity: 1.1, ambientIntensity: 0.13, aoIntensity: 0.85,
      environmentSunSize: 0.3,
    },
    cavity: {
      color: 0x2a1004, light: 0xff9c3a, lightStrength: 1.7, spotLight: 0.15, voidGlow: 0.09, wallGlow: 2,
    },
    post: { exposure: 0.95, bloomStrength: 0.12, bloomRadius: 0.2, bloomThreshold: 1.2 },
    atmosphere: {
      style: "dust", strength: 0.1, color: 0xffe0b0, secondary: 0xc08a4e, accentColor: 0xffcf8a,
      accentSecondary: 0x9a5a2a, accentIntensity: 0, accentMotion: 0.5,
    },
  }),
  defineScene({
    id: "dune",
    presentation: {
      label: "Dunes", pageBackground: "radial-gradient(circle at 50% 40%, #eab27a 0, #9c6a50 70%, #45283f 130%)",
      background: 0xb98d64, rearColor: 0x3a2450,
    },
    textureSource: PBR_TEXTURE_SOURCES.dune,
    material: {
      color: 0xf0d0a8, roughness: 1, specularIntensity: 0.25, bumpScale: 0.05, normalStrength: 1.2,
      aoMapIntensity: 0.95, textureScale: 0.9, surfaceBrightness: 1.6, grade: { saturation: 1.2, contrast: 1.05, },
    },
    lighting: {
      keyColor: 0xffc27a, skyColor: 0xe8b490, groundColor: 0x54341f, ambientColor: 0xc09070, keyIntensity: 4.6,
      hemisphereIntensity: 1.35, ambientIntensity: 0.16, aoIntensity: 0.75,
      environmentSunSize: 0.15,
    },
    cavity: {
      color: 0x1a1440, light: 0x7a6cff, lightStrength: 2, spotLight: 0.13, wallGlow: 2,
    },
    post: { exposure: 1.05, bloomStrength: 0.2, bloomRadius: 0.22, bloomThreshold: 1 },
    atmosphere: {
      style: "dust", strength: 0.18, color: 0xffd9a0, secondary: 0xc4a1ff, accentColor: 0xffbe78,
      accentSecondary: 0x8f7bff, accentIntensity: 0.35, accentMotion: 0.6,
    },
  }),
  defineScene({
    id: "moss",
    presentation: {
      label: "Mossgrown", pageBackground: "radial-gradient(circle at 50% 42%, #5e7a55 0, #35472f 72%, #141d12 130%)",
      background: 0x42543a, rearColor: 0xe8f0b0,
    },
    textureSource: PBR_TEXTURE_SOURCES.moss,
    material: {
      color: 0xd6dcc6, roughness: 0.9, specularIntensity: 0.45, bumpScale: 0.055, normalStrength: 1.25,
      aoMapIntensity: 1.3, surfaceBrightness: 1.6, grade: { saturation: 1.18, contrast: 1.08, },
    },
    lighting: {
      keyColor: 0xfaf3d8, skyColor: 0xa8c9a0, groundColor: 0x1c2618, ambientColor: 0x6a8a60, keyIntensity: 4.3,
      hemisphereIntensity: 1.35, aoIntensity: 0.8,
      environmentSunSize: 0.12,
    },
    cavity: {
      color: 0x06281a, light: 0x4dffa8, lightStrength: 2, spotLight: 0.13, voidGlow: 0.12, wallGlow: 2.3,
    },
    post: { exposure: 1.1, bloomStrength: 0.25, bloomRadius: 0.28, bloomThreshold: 0.95 },
    atmosphere: {
      style: "embers", strength: 0.25, rate: 2, color: 0xf4ffb0, secondary: 0x7dffb8, accentColor: 0xa8ff6a,
      accentSecondary: 0x2dd88a, accentIntensity: 0.5, accentMotion: 0.8,
    },
  }),
  defineScene({
    id: "amber",
    presentation: {
      label: "Amber", pageBackground: "radial-gradient(circle at 50% 38%, #c07a2c 0, #6b3a10 70%, #2a1405 130%)",
      background: 0x452208, rearColor: 0x0d0c0a,
    },
    textureSource: PBR_TEXTURE_SOURCES.amber,
    material: {
      color: 0xe8a83f, roughness: 0.16, metalness: 0.2, specularIntensity: 1.2, bumpScale: 0.012, normalStrength: 0.35,
      aoMapIntensity: 0.45, clearcoat: 0.85, clearcoatRoughness: 0.09, surfaceBrightness: 0.9, ior: 1.55,
      transmission: 0.86, thickness: 1.3, attenuationColor: 0x8a4207, attenuationDistance: 0.2,
      grade: { saturation: 1.18, contrast: 1.08, },
    },
    lighting: {
      keyColor: 0xffdca8, skyColor: 0xb0641a, groundColor: 0x240f02, ambientColor: 0x8f4d12, keyIntensity: 2.2,
      fillGain: 8 / 1.35, hemisphereGain: 8, hemisphereIntensity: 1.5, ambientIntensity: 0.22,
      aoIntensity: 0.56, environmentSunSize: 0.55,
    },
    cavity: { color: 0x8a4408, light: 0xffc061, lightStrength: 2.4, spotLight: 0.12, wallGlow: 2 },
    post: { bloomStrength: 0.36, bloomGain: 0.25 / 0.75, bloomThreshold: 1.3 },
    atmosphere: { color: 0xffc061, secondary: 0xffdca8 },
  }),
  defineScene({
    id: "marble",
    presentation: {
      label: "Marble", pageBackground: "radial-gradient(circle at 50% 42%, #b5b9c1 0, #777d88 72%, #343942 130%)",
      background: 0xa9adb4, rearColor: 0x20242c,
    },
    textureSource: PBR_TEXTURE_SOURCES.marble,
    material: { color: 0xd8d6d2, roughness: 0.22, bumpScale: 0.022, clearcoat: 0.18, clearcoatRoughness: 0.24 },
    lighting: {
      keyColor: 0xffffff, skyColor: 0xf6f8ff, groundColor: 0x262b34, ambientColor: 0xc7cbd2, keyIntensity: 3.9,
      hemisphereIntensity: 1.44, ambientIntensity: 0.18,
    },
    cavity: { color: 0x0b204f, light: 0x6e9dff, lightStrength: 1.014, spotLight: 0.12, voidGlow: 0.07 },
    post: { exposure: 0.283, bloomStrength: 0.17 },
    atmosphere: { color: 0x6e9dff, secondary: 0xffffff },
  }),
  defineScene({
    id: "playa",
    presentation: {
      label: "Playa", pageBackground: "radial-gradient(circle at 50% 40%, #c98a96 0, #7a5570 70%, #2c2140 130%)",
      background: 0x9a7080, rearColor: 0x2c1a4a,
    },
    textureSource: PBR_TEXTURE_SOURCES.playa,
    material: {
      color: 0xe8cba8, roughness: 0.95, specularIntensity: 0.3, bumpScale: 0.06, normalStrength: 1.35,
      aoMapIntensity: 1.45, textureScale: 0.5, surfaceBrightness: 1.55, grade: { contrast: 1.1 },
    },
    lighting: {
      keyColor: 0xffd6d0, skyColor: 0xd9a0c0, groundColor: 0x3a2a3c, ambientColor: 0x9a7a9a, keyIntensity: 3.8,
      ambientIntensity: 0.15, aoIntensity: 0.9,
      environmentSunSize: 0.18,
    },
    cavity: {
      color: 0x2c0d08, light: 0xff6a4e, lightStrength: 2.3, lightGain: 6,
      spotLight: 0.14, voidGlow: 0.13, wallGlow: 2.5, aboveBounce: 0,
    },
    post: { exposure: 1.2, bloomStrength: 0.24, bloomRadius: 0.26, bloomThreshold: 0.9 },
    atmosphere: {
      style: "dust", strength: 0.14, color: 0xffd0c0, secondary: 0xc9a0e8, accentColor: 0xff9a7a,
      accentSecondary: 0xa06adf, accentIntensity: 0, accentMotion: 0.65,
    },
  }),
  defineScene({
    id: "copper",
    presentation: {
      label: "Copper", pageBackground: "radial-gradient(circle at 50% 42%, #84442d 0, #532719 72%, #25100b 130%)",
      background: 0x6e3523, rearColor: 0xb8734c,
    },
    textureSource: DERIVED_TEXTURE_SOURCES.burl,
    material: {
      color: 0xd88b4e, roughness: 0.42, metalness: 0.5, specularIntensity: 0.32, bumpScale: 0.01,
      aoMapIntensity: 0.55, clearcoat: 0.02, clearcoatRoughness: 0.55, textureScale: 0.429, surfaceBrightness: 1.35,
      grade: { saturation: 1.14, contrast: 1.06, },
    },
    lighting: {
      keyColor: 0xa85431, skyColor: 0x5c3324, groundColor: 0x5c3324,
      hemisphereSkyColor: 0xb77c5d, hemisphereGroundColor: 0x9e694e,
      ambientColor: 0xb8734c, keyIntensity: 4.2,
      keyGain: 6 / 0.5, fillGain: 10 / 1.35, hemisphereGain: 8,
      hemisphereIntensity: 1.25, ambientIntensity: 0.26, aoIntensity: 0.84, shadowStrength: 0,
      environmentSunSize: 0.35, environmentSunIntensity: 0,
    },
    cavity: {
      color: 0x240b06, light: 0xff7845, lightStrength: 1.118, spotLight: 0, voidGlow: 0.09, wallGlow: 0,
      aboveBounce: 0,
    },
    post: { exposure: 1.4, bloomStrength: 0.02 },
    atmosphere: { color: 0xff7845, secondary: 0xffc79a },
  }),
  defineScene({
    id: "nacre",
    presentation: {
      label: "Nacre", pageBackground: "radial-gradient(circle at 50% 42%, #e9e2e6 0, #b0a8b6 72%, #5c5468 130%)",
      background: 0xd4ccd4, rearColor: 0x4a3a5c,
    },
    textureSource: PBR_TEXTURE_SOURCES.nacre,
    material: {
      color: 0xf4eef2, roughness: 0.18, specularIntensity: 1.2, bumpScale: 0.012, normalStrength: 0.4,
      aoMapIntensity: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.12, textureScale: 0.6, surfaceBrightness: 1.05,
      iridescence: 1, iridescenceIOR: 1.32, iridescenceThicknessRange: [120, 720],
      grade: { saturation: 1.05, contrast: 1.02, },
    },
    lighting: {
      keyColor: 0xffffff, skyColor: 0xf0eef8, groundColor: 0x585064, ambientColor: 0xc9c2ce, keyIntensity: 3.2,
      hemisphereIntensity: 1.5, ambientIntensity: 0.2, aoIntensity: 0.6,
      environmentSunSize: 0.7,
    },
    cavity: {
      color: 0x2a1a3e, light: 0xd9a8ff, lightStrength: 1.6, spotLight: 0.12, voidGlow: 0.08, wallGlow: 1.6,
    },
    post: { exposure: 0.45, bloomStrength: 0.2, bloomRadius: 0.2, bloomThreshold: 1.1 },
    atmosphere: {
      style: "dust", strength: 0.08, color: 0xffffff, secondary: 0xd9b8ff, accentColor: 0xb8e2ff,
      accentSecondary: 0xffc9e8, accentIntensity: 0.3, accentMotion: 0.6,
    },
  }),
  defineScene({
    id: "rockwall",
    presentation: {
      label: "Fieldstone", pageBackground: "radial-gradient(circle at 50% 42%, #6e6259 0, #3f3833 72%, #171310 130%)",
      background: 0x4a423b, rearColor: 0xffc27a,
    },
    textureSource: PBR_TEXTURE_SOURCES.rockwall,
    material: {
      color: 0xd8cabb, roughness: 0.88, specularIntensity: 0.5, bumpScale: 0.05, normalStrength: 1.25,
      aoMapIntensity: 1.35, surfaceBrightness: 1.9, grade: { saturation: 1.08, contrast: 1.1, },
    },
    lighting: {
      keyColor: 0xffc98a, skyColor: 0x8a8378, groundColor: 0x14100c, ambientColor: 0x5c564e, keyIntensity: 4,
      hemisphereIntensity: 1.15, ambientIntensity: 0.13, aoIntensity: 0.8,
      environmentSunSize: 0.25,
    },
    cavity: {
      color: 0x2a130a, light: 0xff9433, lightStrength: 2.1, spotLight: 0.15, voidGlow: 0.11, wallGlow: 2.4,
    },
    post: { exposure: 1.2, bloomStrength: 0.22, bloomRadius: 0.24, bloomThreshold: 0.95 },
    atmosphere: {
      style: "dust", strength: 0.12, color: 0xffd9a8, secondary: 0x9a8a78, accentColor: 0xffb964,
      accentSecondary: 0x6a7a94, accentIntensity: 0.3, accentMotion: 0.6,
    },
  }),
  defineScene({
    id: "rustedsteel",
    presentation: {
      label: "Rusted Steel",
      pageBackground: "radial-gradient(circle at 50% 38%, #7d6a5c 0, #4a423b 70%, #1e1a17 130%)",
      background: 0x3b3733,
    },
    textureSource: PBR_TEXTURE_SOURCES.rustedsteel,
    material: {
      color: 0xb9a496, roughness: 0.62, metalness: 0.72, specularIntensity: 0.9, bumpScale: 0.04, normalStrength: 0.9,
      aoMapIntensity: 1.15, textureScale: 0.5, surfaceBrightness: 0.95,
    },
    lighting: {
      keyColor: 0xfdf3e6, skyColor: 0xa8b4c2, groundColor: 0x3a3430, ambientColor: 0x8f9aa6, keyIntensity: 4,
      hemisphereIntensity: 1.15, ambientIntensity: 0.13,
    },
    cavity: {
      color: 0x123a55, light: 0x4db8ff, lightGain: 10,
      angle: 31, reach: 0.82, depth: 1.18, wallGlow: 2.3,
    },
    post: { exposure: 0.55, bloomStrength: 0.3, bloomRadius: 0.24, bloomThreshold: 0.72 },
    atmosphere: { color: 0x4db8ff, secondary: 0xfdf3e6 },
  }),
  defineScene({
    id: "walnut",
    presentation: {
      label: "Walnut", pageBackground: "radial-gradient(circle at 50% 42%, #5a3022 0, #351a13 72%, #190c09 130%)",
      background: 0x3c2119, rearColor: 0xeee5dc,
    },
    textureSource: PBR_TEXTURE_SOURCES.walnut,
    material: {
      color: 0xb08a63, roughness: 0.46, specularIntensity: 0.5, bumpScale: 0.021, aoMapIntensity: 0.85,
      clearcoat: 0.2, clearcoatRoughness: 0.42, textureScale: 0.473, surfaceBrightness: 3.2,
      grade: { saturation: 1.3, contrast: 1.08, },
    },
    lighting: {
      keyColor: 0xe4a574, skyColor: 0x9e674b, groundColor: 0x1b0d09, ambientColor: 0x623825, keyIntensity: 4.1,
      keyGain: 0.25 / 0.5, ambientIntensity: 0.15, aoIntensity: 0.86, environmentIntensity: 1.5,
    },
    cavity: {
      color: 0x250b03, light: 0xff7a28, lightStrength: 1.144, lightGain: 8,
      spotLight: 0.14, voidGlow: 0.09, wallGlow: 1.75,
    },
    post: { exposure: 0.523 },
    atmosphere: { color: 0xff7a28, secondary: 0xe4a574 },
  }),
  defineScene({
    id: "metalplate",
    presentation: {
      label: "Diamond Plate",
      pageBackground: "radial-gradient(circle at 50% 38%, #6d7a8b 0, #3a414b 70%, #171a1f 130%)",
      background: 0x2b3038,
    },
    textureSource: PBR_TEXTURE_SOURCES.metalplate,
    material: {
      color: 0xa8b0b8, roughness: 0.7, metalness: 0.8, specularIntensity: 1, bumpScale: 0.05, normalStrength: 0.7,
      aoMapIntensity: 1.2, textureScale: 0.5,
    },
    lighting: {
      keyColor: 0xf2f6ff, skyColor: 0x93a6bd, groundColor: 0x4c5867, ambientColor: 0x76839a, keyIntensity: 3.4,
      keyGain: 0.25 / 0.5, ambientIntensity: 0.15, environmentIntensity: 2, environmentSunSize: 0.65,
    },
    cavity: {
      color: 0x0e3346, light: 0x63d0ff, lightGain: 6,
      angle: 31, reach: 0.82, depth: 1.18, wallGlow: 2.3,
    },
    post: { bloomStrength: 0.34, bloomRadius: 0.24, bloomThreshold: 0.72 },
    atmosphere: { color: 0x63d0ff, secondary: 0xf2f6ff },
  }),
] as const satisfies readonly ScenePreset[]);

export type SceneId = (typeof SCENE_PRESETS)[number]["id"];

export type Scene = ScenePreset & { readonly id: SceneId };

const PRESET_BY_ID: ReadonlyMap<string, Scene> = new Map(
  SCENE_PRESETS.map((preset) => [preset.id, preset] as const),
);

export const SceneRegistry = Object.freeze({
  all: SCENE_PRESETS as readonly Scene[],
  default: SCENE_PRESETS[0] as Scene,
  get(id: string): Scene | undefined {
    return PRESET_BY_ID.get(id);
  },
  has(id: string): id is SceneId {
    return PRESET_BY_ID.has(id);
  },
  previewUrl(preset: Scene): string {
    return preset.textureSource.kind === "pbr"
      ? preset.textureSource.maps.color
      : preset.textureSource.albedo;
  },
});

export type ResolvedSceneProfile = Readonly<{
  id: SceneId;
  label: string;
  pageBackground: string;
  background: number;
  rearColor: number;
  textureSource: TextureSource;
  materialColor: number;
  roughness: number;
  metalness: number;
  specularIntensity: number;
  bumpScale: number;
  normalStrength: number;
  aoMapIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  rearClearcoat: number;
  rearClearcoatRoughness: number;
  rearDetailMaps: boolean;
  textureScale: number;
  surfaceBrightness: number;
  ior: number;
  sheen: number;
  sheenColor: number;
  sheenRoughness: number;
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThicknessRange: readonly [number, number];
  transmission: number;
  thickness: number;
  attenuationColor: number;
  attenuationDistance: number;
  emissive: number;
  emissiveIntensity: number;
  surfaceGrade: MaterialGrade;
  accentCubeColor?: number;
  rearTexture?: string;
  keyColor: number;
  keyIntensity: number;
  keyGain: number;
  fillGain: number;
  hemisphereGain: number;
  skyColor: number;
  groundColor: number;
  hemisphereSkyColor: number;
  hemisphereGroundColor: number;
  ambientColor: number;
  hemisphereIntensity: number;
  ambientIntensity: number;
  aoIntensity: number;
  shadowStrength: number;
  environmentIntensity: number;
  environmentSunSize: number;
  environmentSunIntensity?: number;
  environmentSkyIntensity?: number;
  cavityColor: number;
  cavityLight: number;
  cavityLightStrength: number;
  cavityLightGain: number;
  cavityAngle: number;
  cavityReach: number;
  cavityDepth: number;
  cavitySpotLight: number;
  cavityVoidGlow: number;
  cavityWallGlow: number;
  cavityAboveBounce: number;
  cavityRearGlow: number;
  exposure: number;
  bloomStrength: number;
  bloomGain: number;
  bloomRadius: number;
  bloomThreshold: number;
  atmosphere: AtmosphereStyle;
  atmosphereStrength: number;
  atmosphereRate: number;
  atmosphereSquareness: number;
  atmosphereColor: number;
  atmosphereSecondary: number;
  accentColor: number;
  accentSecondary: number;
  accentIntensity: number;
  accentMotion: number;
}>;

export function resolveScenePreset(preset: Scene): ResolvedSceneProfile {
  const { presentation, material, lighting, cavity, post, atmosphere } = preset;

  return {
    id: preset.id,
    label: presentation.label,
    pageBackground: presentation.pageBackground,
    background: presentation.background,
    rearColor: presentation.rearColor,
    textureSource: preset.textureSource,
    materialColor: material.color,
    roughness: material.roughness,
    metalness: material.metalness,
    specularIntensity: material.specularIntensity,
    bumpScale: material.bumpScale,
    normalStrength: material.normalStrength,
    aoMapIntensity: material.aoMapIntensity,
    clearcoat: material.clearcoat,
    clearcoatRoughness: material.clearcoatRoughness,
    rearClearcoat: material.rearClearcoat,
    rearClearcoatRoughness: material.rearClearcoatRoughness,
    rearDetailMaps: material.rearDetailMaps,
    textureScale: material.textureScale,
    surfaceBrightness: material.surfaceBrightness,
    ior: material.ior,
    sheen: material.sheen,
    sheenColor: material.sheenColor,
    sheenRoughness: material.sheenRoughness,
    iridescence: material.iridescence,
    iridescenceIOR: material.iridescenceIOR,
    iridescenceThicknessRange: material.iridescenceThicknessRange,
    transmission: material.transmission,
    thickness: material.thickness,
    attenuationColor: material.attenuationColor,
    attenuationDistance: material.attenuationDistance,
    emissive: material.emissive,
    emissiveIntensity: material.emissiveIntensity,
    surfaceGrade: material.grade,
    accentCubeColor: material.accentCubeColor,
    rearTexture: material.rearTexture,
    keyColor: lighting.keyColor,
    keyIntensity: lighting.keyIntensity,
    keyGain: lighting.keyGain,
    fillGain: lighting.fillGain,
    hemisphereGain: lighting.hemisphereGain,
    skyColor: lighting.skyColor,
    groundColor: lighting.groundColor,
    hemisphereSkyColor: lighting.hemisphereSkyColor ?? lighting.skyColor,
    hemisphereGroundColor: lighting.hemisphereGroundColor ?? lighting.groundColor,
    ambientColor: lighting.ambientColor,
    hemisphereIntensity: lighting.hemisphereIntensity,
    ambientIntensity: lighting.ambientIntensity,
    aoIntensity: lighting.aoIntensity,
    shadowStrength: lighting.shadowStrength,
    environmentIntensity: lighting.environmentIntensity,
    environmentSunSize: lighting.environmentSunSize,
    environmentSunIntensity: lighting.environmentSunIntensity,
    environmentSkyIntensity: lighting.environmentSkyIntensity,
    cavityColor: cavity.color,
    cavityLight: cavity.light,
    cavityLightStrength: cavity.lightStrength,
    cavityLightGain: cavity.lightGain,
    cavityAngle: cavity.angle,
    cavityReach: cavity.reach,
    cavityDepth: cavity.depth,
    cavitySpotLight: cavity.spotLight,
    cavityVoidGlow: cavity.voidGlow,
    cavityWallGlow: cavity.wallGlow,
    cavityAboveBounce: cavity.aboveBounce,
    cavityRearGlow: cavity.rearGlow,
    exposure: post.exposure,
    bloomStrength: post.bloomStrength,
    bloomGain: post.bloomGain,
    bloomRadius: post.bloomRadius,
    bloomThreshold: post.bloomThreshold,
    atmosphere: atmosphere.style,
    atmosphereStrength: atmosphere.strength,
    atmosphereRate: atmosphere.rate,
    atmosphereSquareness: atmosphere.squareness,
    atmosphereColor: atmosphere.color,
    atmosphereSecondary: atmosphere.secondary,
    accentColor: atmosphere.accentColor,
    accentSecondary: atmosphere.accentSecondary,
    accentIntensity: atmosphere.accentIntensity,
    accentMotion: atmosphere.accentMotion,
  };
}
