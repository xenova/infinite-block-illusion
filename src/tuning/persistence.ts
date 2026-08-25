import { SceneRegistry, type SceneId } from "../scene/scenes";
import { clampRuntimeSpeed } from "../util/format";
import { clamp } from "../util/math";
import {
  DEFAULT_VISUAL_TUNING,
  VISUAL_TUNING_CONTROLS,
  type VisualTuning,
} from "./schema";

const STORAGE_KEY = "infinite-block-illusion:tuning:v1";

export type SessionState = {
  scene: SceneId;
  speed: number;
  tuning: VisualTuning;
};

function isSceneId(value: unknown): value is SceneId {
  return typeof value === "string" && SceneRegistry.has(value);
}

function sanitizeTuning(raw: unknown): Partial<VisualTuning> {
  if (typeof raw !== "object" || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const result: Partial<VisualTuning> = {};
  for (const control of VISUAL_TUNING_CONTROLS) {
    const value = source[control.key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    result[control.key] = clamp(value, control.min, control.max);
  }
  return result;
}

export function readSession(): SessionState {
  const fallback: SessionState = {
    scene: SceneRegistry.default.id,
    speed: 1,
    tuning: { ...DEFAULT_VISUAL_TUNING },
  };
  if (typeof window === "undefined") return fallback;

  let stored: Partial<VisualTuning> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = sanitizeTuning(JSON.parse(raw));
  } catch {}

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("scene");
  const speed = Number(params.get("speed"));

  return {
    scene: isSceneId(requested) ? requested : fallback.scene,
    speed: params.has("speed") ? clampRuntimeSpeed(speed) : 1,
    tuning: { ...DEFAULT_VISUAL_TUNING, ...stored },
  };
}

export function writeTuning(tuning: VisualTuning) {
  if (typeof window === "undefined") return;
  const diff: Partial<VisualTuning> = {};
  for (const control of VISUAL_TUNING_CONTROLS) {
    if (tuning[control.key] !== DEFAULT_VISUAL_TUNING[control.key]) {
      diff[control.key] = tuning[control.key];
    }
  }
  try {
    if (Object.keys(diff).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diff));
  } catch {}
}

export function writeShareableState(scene: SceneId, speed: number) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (scene === SceneRegistry.default.id) params.delete("scene");
  else params.set("scene", scene);
  if (speed === 1) params.delete("speed");
  else params.set("speed", String(Number(speed.toFixed(3))));
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
  try {
    window.history.replaceState(null, "", next);
  } catch {}
}

export function serializeTuning(scene: SceneId, tuning: VisualTuning) {
  return JSON.stringify({ scene, controls: tuning }, null, 2);
}

export function parseTuning(text: string): {
  scene: SceneId | null;
  tuning: Partial<VisualTuning>;
  count: number;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const source = parsed as Record<string, unknown>;
  const controls = "controls" in source ? source.controls : source;
  const tuning = sanitizeTuning(controls);
  const count = Object.keys(tuning).length;
  if (count === 0) return null;
  return {
    scene: isSceneId(source.scene) ? source.scene : null,
    tuning,
    count,
  };
}
