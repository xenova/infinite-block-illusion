import { useCallback, useEffect, useRef, useState } from "react";

import type { SceneId } from "../scene/scenes";
import {
  parseTuning,
  serializeTuning,
  writeTuning,
} from "../tuning/persistence";
import {
  DEFAULT_VISUAL_TUNING,
  VISUAL_TUNING_CONTROL_BY_KEY,
  type VisualTuning,
  type VisualTuningControl,
  type VisualTuningDrafts,
  type VisualTuningKey,
} from "../tuning/schema";
import { clamp } from "../util/math";

const STATUS_TIMEOUT_MS = 1800;

function withoutDraft(drafts: VisualTuningDrafts, key: VisualTuningKey) {
  if (!(key in drafts)) return drafts;
  const next = { ...drafts };
  delete next[key];
  return next;
}

type TuningSessionOptions = {
  initialTuning: VisualTuning;
  scene: SceneId;
  onApplyTuning: (tuning: VisualTuning) => void;
  onSelectScene: (scene: SceneId) => void;
};

export function useTuningSession({
  initialTuning,
  scene,
  onApplyTuning,
  onSelectScene,
}: TuningSessionOptions) {
  const [visualTuning, setVisualTuning] = useState<VisualTuning>(() => initialTuning);
  const [drafts, setDrafts] = useState<VisualTuningDrafts>({});
  const [status, setStatus] = useState("");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => writeTuning(visualTuning), 400);
    return () => clearTimeout(timer);
  }, [visualTuning]);

  useEffect(() => {
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, []);

  const announce = useCallback((message: string) => {
    setStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => {
      setStatus("");
      statusTimer.current = null;
    }, STATUS_TIMEOUT_MS);
  }, []);

  const applyTuning = useCallback((next: VisualTuning) => {
    onApplyTuning(next);
    setVisualTuning(next);
  }, [onApplyTuning]);

  const updateTuning = useCallback((key: VisualTuningKey, value: number) => {
    const control = VISUAL_TUNING_CONTROL_BY_KEY.get(key);
    if (!control || !Number.isFinite(value)) return;
    setVisualTuning((current) => {
      const next = { ...current, [key]: clamp(value, control.min, control.max) };
      onApplyTuning(next);
      return next;
    });
    setDrafts((current) => withoutDraft(current, key));
  }, [onApplyTuning]);

  const setDraft = useCallback((key: VisualTuningKey, draft: string | undefined) => {
    setDrafts((current) =>
      draft === undefined ? withoutDraft(current, key) : { ...current, [key]: draft },
    );
  }, []);

  const commitDraft = useCallback(
    (control: VisualTuningControl) => {
      const draft = drafts[control.key];
      if (draft === undefined) return;
      const parsed = Number(draft);
      if (draft.trim() !== "" && Number.isFinite(parsed)) {
        updateTuning(control.key, parsed);
        return;
      }
      setDraft(control.key, undefined);
    },
    [drafts, setDraft, updateTuning],
  );

  const resetControl = useCallback(
    (control: VisualTuningControl) => {
      updateTuning(control.key, DEFAULT_VISUAL_TUNING[control.key]);
      announce(`${control.label} restored`);
    },
    [announce, updateTuning],
  );

  const resetAll = useCallback(() => {
    applyTuning({ ...DEFAULT_VISUAL_TUNING });
    setDrafts({});
    announce("Defaults restored");
  }, [announce, applyTuning]);

  const copyTuning = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(serializeTuning(scene, visualTuning));
      announce("Values copied");
    } catch {
      announce("Copy unavailable");
    }
  }, [announce, scene, visualTuning]);

  const pasteTuning = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseTuning(text);
      if (!parsed) {
        announce("Clipboard has no valid tuning");
        return;
      }
      applyTuning({ ...DEFAULT_VISUAL_TUNING, ...parsed.tuning });
      setDrafts({});
      if (parsed.scene) onSelectScene(parsed.scene);
      announce(`Applied ${parsed.count} values`);
    } catch {
      announce("Paste unavailable");
    }
  }, [announce, applyTuning, onSelectScene]);

  return {
    visualTuning,
    drafts,
    status,
    updateTuning,
    setDraft,
    commitDraft,
    resetControl,
    resetAll,
    copyTuning,
    pasteTuning,
  };
}
