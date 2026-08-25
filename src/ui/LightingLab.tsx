import { useMemo, useState } from "react";

import {
  VISUAL_TUNING_GROUPS,
  countModified,
  type VisualTuning,
  type VisualTuningControl,
  type VisualTuningDrafts,
  type VisualTuningGroupId,
  type VisualTuningKey,
} from "../tuning/schema";
import type { InactiveControls } from "../tuning/control-availability";
import { TuningControl } from "./TuningControl";

type Props = {
  tuning: VisualTuning;
  drafts: VisualTuningDrafts;
  inactive: InactiveControls;
  status: string;
  onChange: (key: VisualTuningKey, value: number) => void;
  onDraft: (key: VisualTuningKey, draft: string | undefined) => void;
  onCommitDraft: (control: VisualTuningControl) => void;
  onResetControl: (control: VisualTuningControl) => void;
  onResetAll: () => void;
  onCopy: () => void;
  onPaste: () => void;
};

function groupCount(
  group: { controls: readonly VisualTuningControl[] },
  inactive: InactiveControls,
) {
  const total = group.controls.length;
  const active = group.controls.filter((c) => !inactive.has(c.key)).length;
  if (active === total) return { label: String(total), title: `${total} controls` };
  return {
    label: `${active}/${total}`,
    title: `${total - active} of ${total} controls are unavailable for this scene`,
  };
}

export function LightingLab({
  tuning,
  drafts,
  inactive,
  status,
  onChange,
  onDraft,
  onCommitDraft,
  onResetControl,
  onResetAll,
  onCopy,
  onPaste,
}: Props) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<VisualTuningGroupId>>(
    () => new Set(["camera", "tone"]),
  );
  const modifiedCount = useMemo(() => countModified(tuning), [tuning]);

  const normalizedQuery = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!normalizedQuery) return VISUAL_TUNING_GROUPS;
    return VISUAL_TUNING_GROUPS.map((group) => ({
      ...group,
      controls: group.controls.filter(
        (control) =>
          control.label.toLowerCase().includes(normalizedQuery)
          || control.key.toLowerCase().includes(normalizedQuery)
          || group.label.toLowerCase().includes(normalizedQuery),
      ),
    })).filter((group) => group.controls.length > 0);
  }, [normalizedQuery]);

  return (
    <section className="visual-tuning" aria-labelledby="visual-tuning-title">
      <header className="visual-tuning__header">
        <div>
          <h2 id="visual-tuning-title">Scene tuning</h2>
          <p>
            {modifiedCount > 0
              ? `${modifiedCount} changed from default`
              : "Using scene defaults"}
          </p>
        </div>
        <div className="visual-tuning__actions">
          <button type="button" className="visual-tuning__action" onClick={onCopy}>
            Copy
          </button>
          <button type="button" className="visual-tuning__action" onClick={onPaste}>
            Paste
          </button>
          <button
            type="button"
            className="visual-tuning__action"
            onClick={onResetAll}
            disabled={modifiedCount === 0}
          >
            Reset
          </button>
        </div>
      </header>

      <input
        className="visual-tuning__filter"
        type="search"
        value={query}
        placeholder="Filter controls…"
        aria-label="Filter scene controls"
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      <span className="visual-tuning__status" aria-live="polite">
        {status}
      </span>

      <div className="visual-tuning__groups">
        {groups.length === 0 ? (
          <p className="visual-tuning__empty">No controls match “{query}”.</p>
        ) : null}
        {groups.map((group) => {
          const count = groupCount(group, inactive);
          return (
            <details
              className="tuning-group"
              key={group.id}
              open={normalizedQuery ? true : openGroups.has(group.id)}
              onToggle={(event) => {
                if (normalizedQuery) return;
                const open = event.currentTarget.open;
                setOpenGroups((current) => {
                  if (current.has(group.id) === open) return current;
                  const next = new Set(current);
                  if (open) next.add(group.id);
                  else next.delete(group.id);
                  return next;
                });
              }}
            >
              <summary>
                <span>{group.label}</span>
                <small title={count.title}>{count.label}</small>
                <span className="tuning-group__chevron" aria-hidden="true" />
              </summary>
              <div className="tuning-group__controls">
                {group.controls.map((control) => (
                  <TuningControl
                    key={control.key}
                    control={control}
                    value={tuning[control.key]}
                    draft={drafts[control.key]}
                    onChange={onChange}
                    onDraft={onDraft}
                    onCommitDraft={onCommitDraft}
                    onReset={onResetControl}
                    inactiveReason={inactive.get(control.key)}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
