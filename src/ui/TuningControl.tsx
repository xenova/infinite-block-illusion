import { memo, type CSSProperties } from "react";

import {
  DEFAULT_VISUAL_TUNING,
  type VisualTuningControl,
  type VisualTuningKey,
} from "../tuning/schema";
import { formatVisualTuning, formatVisualTuningInput } from "../util/format";
import { ResetIcon } from "./icons";

type Props = {
  control: VisualTuningControl;
  value: number;
  draft: string | undefined;
  onChange: (key: VisualTuningKey, value: number) => void;
  onDraft: (key: VisualTuningKey, draft: string | undefined) => void;
  onCommitDraft: (control: VisualTuningControl) => void;
  onReset: (control: VisualTuningControl) => void;
  inactiveReason?: string;
};

function TuningControlImpl({
  control,
  value,
  draft,
  onChange,
  onDraft,
  onCommitDraft,
  onReset,
  inactiveReason,
}: Props) {
  const sliderId = `visual-tuning-${control.key}`;
  const exactValue = draft ?? formatVisualTuningInput(control, value);
  const sliderProgress = ((value - control.min) / (control.max - control.min)) * 100;
  const modified = value !== DEFAULT_VISUAL_TUNING[control.key];
  const inactive = inactiveReason !== undefined;

  return (
    <div
      className="tuning-control"
      data-modified={modified ? "true" : "false"}
      data-inactive={inactive ? "true" : "false"}
      style={{ "--slider-progress": `${sliderProgress}%` } as CSSProperties}
    >
      <div className="tuning-control__meta">
        <label htmlFor={sliderId} title={inactiveReason}>
          {control.label}
          {inactive ? (
            <span className="tuning-control__badge" title={inactiveReason}>
              n/a
            </span>
          ) : null}
        </label>
        <button
          type="button"
          className="tuning-control__reset"
          aria-label={`Reset ${control.label}`}
          title={`Reset ${control.label}`}
          onClick={() => onReset(control)}
        >
          <ResetIcon />
        </button>
        <span className="tuning-control__exact">
          <input
            type="number"
            inputMode="decimal"
            min={control.min}
            max={control.max}
            step={control.step}
            value={exactValue}
            disabled={inactive}
            aria-label={`${control.label} exact value`}
            onFocus={() => onDraft(control.key, formatVisualTuningInput(control, value))}
            onChange={(event) => onDraft(control.key, event.currentTarget.value)}
            onBlur={() => onCommitDraft(control)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.preventDefault();
                onDraft(control.key, undefined);
              }
            }}
          />
          {control.suffix ? <span aria-hidden="true">{control.suffix}</span> : null}
        </span>
      </div>
      <input
        id={sliderId}
        className="control-slider"
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        disabled={inactive}
        aria-valuetext={formatVisualTuning(control, value)}
        onChange={(event) => onChange(control.key, Number(event.currentTarget.value))}
      />
    </div>
  );
}

export const TuningControl = memo(TuningControlImpl);
