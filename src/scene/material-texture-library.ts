import * as THREE from "three";
import { MeshPhysicalNodeMaterial } from "three/webgpu";

import { addCavityWallLightNode } from "./cavity-wall-light-node";
import { addLavaShaderNode } from "./lava-material-node";
import { addSurfaceGradeNode } from "./surface-grade-node";
import type { ResolvedSceneProfile, SceneId } from "./scenes";
import type {
  AuthoredPbrTextureSource,
  SharedDerivedTextureSource,
  TextureSource,
} from "./texture-sources";
import {
  makeAmbientOcclusionFromDisplacement,
  makeSurfaceDetailMaps,
} from "./textures";

type TextureBundle = {
  albedo: THREE.Texture;
  height: THREE.Texture;
  roughness: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
};

type SceneMaterialBundle = {
  primary: MeshPhysicalNodeMaterial;
  accent: MeshPhysicalNodeMaterial | null;
};

function applyMaterialProfile(
  material: MeshPhysicalNodeMaterial,
  profile: ResolvedSceneProfile,
  color: number,
) {
  material.color.setHex(color);
  material.roughness = profile.roughness;
  material.metalness = profile.metalness;
  material.specularIntensity = profile.specularIntensity;
  material.bumpScale = profile.bumpScale;
  material.clearcoat = profile.clearcoat;
  material.clearcoatRoughness = profile.clearcoatRoughness;
  material.ior = profile.ior;
  material.sheen = profile.sheen;
  material.sheenColor.setHex(profile.sheenColor);
  material.sheenRoughness = profile.sheenRoughness;
  material.iridescence = profile.iridescence;
  material.iridescenceIOR = profile.iridescenceIOR;
  material.iridescenceThicknessRange = [...profile.iridescenceThicknessRange];
  material.transmission = profile.transmission;
  material.thickness = profile.thickness;
  material.attenuationColor.setHex(profile.attenuationColor);
  material.attenuationDistance = profile.attenuationDistance;
  material.emissive.setHex(profile.emissive);
  material.emissiveIntensity = profile.emissiveIntensity;
}

function textureSourceKey(source: TextureSource) {
  return `${source.kind}:${source.id}`;
}

