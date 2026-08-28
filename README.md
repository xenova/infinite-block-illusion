# Infinite Block Illusion

An endless geometric illusion of rolling cubes and recursive motion. Built with Three.js and WebGPU. Try the [demo](https://xenova-infinite-block-illusion.static.hf.space/).

<img width="600" height="600" alt="blocks" src="https://github.com/user-attachments/assets/090c9861-9ab6-4aff-8c4c-99cd6df681f2" />


## Commands

```bash
npm install
npm run dev      # Vite development server
npm run lint     # zero-warning source lint
npm run check    # strict TypeScript and lint
npm run build    # check, then production build to dist/
npm run preview  # serve dist/
```

## Scenes and controls

`SceneRegistry` fixes the public scene order and IDs:

`stone` (default), `metalpanel`, `glacier`, `lava`, `cobblestone`, `onyxteal`,
`geometrydash`, `bamboo`, `brick`, `patchwork`, `darkrock`, `checkertile`,
`weathered`, `obsidian`, `cliffside`, `onyxdark`, `parquet`, `heartwood`,
`leather`, `dune`, `moss`, `amber`, `marble`, `playa`, `copper`, `nacre`,
`rockwall`, `rustedsteel`, `walnut`, `metalplate`.



https://github.com/user-attachments/assets/76262000-d513-45ad-ae7a-05d25f80a48b



Texture sources are authored PBR maps or shared textures with generated detail
maps. Assets load eagerly, then each scene's shader pipeline is warmed before
the startup curtain clears. The scene tuning panel exposes 82 schema-driven controls:
camera 8, tone 10, lights 18, material 11, shadows 7, cavity 10, AO 10, bloom 3,
and lens 5.

The controls live in a dock fixed to the right edge. It slides in and out as one
piece over the square stage, which defaults to 1080×1080 and remains centred. The
Display control sets its target size while viewport fitting keeps it on screen;
opening the dock never moves or resizes the animation.

Shortcuts: Space plays/pauses, F shows or hides the dock, M toggles sound, and
Escape hides the dock.

## Project structure

- `src/main.tsx`: browser entry point.
- `src/App.tsx`: stage, loading screen, and control dock.
- `src/scene/illusion.ts`: composition root for the renderer, world, materials,
  transitions, and animation runtime.
- `src/scene/render-pipeline.ts`: WebGPU/WebGL renderer, camera,
  post-processing, resizing, shader warm-up, and disposal.
- `src/scene/world-controller.ts`: recursive geometry, cavity, lights, and
  atmosphere.
- `src/scene/material-texture-library.ts`: eager texture loading and scene
  materials.
- `src/scene/scenes.ts`: ordered scene registry and authored presets.
- `src/audio/`: generated Shepard-tone soundtrack.
- `src/hooks/`: React coordination for the renderer and tuning session.
- `src/tuning/`: control schema, availability, persistence, and tuning-data
  import/export.
- `src/ui/`: scene, playback, display, and tuning controls.
- `src/styles.css`: application layout and presentation.
- `public/textures/`: authored texture assets.

## Render budget

The render path uses `WebGPURenderer` for both graphics APIs, compiling the same
TSL graph to WGSL or GLSL. A single scene pass produces color, depth, and normals;
GTAO and depth of field reuse those attachments instead of rendering the world
again.

- The key-light shadow map is 1024². Softness is scaled against its original
  2048² tuning reference.
- Scene-driven AO and bloom stay compiled once enabled, avoiding shader rebuilds
  during transitions. Tuning-driven lens effects are removed when disabled.
- Every material pipeline is warmed against a 64² offscreen buffer before the
  first visible frame, then the post-processing targets are allocated at the
  selected display size.
- Presentation is capped near `TARGET_FPS` with a regular frame stride. The
  animation clock still advances continuously.
- Renderer antialiasing is disabled because the composed output is antialiased
  by SMAA.

## Acknowledgements

The scene design was inspired by [Artistoids](https://www.youtube.com/@Artistoids) and his [tutorials](https://www.youtube.com/watch?v=WuHpI6GJ18c) on YouTube!
