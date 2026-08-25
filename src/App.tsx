import { useMemo, useState, type CSSProperties } from "react";

import { useIllusionLifecycle } from "./hooks/useIllusionLifecycle";
import { useTuningSession } from "./hooks/useTuningSession";
import { SceneRegistry, resolveScenePreset } from "./scene/scenes";
import { findInactiveControls } from "./tuning/control-availability";
import { readSession } from "./tuning/persistence";
import {
  DEFAULT_DISPLAY_SIZE,
  DisplayControls,
} from "./ui/DisplayControls";
import { LightingLab } from "./ui/LightingLab";
import { PlaybackControls } from "./ui/PlaybackControls";
import { ScenePicker } from "./ui/ScenePicker";
import { StartupScreen } from "./ui/StartupScreen";
import { DismissIcon, SlidersIcon } from "./ui/icons";

const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

export default function App() {
  const [session] = useState(readSession);
  const [displaySize, setDisplaySize] = useState(DEFAULT_DISPLAY_SIZE);
  const runtime = useIllusionLifecycle(session);
  const tuning = useTuningSession({
    initialTuning: session.tuning,
    scene: runtime.scene,
    onApplyTuning: runtime.applyTuning,
    onSelectScene: runtime.selectScene,
  });

  const activeScene = SceneRegistry.get(runtime.scene) ?? SceneRegistry.default;
  const inactiveControls = useMemo(
    () => findInactiveControls(resolveScenePreset(activeScene)),
    [activeScene],
  );

  const pageStyle = {
    "--preset-scene-background": activeScene.presentation.pageBackground,
    "--vignette-strength": tuning.visualTuning.vignette,
    "--display-size": `${displaySize}px`,
  } as CSSProperties;
  const controlsOpen = runtime.controlsOpen;

  return (
    <main
      className="illusion"
      style={pageStyle}
      aria-label="Infinite rolling-cube illusion"
    >
      <div className="illusion__backdrop" aria-hidden="true" />
      <div
        ref={runtime.cycleBackdropRef}
        className="illusion__backdrop illusion__backdrop--cycle"
        aria-hidden="true"
      />
      {runtime.departing.map((layer) => (
        <div
          key={layer.key}
          className="illusion__backdrop illusion__backdrop--departing"
          style={{ background: layer.background }}
          aria-hidden="true"
          onAnimationEnd={() => runtime.removeDeparting(layer.key)}
        />
      ))}

      <StartupScreen
        complete={runtime.status !== "loading"}
        active={runtime.startupActive}
        onFinish={runtime.finishStartup}
      />

      <div
        className="illusion__layout"
        inert={runtime.startupActive}
        aria-hidden={runtime.startupActive}
      >
        <div className="illusion__frame">
          <div ref={runtime.hostRef} className="illusion__stage" aria-hidden="true" />
          <div className="illusion__grade" aria-hidden="true" />
          {runtime.status === "failed" ? (
            <div className="stage-fallback" role="status">
              <p>The renderer could not start.</p>
              <p>
                This scene requires WebGPU or WebGL 2. Check the browser console
                for details.
              </p>
            </div>
          ) : null}
        </div>

        <div className="control-dock" data-open={controlsOpen ? "true" : "false"}>
          <button
            type="button"
            className="control-dock__handle"
            aria-label={controlsOpen ? "Hide controls" : "Show controls"}
            aria-expanded={controlsOpen}
            aria-controls="scene-controls"
            title={controlsOpen ? "Hide controls (F)" : "Show controls (F)"}
            onClick={runtime.toggleControls}
          >
            {controlsOpen ? <DismissIcon /> : <SlidersIcon />}
          </button>

          <aside
            id="scene-controls"
            className="scene-controls"
            aria-label="Scene inspector"
            inert={!controlsOpen}
          >
            <ScenePicker
              scene={runtime.scene}
              onSelect={runtime.selectScene}
            />

            {runtime.status === "failed" ? null : (
              <PlaybackControls
                paused={runtime.paused}
                onTogglePaused={runtime.togglePaused}
                soundOn={runtime.soundOn}
                onToggleSound={() => void runtime.toggleSound()}
                runtimeSpeed={runtime.runtimeSpeed}
                speedDraft={runtime.speedDraft}
                onSpeedSlider={runtime.updateRuntimeSpeed}
                onSpeedDraft={runtime.updateSpeedDraft}
                onCommitSpeed={runtime.commitSpeedDraft}
                smoothTransitions={runtime.smoothTransitions}
                onToggleSmoothTransitions={runtime.updateSmoothTransitions}
                cycle={runtime.cycle}
                onToggleCycle={runtime.updateCycleEnabled}
                onCycleRotations={runtime.updateCycleRotations}
                onCycleTransition={runtime.updateCycleTransition}
              />
            )}

            <DisplayControls
              size={displaySize}
              onSizeChange={setDisplaySize}
              backend={runtime.backend}
              onBackendChange={runtime.setBackend}
              webgpuAvailable={webgpuAvailable}
            />

            <LightingLab
              tuning={tuning.visualTuning}
              drafts={tuning.drafts}
              inactive={inactiveControls}
              status={tuning.status}
              onChange={tuning.updateTuning}
              onDraft={tuning.setDraft}
              onCommitDraft={tuning.commitDraft}
              onResetControl={tuning.resetControl}
              onResetAll={tuning.resetAll}
              onCopy={() => void tuning.copyTuning()}
              onPaste={() => void tuning.pasteTuning()}
            />
          </aside>
        </div>

        <p className="sr-only">
          Infinite rolling cubes. Space pauses, F shows or hides the controls, and
          M toggles sound.
        </p>
      </div>
    </main>
  );
}
