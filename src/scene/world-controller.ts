import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MeshPhysicalNodeMaterial } from "three/webgpu";

import { DEFAULT_VISUAL_TUNING, type VisualTuning } from "../tuning/schema";
import {
  clamp,
  clamp01,
  degToRad,
  lerp,
  positiveModulo,
  sineEase,
} from "../util/math";
import { cavityUniforms } from "./cavity-wall-light-node";
import {
  cameraEndpointInto,
  composeWorldMatrixInto,
  createCameraStage,
  createPose,
  getLevelMatrix,
  mainCubeHasEntered,
  sampleCameraStageInto,
  sampleMainPoseInto,
  settledPoseInto,
} from "./choreography";
import {
  CAVITY_CENTER,
  CAVITY_STOP_DEPTH,
  CAVITY_STOP_RADIUS,
  INV_PHI,
  LOOP_FRAMES,
  MAX_LEVEL,
  MIN_LEVEL,
  REAR_TURN_RATIO,
  REAR_TURNS,
  ROLL_IN_FRAMES,
  SHADOW_MAP_SIZE,
  SHADOW_SOFTNESS_REFERENCE_SIZE,
  UP,
  VOID_BACKSTOP_DEPTH,
} from "./constants";
import type { RenderPipeline } from "./render-pipeline";
import type { ResolvedSceneProfile } from "./scenes";
import { createSceneAtmosphereNode } from "./scene-atmosphere-node";
import type { VisualProfile } from "./visual-profile";

