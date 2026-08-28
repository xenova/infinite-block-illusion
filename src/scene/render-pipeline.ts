import * as THREE from "three";
import { BlendMode, RenderPipeline as NodeRenderPipeline, WebGPURenderer } from "three/webgpu";
import type { Node } from "three/webgpu";
import {
  float,
  mix,
  mrt,
  normalView,
  output,
  pass,
  pmremTexture,
  renderOutput,
  uniform,
  vec4,
} from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { denoise } from "three/addons/tsl/display/DenoiseNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";

import type { VisualTuning } from "../tuning/schema";
import { degToRad, radToDeg } from "../util/math";
import { CAMERA_FOV, REFERENCE_ASPECT } from "./constants";
import { bokehNode, bokehUniforms } from "./depth-of-field-node";
import { filmGrainNode, filmGrainUniforms } from "./film-grain-node";
import { createSceneEnvironmentNode } from "./reflection-environment-node";
import type { ResolvedSceneProfile } from "./scenes";

export type RendererBackend = "webgpu" | "webgl";

// The display add-ons are nodes at runtime but their public types do not say so.
const asNode = <T extends string>(value: unknown) => value as Node<T>;

type GtaoParameters = {
  radius?: number;
  distanceExponent?: number;
  thickness?: number;
  distanceFallOff?: number;
  scale?: number;
};

type DenoiseParameters = {
  lumaPhi?: number;
  depthPhi?: number;
  normalPhi?: number;
  radius?: number;
};

