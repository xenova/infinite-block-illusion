import { useCallback, useEffect, useRef, useState } from "react";

import { createIllusion, type IllusionHandle } from "../scene/illusion";
import type { RendererBackend } from "../scene/render-pipeline";
import type {
  CycleRotations,
  SceneCycleOptions,
} from "../scene/scene-cycle";
import { SceneRegistry, type SceneId } from "../scene/scenes";
import { writeShareableState, type SessionState } from "../tuning/persistence";
import type { VisualTuning } from "../tuning/schema";
import { clampRuntimeSpeed, formatRuntimeSpeed } from "../util/format";
import { clamp } from "../util/math";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const DEFAULT_CYCLE_OPTIONS: SceneCycleOptions = {
  enabled: false,
  rotations: 1,
  transition: 0.4,
};

const BACKEND_KEY = "infinite-block-illusion:backend";

function readBackend(): RendererBackend {
  try {
    return localStorage.getItem(BACKEND_KEY) === "webgl" ? "webgl" : "webgpu";
  } catch {
    return "webgpu";
  }
}

function writeBackend(backend: RendererBackend) {
  try {
    localStorage.setItem(BACKEND_KEY, backend);
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

export function useIllusionLifecycle(session: SessionState) {
  const [initialPaused] = useState(prefersReducedMotion);
  const hostRef = useRef<HTMLDivElement>(null);
  const cycleBackdropRef = useRef<HTMLDivElement>(null);
  const [backend, setBackendState] = useState<RendererBackend>(readBackend);
  const illusionRef = useRef<IllusionHandle | null>(null);

  const [scene, setScene] = useState<SceneId>(session.scene);
  const sceneRef = useRef(session.scene);
  const [soundOn, setSoundOn] = useState(false);
  const [runtimeSpeed, setRuntimeSpeed] = useState(session.speed);
  const runtimeSpeedRef = useRef(session.speed);
  const [speedDraft, setSpeedDraft] = useState(() => formatRuntimeSpeed(session.speed));
  const [paused, setPaused] = useState(initialPaused);
  const pausedRef = useRef(initialPaused);
  const tuningRef = useRef(session.tuning);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [startupActive, setStartupActive] = useState(true);
  const [smoothTransitions, setSmoothTransitions] = useState(true);
  const [cycle, setCycle] = useState<SceneCycleOptions>(DEFAULT_CYCLE_OPTIONS);
  const [departing, setDeparting] = useState<
    readonly { background: string; key: number }[]
  >([]);

  const smoothTransitionsRef = useRef(smoothTransitions);
  const cycleRef = useRef(cycle);
  const departSequence = useRef(0);

  const clearCycleBackdrop = useCallback(() => {
    const backdrop = cycleBackdropRef.current;
    if (!backdrop) return;
    backdrop.style.opacity = "0";
    backdrop.style.visibility = "hidden";
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let handle: IllusionHandle | null = null;
    setStatus("loading");
    void createIllusion(host, {
      backend,
      scene: sceneRef.current,
      tuning: tuningRef.current,
      speed: runtimeSpeedRef.current,
      paused: pausedRef.current,
      onReady: () => setStatus("ready"),
      onCycleSceneChange: (next) => {
        const previous = sceneRef.current;
        const backdrop = cycleBackdropRef.current;
        if (backdrop) {
          backdrop.style.background =
            SceneRegistry.get(previous)?.presentation.pageBackground
            ?? SceneRegistry.default.presentation.pageBackground;
          backdrop.style.opacity = "1";
          backdrop.style.visibility = "visible";
        }
        setDeparting([]);
        sceneRef.current = next;
        setScene(next);
      },
      onCycleTransitionProgress: (progress) => {
        const backdrop = cycleBackdropRef.current;
        if (!backdrop) return;
        backdrop.style.opacity = String(1 - progress);
        if (progress >= 1) backdrop.style.visibility = "hidden";
      },
    }).then((created) => {
      if (cancelled) {
        created?.dispose();
        return;
      }
      if (!created) {
        setStatus("failed");
        return;
      }
      handle = created;
      illusionRef.current = created;
      const initialCycle = cycleRef.current;
      created.setCycle({
        ...initialCycle,
        transition: smoothTransitionsRef.current ? initialCycle.transition : 0,
      });
    }).catch((error: unknown) => {
      console.error("Failed to create the illusion", error);
      if (!cancelled) setStatus("failed");
    });
    return () => {
      cancelled = true;
      illusionRef.current = null;
      handle?.dispose();
    };
  }, [backend]);

  const setBackend = useCallback((next: RendererBackend) => {
    if (next === backend) return;
    writeBackend(next);
    // Cover the canvas before React tears down the old renderer.
    setStartupActive(true);
    setStatus("loading");
    setSoundOn(false);
    setBackendState(next);
  }, [backend]);

  useEffect(() => {
    writeShareableState(scene, runtimeSpeed);
  }, [runtimeSpeed, scene]);

  const selectScene = useCallback((next: SceneId) => {
    const previous = sceneRef.current;
    if (previous === next) return;

    const animate = smoothTransitionsRef.current;
    if (animate) {
      departSequence.current += 1;
      const liveBackground = hostRef.current
        ?.closest<HTMLElement>(".illusion")
        ?.style.getPropertyValue("--scene-background")
        .trim();
      const background = liveBackground
        || SceneRegistry.get(previous)?.presentation.pageBackground
        || SceneRegistry.default.presentation.pageBackground;
      const layer = { background, key: departSequence.current };
      setDeparting((current) => [layer, ...current]);
    } else {
      setDeparting([]);
    }

    clearCycleBackdrop();

    illusionRef.current?.setScene(next, animate);
    sceneRef.current = next;
    setScene(next);
  }, [clearCycleBackdrop]);

  const applyTuning = useCallback((next: VisualTuning) => {
    tuningRef.current = next;
    illusionRef.current?.setTuning(next);
  }, []);

  const updateRuntimeSpeed = useCallback((next: number, syncDraft = true) => {
    const clamped = clampRuntimeSpeed(next);
    runtimeSpeedRef.current = clamped;
    illusionRef.current?.setSpeed(clamped);
    setRuntimeSpeed(clamped);
    if (syncDraft) setSpeedDraft(formatRuntimeSpeed(clamped));
  }, []);

  const commitSpeedDraft = useCallback(() => {
    const parsed = Number(speedDraft);
    updateRuntimeSpeed(Number.isFinite(parsed) && parsed > 0 ? parsed : runtimeSpeed);
  }, [runtimeSpeed, speedDraft, updateRuntimeSpeed]);

  const updateSpeedDraft = useCallback(
    (next: string) => {
      setSpeedDraft(next);
      const parsed = Number(next);
      if (next.trim() !== "" && Number.isFinite(parsed) && parsed > 0) {
        updateRuntimeSpeed(parsed, false);
      }
    },
    [updateRuntimeSpeed],
  );

  const togglePaused = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    illusionRef.current?.setPaused(next);
    setPaused(next);
  }, []);

  const toggleSound = useCallback(async () => {
    const handle = illusionRef.current;
    if (!handle) return;
    if (soundOn) {
      handle.soundtrack.stop();
      setSoundOn(false);
      return;
    }
    if (await handle.soundtrack.start()) setSoundOn(true);
  }, [soundOn]);

  const toggleControls = useCallback(() => {
    setControlsOpen((current) => !current);
  }, []);

  const finishStartup = useCallback(() => setStartupActive(false), []);

  const removeDeparting = useCallback((key: number) => {
    setDeparting((current) => current.filter((layer) => layer.key !== key));
  }, []);

  const updateSmoothTransitions = useCallback((enabled: boolean) => {
    smoothTransitionsRef.current = enabled;
    setSmoothTransitions(enabled);
    if (!enabled) setDeparting([]);
    const currentCycle = cycleRef.current;
    illusionRef.current?.setCycle({
      ...currentCycle,
      transition: enabled ? currentCycle.transition : 0,
    });
  }, []);

  const updateCycle = useCallback((next: SceneCycleOptions) => {
    cycleRef.current = next;
    setCycle(next);
    illusionRef.current?.setCycle({
      ...next,
      transition: smoothTransitionsRef.current ? next.transition : 0,
    });
  }, []);

  const updateCycleEnabled = useCallback((enabled: boolean) => {
    updateCycle({ ...cycleRef.current, enabled });
    if (!enabled) clearCycleBackdrop();
  }, [clearCycleBackdrop, updateCycle]);

  const updateCycleRotations = useCallback((rotations: CycleRotations) => {
    updateCycle({ ...cycleRef.current, rotations });
  }, [updateCycle]);

  const updateCycleTransition = useCallback((transition: number) => {
    updateCycle({ ...cycleRef.current, transition: clamp(transition, 0, 1) });
  }, [updateCycle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (startupActive) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePaused();
      } else if (event.key === "f" || event.key === "F") {
        toggleControls();
      } else if (event.key === "m" || event.key === "M") {
        void toggleSound();
      } else if (event.key === "Escape") {
        setControlsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startupActive, toggleControls, togglePaused, toggleSound]);

  return {
    backend,
    setBackend,
    hostRef,
    cycleBackdropRef,
    scene,
    selectScene,
    departing,
    removeDeparting,
    smoothTransitions,
    updateSmoothTransitions,
    cycle,
    updateCycleEnabled,
    updateCycleRotations,
    updateCycleTransition,
    status,
    startupActive,
    finishStartup,
    paused,
    togglePaused,
    soundOn,
    toggleSound,
    controlsOpen,
    toggleControls,
    runtimeSpeed,
    speedDraft,
    updateRuntimeSpeed,
    updateSpeedDraft,
    commitSpeedDraft,
    applyTuning,
  };
}
