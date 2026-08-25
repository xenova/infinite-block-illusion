import * as THREE from "three";
import { MeshPhysicalNodeMaterial } from "three/webgpu";

import type { SoundtrackController } from "../audio/shepard-soundtrack";
import { DEFAULT_VISUAL_TUNING, type VisualTuning } from "../tuning/schema";
import {
  clamp,
  clamp01,
  degToRad,
  positiveModulo,
} from "../util/math";
import { createAnimationRuntime } from "./animation-runtime";
import { BASE_CAMERA_POSITION, BASE_CAMERA_TARGET } from "./constants";
import { setLavaPhase } from "./lava-material-node";
import { createMaterialTextureLibrary } from "./material-texture-library";
import { createRenderPipeline, type RendererBackend } from "./render-pipeline";
import {
  followingSceneCycleWindow,
  nextSceneCycleWindow,
  sceneCycleWindow,
  type SceneCycleOptions,
  type SceneCycleWindow,
} from "./scene-cycle";
import { createSceneController } from "./scene-controller";
import {
  SceneRegistry,
  resolveScenePreset,
  type ResolvedSceneProfile,
  type SceneId,
} from "./scenes";
import { makeBackdropTexture } from "./textures";
import { setSurfaceGrade } from "./surface-grade-node";
import { applySceneProfile, createVisualProfile } from "./visual-profile";
import { createWorldController } from "./world-controller";

type IllusionOptions = {
  backend: RendererBackend;
  scene: SceneId;
  tuning: VisualTuning;
  speed: number;
  paused: boolean;
  onReady?: () => void;
  onCycleSceneChange?: (scene: SceneId) => void;
  onCycleTransitionProgress?: (progress: number) => void;
};

export type IllusionHandle = {
  setScene: (scene: SceneId, animateTransition: boolean) => void;
  setTuning: (tuning: VisualTuning) => void;
  setSpeed: (speed: number) => void;
  setPaused: (paused: boolean) => void;
  setCycle: (cycle: SceneCycleOptions) => void;
  soundtrack: SoundtrackController;
  dispose: () => void;
};

/**
 * Every map channel a scene material binds. Accent materials copy all of them
 * from their primary, and the texture-scale control retiles all of them together
 * so the maps stay registered with one another.
 */
const MATERIAL_MAPS = [
  "map",
  "bumpMap",
  "roughnessMap",
  "normalMap",
  "aoMap",
  "clearcoatNormalMap",
] as const;

type CanvasLayer = {
  canvas: HTMLCanvasElement;
  opacity: number;
};

type OutgoingRenderLayer = CanvasLayer & ({
  kind: "animated";
  profile: ResolvedSceneProfile;
  environment: { texture: THREE.Texture; dispose: () => void };
  context: CanvasRenderingContext2D;
} | { kind: "snapshot" });

