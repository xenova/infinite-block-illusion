import type { VisualTuningControl } from "../tuning/schema";
import { MAX_RUNTIME_SPEED, MIN_RUNTIME_SPEED } from "../scene/constants";
import { clamp } from "./math";

export function clampRuntimeSpeed(value: number) {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, MIN_RUNTIME_SPEED, MAX_RUNTIME_SPEED);
}

/** Fewer decimals as the number grows, so the readout stays a stable width. */
export function formatRuntimeSpeed(value: number) {
  if (value < 0.01) return value.toFixed(3);
  if (value < 0.1) return value.toFixed(2);
  if (value < 10) return Number(value.toFixed(2)).toString();
  return Number(value.toFixed(1)).toString();
}

function controlDigits(control: VisualTuningControl) {
  return control.digits ?? (control.step < 0.01 ? 3 : 2);
}

/** Display form, including any unit suffix. */
export function formatVisualTuning(control: VisualTuningControl, value: number) {
  return `${value.toFixed(controlDigits(control))}${control.suffix ?? ""}`;
}

/** Editable form for the number input: no suffix, no trailing zeroes. */
export function formatVisualTuningInput(control: VisualTuningControl, value: number) {
  return Number(value.toFixed(controlDigits(control))).toString();
}
