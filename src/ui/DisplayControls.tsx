import type { CSSProperties } from "react";

import type { RendererBackend } from "../scene/render-pipeline";

export const DEFAULT_DISPLAY_SIZE = 1080;
const MIN_DISPLAY_SIZE = 360;
const MAX_DISPLAY_SIZE = 1440;

type Props = {
  size: number;
  onSizeChange: (size: number) => void;
  backend: RendererBackend;
  onBackendChange: (backend: RendererBackend) => void;
  webgpuAvailable: boolean;
};

const BACKENDS: readonly { id: RendererBackend; label: string; hint: string }[] = [
  { id: "webgpu", label: "WebGPU", hint: "Use the WebGPU renderer" },
  { id: "webgl", label: "WebGL", hint: "Use the WebGL 2 compatibility renderer" },
];

export function DisplayControls({
  size,
  onSizeChange,
  backend,
  onBackendChange,
  webgpuAvailable,
}: Props) {
  const progress =
    ((size - MIN_DISPLAY_SIZE) / (MAX_DISPLAY_SIZE - MIN_DISPLAY_SIZE)) * 100;

  return (
    <section
      className="display-controls"
      aria-labelledby="display-controls-title"
    >
      <header className="display-controls__header">
        <div>
          <span>Square output</span>
          <h2 id="display-controls-title">Display</h2>
        </div>
        <output htmlFor="display-size">{size} × {size}</output>
      </header>

      <label className="display-controls__size" htmlFor="display-size">
        <span>Size</span>
        <input
          id="display-size"
          className="control-slider"
          type="range"
          min={MIN_DISPLAY_SIZE}
          max={MAX_DISPLAY_SIZE}
          step="10"
          value={size}
          style={{ "--slider-progress": `${progress}%` } as CSSProperties}
          aria-valuetext={`${size} by ${size} pixels`}
          onChange={(event) => onSizeChange(Number(event.currentTarget.value))}
        />
        <span aria-hidden="true">px</span>
      </label>

      <div className="display-controls__backend">
        <span id="backend-label">Graphics API</span>
        <div role="radiogroup" aria-labelledby="backend-label">
          {BACKENDS.map((option) => {
            const unavailable = option.id === "webgpu" && !webgpuAvailable;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                data-active={backend === option.id ? "true" : "false"}
                aria-checked={backend === option.id}
                disabled={unavailable}
                title={unavailable
                  ? "WebGPU is unavailable in this browser"
                  : option.hint}
                onClick={() => onBackendChange(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
