import { createShepardSoundtrack } from "../audio/shepard-soundtrack";
import { clamp, positiveModulo } from "../util/math";
import {
  LAVA_LOOP_SECONDS,
  LOOP_FRAMES,
  LOOP_SECONDS,
  TARGET_FPS,
} from "./constants";

const FRAME_BUDGET_MS = 1000 / TARGET_FPS;

export function createAnimationRuntime(
  options: {
    host: HTMLElement;
    speed: number;
    paused: boolean;
    isTransitioning: () => boolean;
    resize: () => void;
    update: (state: {
      now: number;
      loopFrame: number;
      timelineFrame: number;
      lavaPhase: number;
      grainTime: number;
      present: boolean;
    }) => void;
    teardown: () => void;
  },
) {
  let speed = options.speed;
  let paused = options.paused;
  let visualElapsed = 0;
  let visualTimelineElapsed = 0;
  let lavaElapsed = 0;
  let previousTick: number | null = null;
  let previousCallback: number | null = null;
  let displayInterval = 0;
  let sinceLastPresent = 0;
  let animationFrame = 0;
  let renderingEnabled = false;
  let updating = false;
  let disposed = false;
  let pixelRatio = window.devicePixelRatio;

  const updateFrame = (now: number, present = renderingEnabled) => {
    updating = true;
    try {
      options.update({
        now,
        loopFrame: (visualElapsed / LOOP_SECONDS) * LOOP_FRAMES,
        timelineFrame: (visualTimelineElapsed / LOOP_SECONDS) * LOOP_FRAMES,
        lavaPhase: (lavaElapsed / LAVA_LOOP_SECONDS) * Math.PI * 2,
        grainTime: visualElapsed / LOOP_SECONDS,
        present,
      });
    } finally {
      updating = false;
    }
  };

  const invalidate = () => {
    if (!renderingEnabled || disposed || !paused || updating) return;
    updateFrame(performance.now());
  };

  const resize = () => {
    options.resize();
    invalidate();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(options.host);
  resize();

  const handleVisibility = () => {
    if (!document.hidden) invalidate();
  };
  document.addEventListener("visibilitychange", handleVisibility);

  const soundtrack = createShepardSoundtrack();

  const presentStride = () =>
    displayInterval > 0
      ? Math.max(1, Math.floor(FRAME_BUDGET_MS / displayInterval + 0.06))
      : 1;

  const animate = (now: number) => {
    animationFrame = requestAnimationFrame(animate);

    if (window.devicePixelRatio !== pixelRatio) {
      pixelRatio = window.devicePixelRatio;
      resize();
    }

    if (previousCallback !== null) {
      const sample = now - previousCallback;
      if (sample > 0 && sample < 50) {
        displayInterval =
          displayInterval === 0 ? sample : displayInterval * 0.9 + sample * 0.1;
      }
    }
    previousCallback = now;

    // Frame-stride throttling keeps presentation cadence regular.
    sinceLastPresent += 1;
    if (sinceLastPresent < presentStride()) return;
    sinceLastPresent = 0;

    const deltaSeconds =
      previousTick === null ? 0 : clamp((now - previousTick) / 1000, 0, 0.1);
    previousTick = now;

    if (paused) {
      if (options.isTransitioning()) updateFrame(now);
      return;
    }

    const visualDelta = deltaSeconds * speed;
    visualElapsed = positiveModulo(visualElapsed + visualDelta, LOOP_SECONDS);
    visualTimelineElapsed += visualDelta;
    lavaElapsed = positiveModulo(lavaElapsed + deltaSeconds * speed, LAVA_LOOP_SECONDS);
    updateFrame(now);
  };

  updateFrame(performance.now(), false);
  animationFrame = requestAnimationFrame(animate);

  return {
    soundtrack,
    invalidate,
    enableRendering: () => {
      if (renderingEnabled || disposed) return;
      renderingEnabled = true;
      updateFrame(performance.now(), true);
    },
    setSpeed: (next: number) => {
      speed = next;
    },
    setPaused: (next: boolean) => {
      paused = next;
      invalidate();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      renderingEnabled = false;

      cancelAnimationFrame(animationFrame);
      soundtrack.dispose();
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver.disconnect();
      options.teardown();
    },
  };
}