export function createWorldController({
  pipeline,
  initialMaterial,
  cameraBasePosition,
  cameraOrientation,
}: {
  pipeline: RenderPipeline;
  initialMaterial: MeshPhysicalNodeMaterial;
  cameraBasePosition: THREE.Vector3;
  cameraOrientation: THREE.Quaternion;
}) {
  const { camera, scene } = pipeline;
  cavityUniforms.worldCenter.value.copy(CAVITY_CENTER);
  let disposed = false;
  let activeVisualMaterial = initialMaterial;
  let activeAccentMaterial: MeshPhysicalNodeMaterial | null = null;

  const blockGeometry = new RoundedBoxGeometry(1, 1, 1, 9, 0.03);
  const blocks: Array<{ level: number; mesh: THREE.Mesh }> = [];
  for (let level = MIN_LEVEL; level <= MAX_LEVEL; level += 1) {
    const mesh = new THREE.Mesh(blockGeometry, initialMaterial);
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    blocks.push({ level, mesh });
  }

  const voidGeometry = new THREE.PlaneGeometry(80, 80);
  const cavityStopGeometry = new THREE.CircleGeometry(CAVITY_STOP_RADIUS, 96);
  const cavityStopMaterial = new MeshPhysicalNodeMaterial({
    color: 0x000000,
    emissive: 0x1264ff,
    transmission: 0.001,
    fog: false,
  });
  const createCavity = () => {
    const voidMaterial = new THREE.MeshBasicMaterial({
      color: 0x000001,
      side: THREE.DoubleSide,
      toneMapped: false,
      blending: THREE.NoBlending,
    });
    const root = new THREE.Group();
    root.matrixAutoUpdate = false;
    scene.add(root);

    const voidPlane = new THREE.Mesh(voidGeometry, voidMaterial);
    voidPlane.rotation.x = -Math.PI / 2;
    voidPlane.position.y = -VOID_BACKSTOP_DEPTH;
    voidPlane.renderOrder = -10;
    voidPlane.frustumCulled = false;
    root.add(voidPlane);
    return { root, voidMaterial };
  };
  const cavitySets = [createCavity(), createCavity()] as const;

  const cavityStopRoot = new THREE.Group();
  cavityStopRoot.matrixAutoUpdate = false;
  const cavityStopPanel = new THREE.Mesh(cavityStopGeometry, cavityStopMaterial);
  cavityStopPanel.rotation.x = -Math.PI / 2;
  cavityStopPanel.position.set(0, -CAVITY_STOP_DEPTH, 0);
  cavityStopPanel.frustumCulled = false;
  cavityStopPanel.renderOrder = -9;
  cavityStopRoot.add(cavityStopPanel);
  scene.add(cavityStopRoot);

  const cavityLight = new THREE.SpotLight();
  scene.add(cavityLight, cavityLight.target);

  const hemisphereLight = new THREE.HemisphereLight();
  const ambientLight = new THREE.AmbientLight();
  scene.add(hemisphereLight, ambientLight);

  const keyLight = new THREE.DirectionalLight();
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  scene.add(keyLight, keyLight.target);

  // Separate mapped and flat materials keep both rear-cube shader variants cached.
  const rearDetailMaterial = new MeshPhysicalNodeMaterial();
  const rearFlatMaterial = new MeshPhysicalNodeMaterial();
  const rearTextureLoader = new THREE.TextureLoader();
  const rearTextureCache = new Map<string, THREE.Texture>();
  let rearTextureOverride: THREE.Texture | null = null;
  let rearDetailMaps = false;
  let rearUsesSceneMaterial = false;
  const setRearTexture = (url: string | undefined) => {
    if (!url) {
      rearTextureOverride = null;
      return;
    }
    let texture = rearTextureCache.get(url);
    if (!texture) {
      texture = rearTextureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      rearTextureCache.set(url, texture);
    }
    rearTextureOverride = texture;
  };
  const rearCube = new THREE.Mesh(blockGeometry, rearDetailMaterial);
  rearCube.matrixAutoUpdate = false;
  rearCube.castShadow = true;
  rearCube.receiveShadow = true;
  scene.add(rearCube);

  const sceneAtmosphere = createSceneAtmosphereNode(scene, CAVITY_CENTER);
  const accentLights = [
    new THREE.PointLight(),
    new THREE.PointLight(),
  ] as const;
  scene.add(...accentLights);

  const fixedPoint = new THREE.Vector3(
    0.5 / (1 + INV_PHI * INV_PHI),
    0,
    (0.5 * INV_PHI) / (1 + INV_PHI * INV_PHI),
  );
  const rearStart = new THREE.Vector3(-1.6, 0, 7.4);
  const rearDirection = new THREE.Vector3(1, 0, 0);
  const rearAxis = new THREE.Vector3(0, 0, -1);
  const rearHeading = new THREE.Quaternion();
  let rearBaseEdge = 0.8;

  const stageStart = new THREE.Vector3();
  const stageEnd = new THREE.Vector3();
  const frameStage = createCameraStage();
  const setCameraAtFrame = (frame: number) => {
    const stage = sampleCameraStageInto(frameStage, frame);
    cameraEndpointInto(stageStart, stage.base, cameraBasePosition);
    cameraEndpointInto(stageEnd, stage.base + 1, cameraBasePosition);
    camera.position.lerpVectors(stageStart, stageEnd, stage.progress);
    camera.quaternion.copy(cameraOrientation);
    camera.updateMatrixWorld(true);
    return stage;
  };

  const rearCalibrationCamera = new THREE.PerspectiveCamera();
  const rearCalibrationStage = createCameraStage();
  const rearRaycaster = new THREE.Raycaster();
  const rearNdc = new THREE.Vector2(-0.219, 0.425);
  const rearRoute = new THREE.Vector3();

  const recalibrateRear = () => {
    const stage = sampleCameraStageInto(rearCalibrationStage, 0);
    cameraEndpointInto(stageStart, stage.base, cameraBasePosition);
    cameraEndpointInto(stageEnd, stage.base + 1, cameraBasePosition);
    rearCalibrationCamera.position.lerpVectors(stageStart, stageEnd, stage.progress);
    rearCalibrationCamera.quaternion.copy(cameraOrientation);
    rearCalibrationCamera.fov = camera.fov;
    rearCalibrationCamera.aspect = camera.aspect;
    rearCalibrationCamera.near = camera.near;
    rearCalibrationCamera.far = camera.far;
    rearCalibrationCamera.updateProjectionMatrix();
    rearCalibrationCamera.updateMatrixWorld(true);

    rearRaycaster.setFromCamera(rearNdc, rearCalibrationCamera);
    const distance = -rearRaycaster.ray.origin.y / rearRaycaster.ray.direction.y;
    if (Number.isFinite(distance) && distance > 0) {
      rearRaycaster.ray.at(distance, rearStart);
      rearStart.y = 0;
    }
    rearRoute.copy(fixedPoint).sub(rearStart);
    const routeLength = rearRoute.length();
    rearDirection.copy(rearRoute).normalize();
    rearAxis.crossVectors(UP, rearDirection).normalize();
    rearHeading.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rearDirection);
    rearBaseEdge = (1 - REAR_TURN_RATIO) * routeLength;
  };

  const rearTurnStart = new THREE.Vector3();
  const rearTurnEnd = new THREE.Vector3();
  const rearPosition = new THREE.Vector3();
  const rearOrientation = new THREE.Quaternion();
  const rearScale = new THREE.Vector3();
  const updateRear = (frame: number) => {
    const turns = (frame * REAR_TURNS) / LOOP_FRAMES;
    const turnIndex = Math.min(REAR_TURNS - 1, Math.floor(turns));
    const turnFraction = turns - turnIndex;
    const rollFraction = sineEase(clamp01(turnFraction / 0.76));
    const angle = rollFraction * (Math.PI / 2);
    const startScale = REAR_TURN_RATIO ** turnIndex;
    const endScale = startScale * REAR_TURN_RATIO;

    rearTurnStart.copy(rearStart).sub(fixedPoint).multiplyScalar(startScale).add(fixedPoint);
    rearTurnEnd.copy(rearStart).sub(fixedPoint).multiplyScalar(endScale).add(fixedPoint);
    const travel = 0.5 * (1 + Math.sin(angle) - Math.cos(angle));
    const edge = lerp(rearBaseEdge * startScale, rearBaseEdge * endScale, travel);
    rearPosition.lerpVectors(rearTurnStart, rearTurnEnd, travel);
    rearPosition.y = 0.5 * edge * (Math.sin(angle) + Math.cos(angle));
    rearOrientation
      .setFromAxisAngle(rearAxis, turnIndex * (Math.PI / 2) + angle)
      .multiply(rearHeading);
    rearCube.matrix.compose(rearPosition, rearOrientation, rearScale.setScalar(edge));
    rearCube.matrixWorldNeedsUpdate = true;
  };

  const localCavityLightPosition = new THREE.Vector3(CAVITY_CENTER.x, -1.75, CAVITY_CENTER.z);
  const localCavityLightTarget = new THREE.Vector3(CAVITY_CENTER.x, -0.08, CAVITY_CENTER.z);
  const lightCenter = new THREE.Vector3();
  const keyLightOffset = new THREE.Vector3();
  const stopPosition = new THREE.Vector3();
  const stopOrientation = new THREE.Quaternion();
  const stopScale = new THREE.Vector3();
  const blockPose = createPose();
  const blockMatrix = new THREE.Matrix4();

  const stepRotation = new THREE.Quaternion();
  const stepTranslation = new THREE.Vector3();
  const stepScaleVector = new THREE.Vector3();
  const stepFixedScratch = new THREE.Vector3();
  const stepMatrixInterpolated = new THREE.Matrix4();
  const cellMatrix = new THREE.Matrix4();
  const lightCellMatrix = new THREE.Matrix4();
  const composeCellMatrix = (
    out: THREE.Matrix4,
    baseLevelMatrix: THREE.Matrix4,
    progress: number,
  ) => {
    const stepScale = INV_PHI ** progress;
    stepRotation.setFromAxisAngle(UP, -(Math.PI / 2) * progress);
    stepFixedScratch
      .copy(fixedPoint)
      .applyQuaternion(stepRotation)
      .multiplyScalar(stepScale);
    stepTranslation.copy(fixedPoint).sub(stepFixedScratch);
    stepMatrixInterpolated.compose(
      stepTranslation,
      stepRotation,
      stepScaleVector.setScalar(stepScale),
    );
    out.multiplyMatrices(baseLevelMatrix, stepMatrixInterpolated);
    return stepScale;
  };

  const update = (frame: number, tuning: VisualTuning, visualProfile: VisualProfile) => {
    const stage = setCameraAtFrame(frame);
    const baseMatrix = getLevelMatrix(stage.base);
    const childMatrix = getLevelMatrix(stage.base + 1);
    const levelScale = INV_PHI ** stage.base;

    // Finish the cavity transfer before the drop so its lighting remains stable.
    const cavityTransfer = sineEase(stage.elapsed / ROLL_IN_FRAMES) - tuning.cavityLift;

    const cellScale =
      levelScale * composeCellMatrix(cellMatrix, baseMatrix, cavityTransfer);
    stopPosition.copy(CAVITY_CENTER).applyMatrix4(cellMatrix);
    stopScale.setScalar(cellScale);
    cavityStopRoot.matrix.compose(stopPosition, stopOrientation, stopScale);
    cavityStopRoot.matrixWorldNeedsUpdate = true;

    const parentCavity = cavitySets[0];
    parentCavity.root.matrix.copy(baseMatrix);
    parentCavity.root.matrixWorldNeedsUpdate = true;
    const childCavity = cavitySets[1];
    childCavity.root.matrix.copy(childMatrix);
    childCavity.root.matrixWorldNeedsUpdate = true;

    cavityUniforms.worldCenter.value.copy(CAVITY_CENTER).applyMatrix4(cellMatrix);
    cavityUniforms.scale.value = cellScale;

    for (const { level, mesh } of blocks) {
      const inVisibleBand = level >= stage.base - 12 && level <= stage.base + 1;
      const hasEntered = level <= stage.base || mainCubeHasEntered(frame, level);
      const cubeVisible = inVisibleBand && hasEntered;
      mesh.visible = cubeVisible;
      if (!cubeVisible) continue;
      if (level < stage.base) settledPoseInto(blockPose);
      else sampleMainPoseInto(blockPose, frame, level);
      composeWorldMatrixInto(blockMatrix, level, blockPose);
      if (activeAccentMaterial) {
        mesh.material = level === stage.base ? activeAccentMaterial : activeVisualMaterial;
      }
      mesh.matrix.copy(blockMatrix);
      mesh.matrixWorldNeedsUpdate = true;
    }

    const cavityDepth =
      visualProfile.cavityDepth
      * (tuning.cavityDepth / DEFAULT_VISUAL_TUNING.cavityDepth);
    const cavityReach =
      visualProfile.cavityReach
      * (tuning.cavityReach / DEFAULT_VISUAL_TUNING.cavityReach);
    localCavityLightPosition.y = -cavityDepth;
    cavityLight.position.copy(localCavityLightPosition).applyMatrix4(cellMatrix);
    cavityLight.target.position.copy(localCavityLightTarget).applyMatrix4(cellMatrix);
    cavityLight.distance = 3 * cavityUniforms.scale.value * cavityReach;
    const effectiveCavityLight =
      tuning.cavityLight * visualProfile.cavityLightGain;
    cavityLight.intensity =
      26.5
      * visualProfile.cavityLightStrength
      * effectiveCavityLight
      * visualProfile.cavitySpotLight
      * cavityUniforms.scale.value
      * cavityUniforms.scale.value;
    cavityLight.target.updateMatrixWorld();

    const lightScale =
      levelScale * composeCellMatrix(lightCellMatrix, baseMatrix, stage.progress);
    lightCenter.set(0, 0, 0).applyMatrix4(lightCellMatrix);
    keyLightOffset.set(tuning.keyX, tuning.keyY, tuning.keyZ);
    keyLight.position.copy(lightCenter).addScaledVector(keyLightOffset, lightScale);
    keyLight.target.position
      .copy(lightCenter)
      .addScaledVector(UP, tuning.keyTargetY * lightScale);

    const shadowCamera = keyLight.shadow.camera as THREE.OrthographicCamera;
    const shadowExtent = 4.05 * lightScale * tuning.shadowFrustum;
    shadowCamera.left = -shadowExtent;
    shadowCamera.right = shadowExtent;
    shadowCamera.top = shadowExtent;
    shadowCamera.bottom = -shadowExtent;
    shadowCamera.near = 0.08 * lightScale * tuning.shadowNear;
    shadowCamera.far = Math.max(
      shadowCamera.near + 0.01,
      18 * lightScale * tuning.shadowFar,
    );
    shadowCamera.updateProjectionMatrix();
    keyLight.shadow.normalBias = 0.0035 * lightScale * tuning.shadowNormalBias;
    keyLight.target.updateMatrixWorld();

    pipeline.setCameraClip(0.012 * lightScale, 900 * lightScale);
    pipeline.updateGtao({ thickness: tuning.aoThickness * lightScale });
    pipeline.updateDenoise({ depthPhi: tuning.aoDenoiseDepth * lightScale });
    const focusDistance = camera.position.distanceTo(lightCenter);
    pipeline.setDepthOfField(
      Math.max(0.001, focusDistance + tuning.dofFocus * lightScale),
      (tuning.dofAperture * 0.022) / Math.max(0.05, lightScale),
      tuning.dofBlur * 0.006,
    );

    updateRear(frame);

    const loopPhase = positiveModulo(frame, LOOP_FRAMES) / LOOP_FRAMES;
    const orbit = loopPhase * Math.PI * 2;
    const accentRadius = (1.55 + 0.42 * visualProfile.accentMotion) * lightScale;
    const accentHeight = (0.64 + 0.18 * visualProfile.accentMotion) * lightScale;
    accentLights[0].position.set(
      lightCenter.x + Math.cos(orbit) * accentRadius,
      lightCenter.y + accentHeight + Math.sin(orbit * 2) * 0.15 * lightScale,
      lightCenter.z + Math.sin(orbit) * accentRadius * 0.72,
    );
    accentLights[1].position.set(
      lightCenter.x + Math.sin(orbit + 2.1) * accentRadius * 0.86,
      lightCenter.y + accentHeight * 0.68 + Math.cos(orbit) * 0.12 * lightScale,
      lightCenter.z + Math.sin(orbit * 2 + 2.1) * accentRadius * 0.52,
    );
    accentLights[0].color.copy(visualProfile.accentColor);
    accentLights[1].color.copy(visualProfile.accentSecondary);
    const accentPulse = 0.9 + 0.1 * Math.sin(orbit * 4);
    accentLights[0].intensity =
      visualProfile.accentIntensity * 2.8 * lightScale * lightScale * accentPulse;
    accentLights[1].intensity =
      visualProfile.accentIntensity * 2.2 * lightScale * lightScale * (2 - accentPulse);
    accentLights[0].distance = 4.8 * lightScale;
    accentLights[1].distance = 4.2 * lightScale;

    sceneAtmosphere.update({
      phase: loopPhase,
      baseLevel: stage.base,
      depthScale: levelScale * (1 - stage.progress * (1 - INV_PHI)),
      parentMatrix: baseMatrix,
      childMatrix,
      parentWeight: 1 - THREE.MathUtils.smoothstep(stage.progress, 0.6, 0.97),
      childWeight: THREE.MathUtils.smoothstep(stage.progress, 0.05, 0.35),
    });
  };

  const colorHsl = { h: 0, s: 0, l: 0 };
  const tuneColor = (
    target: THREE.Color,
    source: THREE.Color,
    hueDegrees: number,
    chroma: number,
  ) => {
    if (hueDegrees === 0 && chroma === 1) return target.copy(source);
    source.getHSL(colorHsl);
    return target.setHSL(
      positiveModulo(colorHsl.h + hueDegrees / 360, 1),
      clamp01(colorHsl.s * chroma),
      colorHsl.l,
    );
  };

  const applyTuning = (tuning: VisualTuning, visualProfile: VisualProfile) => {
    keyLight.intensity =
      Math.min(1.1, visualProfile.key) * visualProfile.keyGain * tuning.key;
    hemisphereLight.intensity =
      visualProfile.hemisphere
      * visualProfile.fillGain
      * visualProfile.hemisphereGain
      * tuning.fill
      * tuning.hemisphere;
    ambientLight.intensity =
      visualProfile.ambient * visualProfile.fillGain * tuning.fill * tuning.ambient;
    tuneColor(keyLight.color, visualProfile.keyColor, tuning.keyHue, tuning.keyChroma);
    tuneColor(
      hemisphereLight.color,
      visualProfile.hemisphereSkyColor,
      tuning.skyHue,
      tuning.skyChroma,
    );
    tuneColor(
      hemisphereLight.groundColor,
      visualProfile.hemisphereGroundColor,
      tuning.groundHue,
      tuning.groundChroma,
    );
    tuneColor(
      ambientLight.color,
      visualProfile.ambientColor,
      tuning.ambientHue,
      tuning.ambientChroma,
    );

    const useDetailMaps = rearTextureOverride === null || rearDetailMaps;
    const rearMaterial = useDetailMaps ? rearDetailMaterial : rearFlatMaterial;
    if (!rearUsesSceneMaterial) rearCube.material = rearMaterial;
    rearMaterial.color
      .copy(visualProfile.rearColor)
      .lerp(visualProfile.materialColor, 0.42)
      .multiplyScalar(tuning.rearBrightness);
    const nextMap = rearTextureOverride ?? activeVisualMaterial.map;
    const nextNormal = useDetailMaps ? activeVisualMaterial.normalMap : null;
    const nextRoughness = useDetailMaps ? activeVisualMaterial.roughnessMap : null;
    const nextAo = useDetailMaps ? activeVisualMaterial.aoMap : null;
    if (
      rearMaterial.map !== nextMap
      || rearMaterial.normalMap !== nextNormal
      || rearMaterial.roughnessMap !== nextRoughness
      || rearMaterial.aoMap !== nextAo
    ) {
      rearMaterial.map = nextMap;
      rearMaterial.normalMap = nextNormal;
      rearMaterial.roughnessMap = nextRoughness;
      rearMaterial.aoMap = nextAo;
      rearMaterial.needsUpdate = true;
    }
    if (rearMaterial.aoMap) rearMaterial.aoMap.channel = 0;
    rearMaterial.normalScale.setScalar(visualProfile.normalStrength * tuning.bump * 0.8);
    rearMaterial.roughness = clamp(0.72 + tuning.rearRoughnessOffset, 0, 1);
    rearMaterial.specularIntensity = clamp(0.46 * tuning.rearSpecular, 0, 5);
    rearMaterial.clearcoat = visualProfile.rearClearcoat;
    rearMaterial.clearcoatRoughness = visualProfile.rearClearcoatRoughness;
    tuneColor(
      rearMaterial.emissive,
      visualProfile.cavityLightColor,
      tuning.cavityHue,
      tuning.cavityChroma,
    ).multiplyScalar(visualProfile.rearGlow);

    for (const { voidMaterial } of cavitySets) {
      tuneColor(
        voidMaterial.color,
        visualProfile.cavityColor,
        tuning.cavityHue,
        tuning.cavityChroma,
      ).multiplyScalar(visualProfile.cavityVoidGlow * tuning.voidLevel);
    }
    const effectiveCavityLight =
      tuning.cavityLight * visualProfile.cavityLightGain;
    const cavityStopGain =
      3.1
      * Math.sqrt(Math.max(0, visualProfile.cavityLightStrength))
      * effectiveCavityLight;
    tuneColor(
      cavityStopMaterial.emissive,
      visualProfile.cavityLightColor,
      tuning.cavityHue,
      tuning.cavityChroma,
    ).multiplyScalar(cavityStopGain);
    tuneColor(
      cavityUniforms.color.value,
      visualProfile.cavityLightColor,
      tuning.cavityHue,
      tuning.cavityChroma,
    );
    cavityUniforms.strength.value =
      visualProfile.cavityWallGlow * effectiveCavityLight;
    cavityUniforms.aboveBounce.value = visualProfile.cavityAboveBounce;
    tuneColor(
      cavityLight.color,
      visualProfile.cavityLightColor,
      tuning.cavityHue,
      tuning.cavityChroma,
    );
    cavityLight.angle = degToRad(
      visualProfile.cavityAngle
      + tuning.cavityAngle
      - DEFAULT_VISUAL_TUNING.cavityAngle,
    );
    cavityLight.penumbra = tuning.cavityPenumbra;
    cavityLight.decay = tuning.cavityDecay;

    keyLight.shadow.intensity = visualProfile.shadowStrength * tuning.shadowStrength;
    keyLight.shadow.radius =
      tuning.shadowSoftness * (SHADOW_MAP_SIZE / SHADOW_SOFTNESS_REFERENCE_SIZE);
    keyLight.shadow.bias = tuning.shadowBias;
  };

  return {
    setMaterials: (
      primary: MeshPhysicalNodeMaterial,
      accent: MeshPhysicalNodeMaterial | null,
    ) => {
      activeVisualMaterial = primary;
      activeAccentMaterial = accent;
      for (const { mesh } of blocks) mesh.material = primary;
    },
    setProfile: (profile: ResolvedSceneProfile) => {
      sceneAtmosphere.setProfile(profile);
      setRearTexture(profile.rearTexture);
      rearDetailMaps = profile.rearDetailMaps;
      rearUsesSceneMaterial = profile.id === "lava";
      if (rearUsesSceneMaterial) rearCube.material = activeVisualMaterial;
    },
    applyTuning,
    recalibrateRear,
    update,
    dispose: () => {
      if (disposed) return;
      disposed = true;

      for (const light of accentLights) {
        scene.remove(light);
        light.dispose();
      }
      sceneAtmosphere.dispose();
      scene.remove(rearCube);
      rearDetailMaterial.dispose();
      rearFlatMaterial.dispose();
      for (const texture of rearTextureCache.values()) texture.dispose();
      rearTextureCache.clear();

      scene.remove(keyLight, keyLight.target);
      keyLight.dispose();
      scene.remove(ambientLight, hemisphereLight);
      ambientLight.dispose();
      hemisphereLight.dispose();
      scene.remove(cavityLight, cavityLight.target);
      cavityLight.dispose();

      scene.remove(cavityStopRoot);
      for (const cavity of cavitySets) {
        scene.remove(cavity.root);
        cavity.voidMaterial.dispose();
      }
      cavityStopMaterial.dispose();
      cavityStopGeometry.dispose();
      voidGeometry.dispose();

      for (const { mesh } of blocks) scene.remove(mesh);
      blockGeometry.dispose();
    },
  };
}
