import {
  PBR_TEXTURE_SETS,
  type PbrTextureMaps,
  type PbrTextureSetId,
} from "./pbr-sets";

type TextureConditioning = Readonly<{
  blur: number;
  contrast: number;
  saturation: number;
}>;

type DerivedMapSettings = Readonly<{
  reliefFromAlbedo: number;
  microDetail: number;
  microScale: number;
  roughnessBase: number;
  roughnessVariation: number;
}>;

export type AuthoredPbrTextureSource = Readonly<{
  kind: "pbr";
  id: PbrTextureSetId;
  maps: PbrTextureMaps;
  colorConditioning: Readonly<{
    contrast: number;
    saturation: number;
  }>;
}>;

export type SharedDerivedTextureSource = Readonly<{
  kind: "derived";
  id: "burl" | "charred";
  albedo: string;
  conditioning: TextureConditioning;
  detail: DerivedMapSettings;
}>;

export type TextureSource = AuthoredPbrTextureSource | SharedDerivedTextureSource;

function authoredPbr<const Id extends PbrTextureSetId>(
  id: Id,
  contrast = 1,
  saturation = 1,
) {
  return Object.freeze({
    kind: "pbr" as const,
    id,
    maps: PBR_TEXTURE_SETS[id],
    colorConditioning: Object.freeze({ contrast, saturation }),
  });
}

export const PBR_TEXTURE_SOURCES = Object.freeze({
  stone: authoredPbr("stone", 1.62, 0.85),
  rustedsteel: authoredPbr("rustedsteel", 1.45, 1.35),
  metalpanel: authoredPbr("metalpanel", 1.25, 0.85),
  metalplate: authoredPbr("metalplate", 1.2, 0.75),
  brick: authoredPbr("brick", 1.22, 1.05),
  cobblestone: authoredPbr("cobblestone", 1.18, 0.95),
  heartwood: authoredPbr("heartwood", 1.22),
  weathered: authoredPbr("weathered", 1.15, 1.05),
  patchwork: authoredPbr("patchwork"),
  parquet: authoredPbr("parquet"),
  walnut: authoredPbr("walnut"),
  amber: authoredPbr("amber", 1.4, 1.7),
  marble: authoredPbr("marble"),
  onyxteal: authoredPbr("onyxteal", 1.3, 1.25),
  onyxdark: authoredPbr("onyxdark", 1.3, 1.1),
  checkertile: authoredPbr("checkertile", 1.15),
  glacier: authoredPbr("glacier", 1.2, 1.1),
  obsidian: authoredPbr("obsidian", 1.15),
  darkrock: authoredPbr("darkrock", 1.25, 1.15),
  cliffside: authoredPbr("cliffside", 1.15, 0.9),
  dune: authoredPbr("dune", 1.1, 1.15),
  rockwall: authoredPbr("rockwall", 1.15, 1.05),
  geometrydash: authoredPbr("geometrydash"),
  bamboo: authoredPbr("bamboo", 1.1, 1.05),
  leather: authoredPbr("leather", 1.15, 1.1),
  moss: authoredPbr("moss", 1.2, 1.15),
  playa: authoredPbr("playa", 1.15),
  nacre: authoredPbr("nacre"),
});

const SHARED_CONDITIONING = Object.freeze({
  blur: 1.5,
  contrast: 1.52,
  saturation: 1.12,
});

export const DERIVED_TEXTURE_SOURCES = Object.freeze({
  burl: Object.freeze({
    kind: "derived" as const,
    id: "burl" as const,
    albedo: "/textures/burl.png",
    conditioning: SHARED_CONDITIONING,
    detail: Object.freeze({
      reliefFromAlbedo: 0.42,
      microDetail: 0.203,
      microScale: 33.8,
      roughnessBase: 0.899,
      roughnessVariation: 0.24,
    }),
  }),
  charred: Object.freeze({
    kind: "derived" as const,
    id: "charred" as const,
    albedo: "/textures/charred.png",
    conditioning: SHARED_CONDITIONING,
    detail: Object.freeze({
      reliefFromAlbedo: 0.85,
      microDetail: 0.315,
      microScale: 28.6,
      roughnessBase: 0.952,
      roughnessVariation: 0.24,
    }),
  }),
}) satisfies Readonly<Record<string, SharedDerivedTextureSource>>;