export async function createIllusion(
  host: HTMLElement,
  options: IllusionOptions,
): Promise<IllusionHandle | null> {
  const pipeline = await createRenderPipeline(host, options.tuning, options.backend);
  if (!pipeline) return null;
  const { maxAnisotropy, scene } = pipeline;

  let tuning = options.tuning;
  let invalidateFrame: () => void = () => undefined;
  const invalidate = () => invalidateFrame();

  const backdropTexture = makeBackdropTexture();
  scene.background = backdropTexture;

  const orientationCamera = new THREE.PerspectiveCamera();
  const cameraBasePosition = BASE_CAMERA_POSITION.clone();
  const cameraBaseTarget = BASE_CAMERA_TARGET.clone();
  const cameraOrientation = new THREE.Quaternion();

  let cameraCalibrationSignature = "";

  const applyCameraCalibration = (next: VisualTuning) => {
    const signature = [
      next.cameraX,
      next.cameraY,
      next.cameraZ,
      next.cameraTargetX,
      next.cameraTargetY,
      next.cameraTargetZ,
      next.cameraFov,
      next.cameraRoll,
    ].join("|");
    if (signature === cameraCalibrationSignature) return false;
    cameraCalibrationSignature = signature;
    cameraBasePosition.set(next.cameraX, next.cameraY, next.cameraZ);
    cameraBaseTarget.set(next.cameraTargetX, next.cameraTargetY, next.cameraTargetZ);
    orientationCamera.position.copy(cameraBasePosition);
    orientationCamera.lookAt(cameraBaseTarget);
    orientationCamera.rotateZ(degToRad(next.cameraRoll));
    cameraOrientation.copy(orientationCamera.quaternion);
    pipeline.setDesignFov(next.cameraFov);
    return true;
  };
  applyCameraCalibration(tuning);

  const sceneProfiles = SceneRegistry.all.map((preset) => resolveScenePreset(preset));
  const initialProfile = resolveScenePreset(
    SceneRegistry.get(options.scene) ?? SceneRegistry.default,
  );

  let controller: ReturnType<
    typeof createSceneController<OutgoingRenderLayer>
  > | null = null;
  const materialLibrary = createMaterialTextureLibrary({
    profiles: sceneProfiles,
    maxAnisotropy,
    invalidate,
    onBundleBound: (sceneIds) => {
      const profile = controller?.getProfile();
      if (
        controller
        && !controller.isTransitioning()
        && profile
        && sceneIds.includes(profile.id)
      ) applyVisualTuning();
    },
  });

  const initialMaterialBundle = materialLibrary.useScene(initialProfile.id);
  const world = createWorldController({
    pipeline,
    initialMaterial: initialMaterialBundle.primary,
    cameraBasePosition,
    cameraOrientation,
  });

  const visualProfile = createVisualProfile();
  let activeVisualMaterial = initialMaterialBundle.primary;
  let activeAccentMaterial = initialMaterialBundle.accent;
  const accentBaseColor = new THREE.Color(0xffffff);
  let lastAoSignature = "";

  // Accent materials share the primary maps and physical settings, but keep their color.
  const syncAccentMaterial = (
    accent: MeshPhysicalNodeMaterial,
    primary: MeshPhysicalNodeMaterial,
  ) => {
    let mapsChanged = false;
    for (const channel of MATERIAL_MAPS) {
      if (accent[channel] === primary[channel]) continue;
      accent[channel] = primary[channel];
      mapsChanged = true;
    }
    if (accent.aoMap) accent.aoMap.channel = primary.aoMap ? primary.aoMap.channel : 0;
    if (mapsChanged) accent.needsUpdate = true;

    accent.roughness = primary.roughness;
    accent.metalness = primary.metalness;
    accent.specularIntensity = primary.specularIntensity;
    accent.bumpScale = primary.bumpScale;
    accent.aoMapIntensity = primary.aoMapIntensity;
    accent.normalScale.copy(primary.normalScale);
    accent.clearcoatNormalScale.copy(primary.clearcoatNormalScale);
    accent.clearcoat = primary.clearcoat;
    accent.clearcoatRoughness = primary.clearcoatRoughness;
    accent.sheen = primary.sheen;
    accent.sheenColor.copy(primary.sheenColor);
    accent.sheenRoughness = primary.sheenRoughness;
    accent.iridescence = primary.iridescence;
    accent.iridescenceIOR = primary.iridescenceIOR;
    accent.iridescenceThicknessRange[0] = primary.iridescenceThicknessRange[0];
    accent.iridescenceThicknessRange[1] = primary.iridescenceThicknessRange[1];
    accent.transmission = primary.transmission;
    accent.thickness = primary.thickness;
    accent.attenuationColor.copy(primary.attenuationColor);
    accent.attenuationDistance = primary.attenuationDistance;
    accent.emissive.copy(primary.emissive);
    accent.emissiveIntensity = primary.emissiveIntensity;
    accent.ior = primary.ior;
  };

  const applyVisualTuning = (next = tuning) => {
    tuning = next;
    if (applyCameraCalibration(next)) world.recalibrateRear();
    pipeline.setExposure(visualProfile.exposure * next.exposure);

    const material = activeVisualMaterial;
    material.color.copy(visualProfile.materialColor).multiplyScalar(next.albedo);
    material.roughness = clamp(visualProfile.roughness + next.roughnessOffset, 0, 1);
    material.metalness = clamp(visualProfile.metalness + next.metalnessOffset, 0, 1);
    material.specularIntensity = clamp(visualProfile.specular * next.specular, 0, 5);
    material.bumpScale = visualProfile.bump * next.bump;
    material.aoMapIntensity = visualProfile.aoMapIntensity;
    material.normalScale.setScalar(visualProfile.normalStrength * next.bump);
    material.clearcoatNormalScale.setScalar(
      Math.max(0.04, visualProfile.normalStrength * next.bump * 0.34),
    );
    material.clearcoat = clamp(visualProfile.clearcoat * next.clearcoat, 0, 1);
    material.clearcoatRoughness = clamp(
      visualProfile.clearcoatRoughness * next.clearcoatRoughness,
      0,
      1,
    );
    material.sheen = visualProfile.sheen;
    material.sheenColor.copy(visualProfile.sheenColor);
    material.sheenRoughness = visualProfile.sheenRoughness;
    material.iridescence = visualProfile.iridescence;
    material.iridescenceIOR = visualProfile.iridescenceIOR;
    material.iridescenceThicknessRange[0] = visualProfile.iridescenceMin;
    material.iridescenceThicknessRange[1] = visualProfile.iridescenceMax;
    material.transmission = visualProfile.transmission;
    material.thickness = visualProfile.thickness;
    material.attenuationColor.copy(visualProfile.attenuationColor);
    material.attenuationDistance = visualProfile.attenuationDistance;
    material.emissive.copy(visualProfile.emissive);
    material.emissiveIntensity = visualProfile.emissiveIntensity;
    material.ior = clamp(
      visualProfile.ior + next.ior - DEFAULT_VISUAL_TUNING.ior,
      1,
      2.5,
    );

    const textureRepeat = visualProfile.textureScale * next.textureScale;
    for (const channel of MATERIAL_MAPS) {
      material[channel]?.repeat.set(textureRepeat, textureRepeat);
    }

    const accent = activeAccentMaterial;
    if (accent) {
      syncAccentMaterial(accent, material);
      accent.color.copy(accentBaseColor).multiplyScalar(next.albedo);
    }

    world.applyTuning(next, visualProfile);
    pipeline.setEnvironmentPresentation(
      clamp(visualProfile.environment * next.reflections, 0, 10),
      degToRad(next.environmentYaw),
    );

    setSurfaceGrade({
      saturation: visualProfile.saturation * next.saturation,
      contrast: visualProfile.contrast * next.contrast,
      brightness: visualProfile.surfaceBrightness * next.brightness,
      lift: next.lift,
      gamma: next.gamma,
      vibrance: next.vibrance,
      temperature: next.temperature,
    });
    pipeline.setAmbientOcclusionStrength(clamp01(visualProfile.ao * next.ao));
    pipeline.setBloom(
      Math.max(0, visualProfile.bloom * visualProfile.bloomGain * next.bloom),
      visualProfile.bloomRadius * (next.bloomRadius / DEFAULT_VISUAL_TUNING.bloomRadius),
      visualProfile.bloomThreshold
        * (next.bloomThreshold / DEFAULT_VISUAL_TUNING.bloomThreshold),
    );

    const aoSignature = [
      next.aoRadius,
      next.aoDistanceExponent,
      next.aoThickness,
      next.aoFalloff,
      next.aoScale,
      next.aoDenoiseLuma,
      next.aoDenoiseDepth,
      next.aoDenoiseNormal,
      next.aoDenoiseRadius,
    ].join("|");
    if (aoSignature !== lastAoSignature) {
      pipeline.updateGtao({
        radius: next.aoRadius,
        distanceExponent: next.aoDistanceExponent,
        thickness: next.aoThickness,
        distanceFallOff: next.aoFalloff,
        scale: next.aoScale,
      });
      pipeline.updateDenoise({
        lumaPhi: next.aoDenoiseLuma,
        depthPhi: next.aoDenoiseDepth,
        normalPhi: next.aoDenoiseNormal,
        radius: next.aoDenoiseRadius,
      });
      lastAoSignature = aoSignature;
    }
  };

  const sceneBackgroundColor = new THREE.Color();
  let activeProfile = initialProfile;

  const applySceneVisuals = (
    profile: ResolvedSceneProfile,
    environmentTexture: THREE.Texture,
  ) => {
    const materialBundle = materialLibrary.useScene(profile.id);

    const material = materialBundle.primary;
    const accent = materialBundle.accent;
    world.setMaterials(material, accent);
    applySceneProfile(visualProfile, profile);
    activeVisualMaterial = material;
    activeAccentMaterial = accent;
    if (profile.accentCubeColor !== undefined) {
      accentBaseColor.setHex(profile.accentCubeColor);
    }
    world.setProfile(profile);
    pipeline.setEnvironment(environmentTexture);
    applyVisualTuning(tuning);
    scene.background = profile.id === "stone"
      ? backdropTexture
      : sceneBackgroundColor.setHex(profile.background);
  };

  const applyActiveProfile = (
    profile: ResolvedSceneProfile,
    nextTuning: VisualTuning,
  ) => {
    tuning = nextTuning;
    activeProfile = profile;
    applySceneVisuals(profile, pipeline.refreshEnvironment(profile, tuning));
    host
      .closest<HTMLElement>(".illusion")
      ?.style.setProperty("--scene-background", profile.pageBackground);
  };

  let outgoingLayer: OutgoingRenderLayer | null = null;
  let latestLoopFrame = 0;

  const updateAnimatedLayer = (
    layer: Extract<OutgoingRenderLayer, { kind: "animated" }>,
    loopFrame: number,
    present: boolean,
  ) => {
    applySceneVisuals(layer.profile, layer.environment.texture);
    world.update(loopFrame, tuning, visualProfile);
    if (present) {
      pipeline.render();
      layer.context.drawImage(
        pipeline.canvas,
        0,
        0,
        layer.canvas.width,
        layer.canvas.height,
      );
    }
    applySceneVisuals(activeProfile, pipeline.environmentTexture);
  };

  const createOutgoingLayer = (): OutgoingRenderLayer => {
    pipeline.render();
    const source = pipeline.canvas;
    const previousLayer = outgoingLayer;
    const canvas = document.createElement("canvas");
    canvas.className = "illusion__transition-veil";
    canvas.width = Math.max(1, source.width);
    canvas.height = Math.max(1, source.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (previousLayer?.kind === "animated") {
      updateAnimatedLayer(previousLayer, latestLoopFrame, true);
      world.update(latestLoopFrame, tuning, visualProfile);
    }
    if (previousLayer) {
      context.globalAlpha = previousLayer.opacity;
      context.drawImage(
        previousLayer.canvas,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      context.globalAlpha = 1;
    }
    host.appendChild(canvas);
    const canvasLayer = { canvas, opacity: 1 };
    if (previousLayer) return { kind: "snapshot", ...canvasLayer };
    return {
      kind: "animated",
      ...canvasLayer,
      context,
      profile: activeProfile,
      environment: pipeline.captureEnvironment(),
    };
  };

  const releaseOutgoingLayer = (layer: OutgoingRenderLayer) => {
    if (outgoingLayer === layer) outgoingLayer = null;
    if (layer.kind === "animated") layer.environment.dispose();
    layer.canvas.remove();
    layer.canvas.width = 0;
    layer.canvas.height = 0;
  };

  const renderOutgoing = (
    layer: OutgoingRenderLayer,
    progress: number,
  ) => {
    outgoingLayer = layer;
    layer.opacity = 1 - progress;
    layer.canvas.style.opacity = layer.opacity.toFixed(4);
  };

  controller = createSceneController<OutgoingRenderLayer>({
    initialScene: options.scene,
    initialTuning: tuning,
    adapter: {
      createOutgoingLayer,
      releaseOutgoingLayer,
      applyActive: applyActiveProfile,
      renderOutgoing,
      applyTuning: applyVisualTuning,
      invalidate,
    },
  });

  let cycleOptions: SceneCycleOptions = {
    enabled: false,
    rotations: 1,
    transition: 0.4,
  };
  let cycleWindow: SceneCycleWindow | null = null;
  let cycleTransitionActive = false;

  const finishCycleTransition = () => {
    if (!cycleTransitionActive) return;
    controller.finishTransition();
    cycleTransitionActive = false;
    options.onCycleTransitionProgress?.(1);
  };

  const beginCycleTransition = (animate: boolean) => {
    const activeIndex = SceneRegistry.all.findIndex(
      (preset) => preset.id === activeProfile.id,
    );
    const nextScene = SceneRegistry.all[
      positiveModulo(activeIndex + 1, SceneRegistry.all.length)
    ];
    options.onCycleSceneChange?.(nextScene.id);
    options.onCycleTransitionProgress?.(0);
    controller.setScene(nextScene.id, animate, animate);
    cycleTransitionActive = animate;
  };

  const updateSceneCycle = (timelineFrame: number) => {
    if (!cycleOptions.enabled) return;

    // Catch up if high playback speeds cross multiple scene boundaries in one frame.
    for (let advanced = 0; advanced < 16; advanced += 1) {
      if (!cycleWindow) {
        cycleWindow = nextSceneCycleWindow(
          timelineFrame,
          cycleOptions.rotations,
          cycleOptions.transition,
        );
      } else {
        cycleWindow = sceneCycleWindow(
          cycleWindow.centerIndex,
          cycleOptions.rotations,
          cycleOptions.transition,
        );
      }

      if (!cycleTransitionActive && timelineFrame < cycleWindow.startFrame) return;

      const duration = cycleWindow.endFrame - cycleWindow.startFrame;
      if (!cycleTransitionActive) beginCycleTransition(duration > 0);

      if (duration > 0) {
        const progress = clamp01(
          (timelineFrame - cycleWindow.startFrame) / duration,
        );
        controller.driveTransition(progress);
        options.onCycleTransitionProgress?.(progress);
        if (progress < 1) return;
        cycleTransitionActive = false;
      } else {
        if (cycleTransitionActive) {
          controller.finishTransition();
          cycleTransitionActive = false;
        }
        options.onCycleTransitionProgress?.(1);
      }

      cycleWindow = followingSceneCycleWindow(
        cycleWindow,
        cycleOptions.rotations,
        cycleOptions.transition,
      );
    }
  };

  let disposed = false;
  let readyFrame = 0;
  let assetsSettled = false;
  let finishStartup: (() => void) | null = null;

  materialLibrary.startEagerLoading(options.scene, () => {
    assetsSettled = true;
    finishStartup?.();
  });

  world.recalibrateRear();

  const runtime = createAnimationRuntime({
    host,
    speed: options.speed,
    paused: options.paused,
    isTransitioning: controller.isTransitioning,
    resize: () => {
      pipeline.resize();
      world.recalibrateRear();
    },
    update: ({ now, loopFrame, timelineFrame, lavaPhase, grainTime, present }) => {
      latestLoopFrame = loopFrame;
      setLavaPhase(lavaPhase);
      pipeline.setFilmGrain(
        grainTime,
        tuning.grain * 0.05,
        tuning.aberration * 0.002,
      );
      controller.update(now);
      updateSceneCycle(timelineFrame);
      const outgoing = outgoingLayer;
      if (outgoing?.kind === "animated") {
        updateAnimatedLayer(outgoing, loopFrame, present);
      }
      world.update(loopFrame, tuning, visualProfile);
      if (present) pipeline.render();
    },
    teardown: () => {
      controller.dispose();
      world.dispose();
      materialLibrary.dispose();
      backdropTexture.dispose();
      pipeline.dispose();
    },
  });
  invalidateFrame = runtime.invalidate;

  const WARM_FRAME_BUDGET_MS = 10;
  const warmQueue = sceneProfiles.filter((profile) => profile.id !== activeProfile.id);
  let warmIndex = 0;
  let warmFrame = 0;

  const warmScene = (profile: ResolvedSceneProfile) => {
    try {
      applySceneVisuals(profile, pipeline.environmentTexture);
      world.update(latestLoopFrame, tuning, visualProfile);
      pipeline.warmRender();
    } catch (error) {
      console.error(`Failed to warm the ${profile.id} scene`, error);
    }
  };

  /**
   * Compile every other scene behind the loading curtain, a few per animation frame,
   * so the first visit to one does not stall. Warm renders go to a tiny offscreen
   * buffer; everything they build is independent of the drawing-buffer size.
   */
  const warmRemainingScenes = (done: () => void) => {
    if (warmQueue.length === 0) {
      done();
      return;
    }
    pipeline.beginWarm();
    const step = () => {
      warmFrame = 0;
      if (disposed) {
        pipeline.endWarm();
        return;
      }
      const started = performance.now();
      while (
        warmIndex < warmQueue.length
        && performance.now() - started < WARM_FRAME_BUDGET_MS
      ) {
        warmScene(warmQueue[warmIndex]);
        warmIndex += 1;
      }
      if (warmIndex < warmQueue.length) {
        warmFrame = requestAnimationFrame(step);
        return;
      }
      applySceneVisuals(activeProfile, pipeline.environmentTexture);
      pipeline.endWarm();
      world.update(latestLoopFrame, tuning, visualProfile);
      // Allocate the full-size post-processing targets before revealing the canvas.
      pipeline.render();
      done();
    };
    warmFrame = requestAnimationFrame(step);
  };

  finishStartup = () => {
    if (disposed) return;
    warmRemainingScenes(() => {
      if (disposed) return;
      runtime.enableRendering();
      // Reveal only once a full frame has been presented at the real size.
      readyFrame = requestAnimationFrame(() => {
        readyFrame = requestAnimationFrame(() => {
          readyFrame = 0;
          if (!disposed) options.onReady?.();
        });
      });
    });
  };
  if (assetsSettled) finishStartup();

  return {
    setScene: (nextScene, animateTransition) => {
      finishCycleTransition();
      cycleWindow = null;
      controller.setScene(nextScene, animateTransition);
    },
    setTuning: controller.setTuning,
    setSpeed: runtime.setSpeed,
    setPaused: runtime.setPaused,
    setCycle: (nextCycle) => {
      const wasEnabled = cycleOptions.enabled;
      const cadenceChanged = cycleOptions.rotations !== nextCycle.rotations;
      cycleOptions = {
        ...nextCycle,
        transition: clamp01(nextCycle.transition),
      };
      if (!cycleOptions.enabled) {
        finishCycleTransition();
        cycleWindow = null;
      } else if (!wasEnabled || (cadenceChanged && !cycleTransitionActive)) {
        cycleWindow = null;
      }
      invalidate();
    },
    soundtrack: runtime.soundtrack,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(readyFrame);
      cancelAnimationFrame(warmFrame);
      runtime.dispose();
    },
  };
}
