import type { CSSProperties } from "react";

import {
  MAX_RUNTIME_SPEED,
  MAX_SLIDER_SPEED,
  MAX_SPEED_SLIDER_VALUE,
  MIN_RUNTIME_SPEED,
  MIN_SPEED_SLIDER_VALUE,
} from "../scene/constants";
import {
  CYCLE_ROTATIONS,
  type CycleRotations,
  type SceneCycleOptions,
} from "../scene/scene-cycle";
import { formatRuntimeSpeed } from "../util/format";
import { PauseIcon, PlayIcon, SoundIcon } from "./icons";

type Props = {
  paused: boolean;
  onTogglePaused: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  runtimeSpeed: number;
  speedDraft: string;
  onSpeedSlider: (value: number) => void;
  onSpeedDraft: (value: string) => void;
  onCommitSpeed: () => void;
  smoothTransitions: boolean;
  onToggleSmoothTransitions: (enabled: boolean) => void;
  cycle: SceneCycleOptions;
  onToggleCycle: (enabled: boolean) => void;
  onCycleRotations: (rotations: CycleRotations) => void;
  onCycleTransition: (transition: number) => void;
};

const ROTATION_LABELS: Record<CycleRotations, string> = {
  0.25: "¼",
  0.5: "½",
  0.75: "¾",
  1: "1",
};

export function PlaybackControls({
  paused,
  onTogglePaused,
  soundOn,
  onToggleSound,
  runtimeSpeed,
  speedDraft,
  onSpeedSlider,
  onSpeedDraft,
  onCommitSpeed,
  smoothTransitions,
  onToggleSmoothTransitions,
  cycle,
  onToggleCycle,
  onCycleRotations,
  onCycleTransition,
}: Props) {
  return (
    <div className="playback-controls" role="group" aria-label="Playback controls">
      <button
        type="button"
        className="playback-controls__button playback-controls__button--play"
        data-active={paused ? "false" : "true"}
        aria-label={paused ? "Play the loop" : "Pause the loop"}
        aria-pressed={!paused}
        title={paused ? "Play (space)" : "Pause (space)"}
        onClick={onTogglePaused}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>

      <label className="playback-controls__speed">
        <span className="sr-only">Loop playback speed</span>
        <input
          className="control-slider"
          type="range"
          min={MIN_SPEED_SLIDER_VALUE}
          max={MAX_SPEED_SLIDER_VALUE}
          step="0.001"
          value={Math.log10(Math.min(runtimeSpeed, MAX_SLIDER_SPEED))}
          aria-label="Loop playback speed"
          aria-valuetext={`${formatRuntimeSpeed(runtimeSpeed)} times speed`}
          onChange={(event) => onSpeedSlider(10 ** Number(event.currentTarget.value))}
        />
      </label>

      <span className="playback-controls__readout">
        <input
          type="number"
          inputMode="decimal"
          min={MIN_RUNTIME_SPEED}
          max={MAX_RUNTIME_SPEED}
          step="0.001"
          value={speedDraft}
          aria-label="Custom loop speed multiplier"
          onChange={(event) => onSpeedDraft(event.currentTarget.value)}
          onBlur={onCommitSpeed}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span aria-hidden="true">×</span>
      </span>

      <button
        type="button"
        className="playback-controls__button playback-controls__button--sound"
        data-active={soundOn ? "true" : "false"}
        aria-label={soundOn ? "Mute the Shepard-tone soundtrack" : "Play the Shepard-tone soundtrack"}
        aria-pressed={soundOn}
        title={soundOn ? "Mute soundtrack (M)" : "Play Shepard tone (M)"}
        onClick={onToggleSound}
      >
        <SoundIcon />
        <span className="playback-controls__pulse" aria-hidden="true" />
      </button>

      <label className="transition-toggle">
        <input
          type="checkbox"
          checked={smoothTransitions}
          onChange={(event) => onToggleSmoothTransitions(event.currentTarget.checked)}
        />
        <span className="transition-toggle__track" aria-hidden="true">
          <span />
        </span>
        <span>Smooth transitions</span>
      </label>

      <div className="cycle-controls" data-enabled={cycle.enabled ? "true" : "false"}>
        <div className="cycle-controls__top">
          <label className="transition-toggle cycle-toggle">
            <input
              type="checkbox"
              checked={cycle.enabled}
              onChange={(event) => onToggleCycle(event.currentTarget.checked)}
            />
            <span className="transition-toggle__track" aria-hidden="true">
              <span />
            </span>
            <span>Cycle</span>
          </label>

          <div className="cycle-cadence">
            <span>Every</span>
            <div role="radiogroup" aria-label="Scene cycle cadence">
              {CYCLE_ROTATIONS.map((rotations) => (
                <button
                  key={rotations}
                  type="button"
                  role="radio"
                  data-active={cycle.rotations === rotations ? "true" : "false"}
                  aria-label={`${rotations} rotations`}
                  aria-checked={cycle.rotations === rotations}
                  title={`Change scene every ${rotations} rotations`}
                  onClick={() => onCycleRotations(rotations)}
                >
                  {ROTATION_LABELS[rotations]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label
          className="cycle-transition"
          data-disabled={smoothTransitions ? "false" : "true"}
        >
          <span>Transition</span>
          <input
            id="cycle-transition"
            className="control-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={cycle.transition}
            disabled={!smoothTransitions}
            style={{
              "--slider-progress": `${cycle.transition * 100}%`,
            } as CSSProperties}
            aria-label="Cycle transition duration"
            aria-valuetext={
              cycle.transition === 0
                ? "Instant"
                : cycle.transition === 1
                  ? "Continuous"
                  : `${Math.round(cycle.transition * 100)} percent of the cycle interval`
            }
            onChange={(event) => onCycleTransition(Number(event.currentTarget.value))}
          />
          <output htmlFor="cycle-transition">
            {smoothTransitions ? cycle.transition.toFixed(2) : "Off"}
          </output>
        </label>
      </div>
    </div>
  );
}