export async function createRenderPipeline(
  host: HTMLElement,
  tuning: VisualTuning,
  backend: RendererBackend,
) {
  let renderer: WebGPURenderer;
  try {
    renderer = new WebGPURenderer({
      forceWebGL: backend === "webgl",
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    await renderer.init();
  } catch (error) {
    console.error("Renderer initialisation failed", error);
    return null;
  }

  // Preserve precision across the scene's extreme recursive scales.
  renderer.highPrecision = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, REFERENCE_ASPECT, 0.012, 900);

  const SCREEN_SPACE_RADIUS_SCALE = 100;
  const aoPixelWorldSize = uniform(1);
  let viewportAspect = REFERENCE_ASPECT;
  let designFov = tuning.cameraFov;

  const updateProjection = () => {
    camera.aspect = viewportAspect;
    if (viewportAspect >= REFERENCE_ASPECT) {
      camera.fov = designFov;
    } else {
      const referenceHalfWidth = Math.tan(degToRad(designFov) / 2) * REFERENCE_ASPECT;
      camera.fov = radToDeg(2 * Math.atan(referenceHalfWidth / viewportAspect));
    }
    camera.updateProjectionMatrix();
    refreshAoPixelScale();
  };

  const refreshBokehAspect = () => {
    const { width, height } = renderer.domElement;
    bokehUniforms.aspect.value = height > 0 ? width / height : 1;
  };

  const refreshAoPixelScale = () => {
    const height = renderer.domElement.height || 1;
    aoPixelWorldSize.value =
      (2 * Math.tan(degToRad(camera.fov) / 2) * SCREEN_SPACE_RADIUS_SCALE) / height;
  };
  updateProjection();

  const applyPixelRatio = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  };

  const WARM_SIZE = 64;

  const resizeToHost = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    applyPixelRatio();
    renderer.setSize(width, height, false);
    viewportAspect = width / height;
    updateProjection();
    refreshBokehAspect();
  };
  applyPixelRatio();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = tuning.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const sunDirection = new THREE.Vector3();
  const sceneEnvironment = createSceneEnvironmentNode(renderer);
  const environmentZenith = new THREE.Color();
  const environmentHorizon = new THREE.Color();
  const environmentGround = new THREE.Color();
  const environmentSun = new THREE.Color();

  // Keep one PMREM node identity while scene transitions swap its texture.
  let environmentNode: ReturnType<typeof pmremTexture> | null = null;

  // Crossfades render twice per animation tick, so each render needs a fresh node frame.
  const nodeFrame = (renderer as unknown as {
    _nodes?: { nodeFrame?: { frameId: number } };
  })._nodes?.nodeFrame;
  if (!nodeFrame) {
    console.error("Node frame counter unavailable; scene transitions will not animate");
  }

  const scenePass = pass(scene, camera);
  // Zero-alpha material blending excludes additive particles from the normal MRT.
  scenePass.setMRT(
    mrt({ output, normal: vec4(normalView, 0) })
      .setBlendMode("normal", new BlendMode(THREE.MaterialBlending)),
  );

  const sceneColor = scenePass.getTextureNode("output");
  const sceneDepth = scenePass.getTextureNode("depth");
  const sceneNormal = scenePass.getTextureNode("normal");
  const sceneViewZ = scenePass.getViewZNode("depth");

  const aoPass = ao(sceneDepth, sceneNormal, camera);
  const aoDenoised = denoise(aoPass.getTextureNode(), sceneDepth, sceneNormal, camera);
  const aoBlend = uniform(0.76);

  const aoRadius = uniform(0.17);
  const aoFalloff = uniform(0.78);
  // Convert the authored screen-space AO radius into view-space units per pixel,
  // which is what GTAOPass's SCREEN_SPACE_RADIUS mode does to `radius`.
  const aoDepthScale = sceneViewZ.negate().mul(aoPixelWorldSize);
  // GTAONode types this as a plain uniform, but accepts any float node.
  const asAoScalar = (node: Node<"float">) => node as unknown as typeof aoPass.radius;
  aoPass.radius = asAoScalar(aoRadius.mul(aoDepthScale));
  // `distanceFallOff` weights each ray-march step as mix(1, 2/(j+2), fallOff), so it
  // is a unitless blend factor and must stay in 0..1 — the depth scale belongs only
  // on `radius`. Scaling it pushed it far above 1 on the distant recursion levels,
  // where the extrapolated weight goes negative and clamps whole march steps away.
  aoPass.distanceFallOff = aoFalloff;

  const bloomPass = bloom(sceneColor, 0.1, 0.14, 1.85);

  const renderPipeline = new NodeRenderPipeline(renderer);
  // Film grain runs after tone mapping and output color conversion.
  renderPipeline.outputColorTransform = false;

  const live = { ao: true, bloom: true, dof: false, grain: true };

  const buildOutputNode = () => {
    let node: Node<"vec4"> = sceneColor;
    if (live.bloom) {
      node = node.add(asNode<"vec4">(bloomPass));
    }
    if (live.ao) {
      // GTAO uses a RedFormat target; only its red channel is the occlusion value.
      const occlusion = asNode<"vec4">(aoDenoised).r;
      node = node.mul(mix(float(1), occlusion, aoBlend));
    }
    if (live.dof) {
      node = bokehNode(node, sceneViewZ);
    }
    node = asNode<"vec4">(smaa(node));
    node = asNode<"vec4">(
      renderOutput(node, renderer.toneMapping, renderer.outputColorSpace),
    );
    if (live.grain) {
      node = filmGrainNode(node);
    }
    return node;
  };

  const outputShapes = new Map<string, Node<"vec4">>();

  const rebuildOutputNode = () => {
    const shape = `${live.bloom}|${live.ao}|${live.dof}|${live.grain}`;
    let node = outputShapes.get(shape);
    if (node === undefined) {
      node = buildOutputNode();
      outputShapes.set(shape, node);
    }
    renderPipeline.outputNode = node;
    renderPipeline.needsUpdate = true;
  };

  // Scene-driven passes stay compiled once enabled; rebuilding the graph is costly.
  const STICKY_EFFECTS: Record<keyof typeof live, boolean> = {
    ao: true,
    bloom: true,
    dof: false,
    grain: false,
  };

  const setLive = (key: keyof typeof live, value: boolean) => {
    const next = STICKY_EFFECTS[key] ? live[key] || value : value;
    if (live[key] === next) return;
    live[key] = next;
    rebuildOutputNode();
  };

  rebuildOutputNode();
  refreshBokehAspect();

  let warmTarget: THREE.RenderTarget | null = null;
  let disposed = false;

  return {
    scene,
    camera,
    backend,
    canvas: renderer.domElement,
    maxAnisotropy: Math.min(12, renderer.getMaxAnisotropy()),
    setDesignFov: (fov: number) => {
      designFov = fov;
      updateProjection();
    },
    setExposure: (exposure: number) => {
      renderer.toneMappingExposure = exposure;
    },
    setEnvironmentPresentation: (intensity: number, yaw: number) => {
      scene.environmentIntensity = intensity;
      scene.environmentRotation.y = yaw;
    },
    setEnvironment: (map: THREE.Texture) => {
      if (environmentNode === null) {
        environmentNode = pmremTexture(map);
        scene.environmentNode = environmentNode;
      } else {
        environmentNode.value = map;
      }
    },
    refreshEnvironment: (profile: ResolvedSceneProfile, nextTuning: VisualTuning) => {
      sunDirection
        .set(nextTuning.keyX, nextTuning.keyY, nextTuning.keyZ)
        .normalize();
      return sceneEnvironment.update({
        zenith: environmentZenith.setHex(profile.skyColor),
        horizon: environmentHorizon
          .setHex(profile.skyColor)
          .lerp(environmentSun.setHex(profile.keyColor), 0.45),
        ground: environmentGround.setHex(profile.groundColor),
        sun: environmentSun,
        sunDirection,
        sunIntensity:
          profile.environmentSunIntensity ?? 1 + profile.keyIntensity * 0.92,
        skyIntensity:
          profile.environmentSkyIntensity ?? 0.22 + profile.hemisphereIntensity * 0.58,
        sunSize: profile.environmentSunSize,
      });
    },
    captureEnvironment: () => sceneEnvironment.capture(),
    get environmentTexture() {
      return sceneEnvironment.texture;
    },
    setAmbientOcclusionStrength: (strength: number) => {
      aoBlend.value = strength;
      setLive("ao", strength > 0);
    },
    updateGtao: (parameters: GtaoParameters) => {
      if (parameters.radius !== undefined) aoRadius.value = parameters.radius;
      if (parameters.thickness !== undefined) aoPass.thickness.value = parameters.thickness;
      if (parameters.distanceExponent !== undefined) {
        aoPass.distanceExponent.value = parameters.distanceExponent;
      }
      if (parameters.distanceFallOff !== undefined) {
        aoFalloff.value = parameters.distanceFallOff;
      }
      if (parameters.scale !== undefined) aoPass.scale.value = parameters.scale;
    },
    updateDenoise: (parameters: DenoiseParameters) => {
      if (parameters.lumaPhi !== undefined) aoDenoised.lumaPhi.value = parameters.lumaPhi;
      if (parameters.depthPhi !== undefined) aoDenoised.depthPhi.value = parameters.depthPhi;
      if (parameters.normalPhi !== undefined) aoDenoised.normalPhi.value = parameters.normalPhi;
      if (parameters.radius !== undefined) aoDenoised.radius.value = parameters.radius;
    },
    setBloom: (strength: number, radius: number, threshold: number) => {
      bloomPass.strength.value = strength;
      bloomPass.radius.value = radius;
      bloomPass.threshold.value = threshold;
      setLive("bloom", strength > 0);
    },
    setFilmGrain: (time: number, grain: number, aberration: number) => {
      filmGrainUniforms.time.value = time;
      filmGrainUniforms.grainAmount.value = grain;
      filmGrainUniforms.aberration.value = aberration;
      setLive("grain", grain > 0 || aberration > 0);
    },
    setDepthOfField: (focus: number, aperture: number, maxBlur: number) => {
      bokehUniforms.focus.value = focus;
      bokehUniforms.aperture.value = aperture;
      bokehUniforms.maxBlur.value = maxBlur;
      setLive("dof", maxBlur > 0 && aperture > 0);
    },
    setCameraClip: (near: number, far: number) => {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    },
    resize: resizeToHost,
    // Compile scene pipelines against a small offscreen drawing buffer.
    beginWarm: () => {
      renderer.setPixelRatio(1);
      renderer.setSize(WARM_SIZE, WARM_SIZE, false);
    },
    endWarm: resizeToHost,
    render: () => {
      if (nodeFrame) nodeFrame.frameId++;
      renderPipeline.render();
    },
    warmRender: () => {
      warmTarget ??= new THREE.RenderTarget(1, 1);
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(warmTarget);
      if (nodeFrame) nodeFrame.frameId++;
      renderPipeline.render();
      renderer.setRenderTarget(previous);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;

      renderPipeline.dispose();
      warmTarget?.dispose();
      scene.environmentNode = null;
      environmentNode = null;
      sceneEnvironment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export type RenderPipeline = NonNullable<
  Awaited<ReturnType<typeof createRenderPipeline>>
>;