export function createMaterialTextureLibrary({
  profiles,
  maxAnisotropy,
  invalidate,
  onBundleBound,
}: {
  profiles: readonly ResolvedSceneProfile[];
  maxAnisotropy: number;
  invalidate: () => void;
  onBundleBound: (sceneIds: readonly SceneId[]) => void;
}) {
  const materials = new Map<SceneId, SceneMaterialBundle>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedTextures = new Set<THREE.Texture>();
  let disposed = false;
  let loadingStarted = false;

  const ownTexture = <Texture extends THREE.Texture>(texture: Texture): Texture => {
    ownedTextures.add(texture);
    return texture;
  };

  const releaseTexture = (texture: THREE.Texture) => {
    texture.dispose();
    ownedTextures.delete(texture);
  };

  const createMaterialChannel = (
    profile: ResolvedSceneProfile,
    color: number,
    molten: boolean,
  ) => {
    const material = new MeshPhysicalNodeMaterial();
    ownedMaterials.add(material);
    applyMaterialProfile(material, profile, color);
    addSurfaceGradeNode(material);
    if (molten) addLavaShaderNode(material);
    addCavityWallLightNode(material);
    return material;
  };

  for (const profile of profiles) {
    const molten = profile.id === "lava";
    const primary = createMaterialChannel(profile, profile.materialColor, molten);
    const accent = profile.accentCubeColor === undefined
      ? null
      : createMaterialChannel(profile, profile.accentCubeColor, molten);
    materials.set(profile.id, { primary, accent });
  }

  const textureBundles = new Map<string, TextureBundle>();

  const bindBundleToMaterial = (
    material: MeshPhysicalNodeMaterial,
    profile: ResolvedSceneProfile,
    bundle: TextureBundle | undefined,
  ) => {
    material.map = bundle?.albedo ?? null;
    material.bumpMap = bundle?.height ?? null;
    material.roughnessMap = bundle?.roughness ?? null;
    material.normalMap = bundle?.normal ?? null;
    material.aoMap = bundle?.ao ?? null;
    if (material.aoMap) material.aoMap.channel = 0;
    material.aoMapIntensity = profile.aoMapIntensity;
    material.normalScale.setScalar(profile.normalStrength);
    material.clearcoatNormalMap =
      profile.clearcoat > 0.05 ? bundle?.normal ?? null : null;
    material.clearcoatNormalScale.setScalar(
      Math.max(0.08, profile.normalStrength * 0.34),
    );
    material.needsUpdate = true;
  };

  const configureTexture = (
    texture: THREE.Texture,
    srgb: boolean,
    scale: number,
  ) => {
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(scale, scale);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = maxAnisotropy;
    return texture;
  };

  const textureLoader = new THREE.TextureLoader();
  let settleLoad = () => {};
  const loadTracked = (
    url: string,
    onLoad?: (texture: THREE.Texture) => void,
  ) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      settleLoad();
    };
    const texture = textureLoader.load(url, (loaded) => {
      try {
        if (disposed) {
          releaseTexture(loaded);
          return;
        }
        onLoad?.(loaded);
      } finally {
        settle();
      }
    }, undefined, settle);
    return ownTexture(texture);
  };

  const bindTextureBundle = (
    bundle: TextureBundle,
    groupedProfiles: readonly ResolvedSceneProfile[],
  ) => {
    for (const profile of groupedProfiles) {
      const material = materials.get(profile.id)?.primary;
      if (!material) continue;
      bindBundleToMaterial(material, profile, bundle);
    }
    onBundleBound(groupedProfiles.map((profile) => profile.id));
    invalidate();
  };

  const conditionPbrColor = (
    loaded: THREE.Texture,
    source: AuthoredPbrTextureSource,
    scale: number,
  ) => {
    const { saturation, contrast } = source.colorConditioning;
    if (saturation === 1 && contrast === 1) {
      return configureTexture(loaded, true, scale);
    }
    const image = loaded.image as HTMLImageElement;
    const width = image.naturalWidth || image.width || 1024;
    const height = image.naturalHeight || image.height || 1024;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.filter = `saturate(${saturation}) contrast(${contrast})`;
    context.drawImage(image, 0, 0, width, height);
    context.filter = "none";
    const conditioned = ownTexture(new THREE.CanvasTexture(canvas));
    releaseTexture(loaded);
    return configureTexture(conditioned, true, scale);
  };

  const loadPbrSource = (
    source: AuthoredPbrTextureSource,
    groupedProfiles: readonly ResolvedSceneProfile[],
  ) => {
    const scale = groupedProfiles[0].textureScale;
    const key = textureSourceKey(source);
    // Conditioning replaces the loaded texture, so rebind anything already using it.
    let color = configureTexture(
      loadTracked(source.maps.color, (loaded) => {
        const conditioned = conditionPbrColor(loaded, source, scale);
        if (conditioned !== color) {
          color = conditioned;
          const bundle = textureBundles.get(key);
          if (bundle) bundle.albedo = conditioned;
          for (const profile of groupedProfiles) {
            const material = materials.get(profile.id)?.primary;
            if (!material) continue;
            material.map = conditioned;
            material.needsUpdate = true;
          }
        }
        invalidate();
      }),
      true,
      scale,
    );
    const normal = configureTexture(
      loadTracked(source.maps.normal, invalidate),
      false,
      scale,
    );
    const roughness = configureTexture(
      loadTracked(source.maps.rough, invalidate),
      false,
      scale,
    );
    configureTexture(
      loadTracked(source.maps.disp, (displacement) => {
        const ao = ownTexture(
          makeAmbientOcclusionFromDisplacement(
            displacement.image as CanvasImageSource,
            scale,
            maxAnisotropy,
          ),
        );
        const bundle = {
          albedo: color,
          height: displacement,
          roughness,
          normal,
          ao,
        };
        textureBundles.set(key, bundle);
        bindTextureBundle(bundle, groupedProfiles);
      }),
      false,
      scale,
    );
  };

  const loadDerivedSource = (
    source: SharedDerivedTextureSource,
    groupedProfiles: readonly ResolvedSceneProfile[],
  ) => {
    loadTracked(source.albedo, (loaded) => {
      const { blur, contrast, saturation } = source.conditioning;
      const albedoCanvas = document.createElement("canvas");
      albedoCanvas.width = 1024;
      albedoCanvas.height = 1024;
      const context = albedoCanvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas 2D is unavailable");
      context.filter = `blur(${blur}px) contrast(${contrast}) saturate(${saturation})`;
      context.drawImage(loaded.image as CanvasImageSource, -1024, -1024, 1024, 1024);
      context.drawImage(loaded.image as CanvasImageSource, 0, -1024, 1024, 1024);
      context.drawImage(loaded.image as CanvasImageSource, -1024, 0, 1024, 1024);
      context.drawImage(loaded.image as CanvasImageSource, 0, 0, 1024, 1024);
      context.filter = "none";

      const scale = groupedProfiles[0].textureScale;
      const albedo = configureTexture(
        ownTexture(new THREE.CanvasTexture(albedoCanvas)),
        true,
        scale,
      );
      albedo.generateMipmaps = true;
      releaseTexture(loaded);

      const detailMaps = makeSurfaceDetailMaps(
        albedoCanvas,
        scale,
        maxAnisotropy,
        source.detail,
      );
      ownTexture(detailMaps.height);
      ownTexture(detailMaps.roughness);
      ownTexture(detailMaps.normal);
      ownTexture(detailMaps.ao);
      const bundle = { albedo, ...detailMaps };
      textureBundles.set(textureSourceKey(source), bundle);
      bindTextureBundle(bundle, groupedProfiles);
    });
  };

  const startEagerLoading = (
    priorityId: SceneId,
    onComplete: () => void,
  ) => {
    if (loadingStarted || disposed) return;
    loadingStarted = true;
    const groupedSources = new Map<
      string,
      { source: TextureSource; profiles: ResolvedSceneProfile[] }
    >();
    for (const profile of profiles) {
      const key = textureSourceKey(profile.textureSource);
      const grouped = groupedSources.get(key) ?? {
        source: profile.textureSource,
        profiles: [],
      };
      grouped.profiles.push(profile);
      groupedSources.set(key, grouped);
    }

    const loadGroup = ({ source, profiles: groupedProfiles }: {
      source: TextureSource;
      profiles: ResolvedSceneProfile[];
    }) => {
      if (source.kind === "pbr") loadPbrSource(source, groupedProfiles);
      else loadDerivedSource(source, groupedProfiles);
    };
    const groups = [...groupedSources.values()];
    const total = groups.reduce(
      (count, group) => count + (group.source.kind === "pbr" ? 4 : 1),
      0,
    );
    let loaded = 0;
    settleLoad = () => {
      if (disposed) return;
      loaded += 1;
      if (loaded === total) onComplete();
    };

    const isPriority = (group: (typeof groups)[number]) =>
      group.profiles.some((profile) => profile.id === priorityId);
    for (const group of groups) {
      if (isPriority(group)) loadGroup(group);
    }
    for (const group of groups) {
      if (!isPriority(group) && group.source.kind === "pbr") loadGroup(group);
    }
    for (const group of groups) {
      if (!isPriority(group) && group.source.kind === "derived") loadGroup(group);
    }
  };

  return {
    useScene: (id: SceneId) => {
      const bundle = materials.get(id);
      if (!bundle) throw new Error(`Unknown scene material: ${id}`);
      return bundle;
    },
    startEagerLoading,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const material of ownedMaterials) material.dispose();
      ownedMaterials.clear();
      for (const texture of ownedTextures) texture.dispose();
      ownedTextures.clear();
      textureBundles.clear();
      materials.clear();
    },
  };
}
