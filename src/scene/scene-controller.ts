import type { VisualTuning } from "../tuning/schema";
import { clamp01, smootherstep } from "../util/math";
import { SCENE_TRANSITION_MS } from "./constants";
import {
  SceneRegistry,
  resolveScenePreset,
  type ResolvedSceneProfile,
  type SceneId,
} from "./scenes";

type SceneControllerAdapter<OutgoingLayer> = Readonly<{
  createOutgoingLayer: () => OutgoingLayer;
  releaseOutgoingLayer: (layer: OutgoingLayer) => void;
  applyActive: (profile: ResolvedSceneProfile, tuning: VisualTuning) => void;
  renderOutgoing: (
    layer: OutgoingLayer,
    progress: number,
  ) => void;
  applyTuning: (tuning: VisualTuning) => void;
  invalidate: () => void;
}>;

type ActiveTransition<OutgoingLayer> = {
  outgoing: OutgoingLayer;
  startedAt: number;
  driven: boolean;
};

export function createSceneController<OutgoingLayer>(
  options: {
    initialScene: SceneId;
    initialTuning: VisualTuning;
    adapter: SceneControllerAdapter<OutgoingLayer>;
  },
) {
  const { adapter } = options;

  let activeScene = SceneRegistry.get(options.initialScene) ?? SceneRegistry.default;
  let activeProfile = resolveScenePreset(activeScene);
  let tuning = { ...options.initialTuning };
  let transition: ActiveTransition<OutgoingLayer> | null = null;
  let disposed = false;

  const releaseTransition = () => {
    if (!transition) return;
    adapter.releaseOutgoingLayer(transition.outgoing);
    transition = null;
  };

  const applyActive = () => {
    adapter.applyActive(activeProfile, tuning);
  };

  const renderTransition = (
    current: ActiveTransition<OutgoingLayer>,
    linearProgress: number,
  ) => {
    const progress = clamp01(linearProgress);
    adapter.renderOutgoing(current.outgoing, smootherstep(progress));
    if (progress < 1) return;

    transition = null;
    applyActive();
    adapter.releaseOutgoingLayer(current.outgoing);
  };

  const update = (now: number) => {
    if (disposed || !transition || transition.driven) return;
    const current = transition;
    renderTransition(
      current,
      (now - current.startedAt) / SCENE_TRANSITION_MS,
    );
  };

  applyActive();

  return {
    getProfile: () => activeProfile,
    isTransitioning: () => transition !== null,
    update,
    driveTransition: (progress: number) => {
      if (disposed || !transition?.driven) return;
      renderTransition(transition, progress);
    },
    finishTransition: () => {
      if (disposed || !transition) return;
      renderTransition(transition, 1);
      adapter.invalidate();
    },
    setScene: (
      scene: SceneId,
      animateTransition: boolean,
      drivenTransition = false,
    ) => {
      if (disposed) return;
      const nextScene = SceneRegistry.get(scene) ?? SceneRegistry.default;
      if (nextScene.id === activeScene.id) return;

      const now = performance.now();
      if (animateTransition && transition) update(now);

      let outgoing: OutgoingLayer | null = null;
      if (animateTransition) outgoing = adapter.createOutgoingLayer();

      releaseTransition();
      activeScene = nextScene;
      activeProfile = resolveScenePreset(activeScene);

      if (!animateTransition || !outgoing) {
        applyActive();
        adapter.invalidate();
        return;
      }

      transition = {
        outgoing,
        startedAt: now,
        driven: drivenTransition,
      };
      applyActive();
      adapter.renderOutgoing(outgoing, 0);
      adapter.invalidate();
    },
    setTuning: (nextTuning: VisualTuning) => {
      if (disposed) return;
      tuning = { ...nextTuning };
      adapter.applyTuning(tuning);
      adapter.invalidate();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      releaseTransition();
    },
  };
}
