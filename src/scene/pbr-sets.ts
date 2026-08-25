export type PbrTextureMaps = Readonly<{
  color: string;
  normal: string;
  rough: string;
  disp: string;
}>;

const PBR_TEXTURE_SET_IDS = [
  "stone", "walnut", "rockwall", "geometrydash", "bamboo", "parquet", "patchwork",
  "marble", "cobblestone", "obsidian", "darkrock", "cliffside", "dune", "leather",
  "moss", "playa", "nacre", "glacier", "brick", "rustedsteel", "amber", "metalplate",
  "metalpanel", "checkertile", "onyxdark", "onyxteal", "weathered", "heartwood",
] as const;

export type PbrTextureSetId = (typeof PBR_TEXTURE_SET_IDS)[number];

export const PBR_TEXTURE_SETS = Object.freeze(
  Object.fromEntries(
    PBR_TEXTURE_SET_IDS.map((id) => [
      id,
      Object.freeze({
        color: `/textures/pbr/${id}_color.webp`,
        normal: `/textures/pbr/${id}_normal.webp`,
        rough: `/textures/pbr/${id}_rough.webp`,
        disp: `/textures/pbr/${id}_disp.webp`,
      }),
    ]),
  ) as Record<PbrTextureSetId, PbrTextureMaps>,
);
