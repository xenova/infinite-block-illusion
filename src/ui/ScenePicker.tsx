import { useState } from "react";

import { SceneRegistry, type SceneId } from "../scene/scenes";
import { toCssColor } from "../util/math";

type Props = {
  scene: SceneId;
  onSelect: (scene: SceneId) => void;
};

export function ScenePicker({ scene, onSelect }: Props) {
  const [hovered, setHovered] = useState<SceneId | null>(null);
  const [focused, setFocused] = useState<SceneId | null>(null);
  const active = SceneRegistry.get(scene) ?? SceneRegistry.default;
  const preview = SceneRegistry.get(hovered ?? focused ?? scene) ?? active;
  const previewing = preview.id !== active.id;

  return (
    <div className="scene-picker">
      <span className="scene-picker__eyebrow">{SceneRegistry.all.length} scenes</span>
      <span
        className="scene-picker__label"
        data-previewing={previewing ? "true" : "false"}
      >
        {preview.presentation.label}
      </span>
      <div
        className="scene-picker__swatches"
        role="radiogroup"
        aria-label="Choose scene"
      >
        {SceneRegistry.all.map((profile) => (
          <input
            key={profile.id}
            type="radio"
            name="scene"
            className="scene-picker__swatch"
            checked={scene === profile.id}
            style={{
              backgroundColor: toCssColor(profile.material.color),
              backgroundImage: `url(${SceneRegistry.previewUrl(profile)})`,
              backgroundBlendMode: "multiply",
            }}
            aria-label={`${profile.presentation.label} scene`}
            title={profile.presentation.label}
            onPointerEnter={() => setHovered(profile.id)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setFocused(profile.id)}
            onBlur={() => setFocused(null)}
            onChange={() => onSelect(profile.id)}
          />
        ))}
      </div>
    </div>
  );
}
