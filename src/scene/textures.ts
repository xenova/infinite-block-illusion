import * as THREE from "three";

import { clamp, clamp01, lerp, mulberry32, positiveModulo, smootherstep } from "../util/math";

function create2dContext(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas 2D is unavailable");
  return { canvas, context };
}

function addTileableNoise(
  values: Float32Array,
  size: number,
  cells: number,
  amplitude: number,
  seed: number,
) {
  const random = mulberry32(seed);
  const nodes = new Float32Array(cells * cells);
  for (let index = 0; index < nodes.length; index += 1) nodes[index] = random() - 0.5;

  for (let y = 0; y < size; y += 1) {
    const gy = (y / size) * cells;
    const y0 = Math.floor(gy);
    const y1 = (y0 + 1) % cells;
    const yf = smootherstep(gy - y0);
    for (let x = 0; x < size; x += 1) {
      const gx = (x / size) * cells;
      const x0 = Math.floor(gx);
      const x1 = (x0 + 1) % cells;
      const xf = smootherstep(gx - x0);
      const a = lerp(nodes[y0 * cells + x0], nodes[y0 * cells + x1], xf);
      const b = lerp(nodes[y1 * cells + x0], nodes[y1 * cells + x1], xf);
      values[y * size + x] += lerp(a, b, yf) * amplitude;
    }
  }
}

const BACKDROP_SIZE = 720;
const DETAIL_MAP_SIZE = 512;

const AO_RADII = [2, 4, 7, 11] as const;
const AO_STRENGTH = 5.5;
const AO_SAMPLES_PER_RING = 8;
const DETAIL_MAP_MASK = DETAIL_MAP_SIZE - 1;
const AO_WEIGHTS = AO_RADII.map((radius) => 1 / radius);
const AO_WEIGHT_SUM = AO_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const AO_OFFSET_X = new Int8Array(AO_RADII.length * AO_SAMPLES_PER_RING);
const AO_OFFSET_Y = new Int8Array(AO_OFFSET_X.length);
for (let ring = 0; ring < AO_RADII.length; ring += 1) {
  for (let sample = 0; sample < AO_SAMPLES_PER_RING; sample += 1) {
    const offset = ring * AO_SAMPLES_PER_RING + sample;
    const radius = AO_RADII[ring];
    const angle = (sample / AO_SAMPLES_PER_RING) * Math.PI * 2;
    AO_OFFSET_X[offset] = Math.round(Math.cos(angle) * radius);
    AO_OFFSET_Y[offset] = Math.round(Math.sin(angle) * radius);
  }
}

function bakeAmbientOcclusion(
  context: CanvasRenderingContext2D,
  heights: Float32Array,
  strength: number,
) {
  const pixels = context.createImageData(DETAIL_MAP_SIZE, DETAIL_MAP_SIZE);
  for (let y = 0; y < DETAIL_MAP_SIZE; y += 1) {
    for (let x = 0; x < DETAIL_MAP_SIZE; x += 1) {
      const index = y * DETAIL_MAP_SIZE + x;
      const center = heights[index];
      let occlusion = 0;
      for (let ring = 0; ring < AO_RADII.length; ring += 1) {
        let ringMax = 0;
        const firstSample = ring * AO_SAMPLES_PER_RING;
        for (
          let sample = firstSample;
          sample < firstSample + AO_SAMPLES_PER_RING;
          sample += 1
        ) {
          const delta = heights[
            ((y + AO_OFFSET_Y[sample]) & DETAIL_MAP_MASK) * DETAIL_MAP_SIZE
              + ((x + AO_OFFSET_X[sample]) & DETAIL_MAP_MASK)
          ] - center;
          ringMax = Math.max(ringMax, delta);
        }
        occlusion += ringMax * AO_WEIGHTS[ring];
      }
      const value = Math.round(
        clamp(clamp01(1 - (occlusion / AO_WEIGHT_SUM) * strength) * 255, 40, 255),
      );
      const pixel = index * 4;
      pixels.data[pixel] = value;
      pixels.data[pixel + 1] = value;
      pixels.data[pixel + 2] = value;
      pixels.data[pixel + 3] = 255;
    }
  }
  return pixels;
}

function makeMapTexture(
  pixels: ImageData,
  textureScale: number,
  anisotropy: number,
) {
  const { canvas, context } = create2dContext(DETAIL_MAP_SIZE, DETAIL_MAP_SIZE);
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(textureScale, textureScale);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

export function makeBackdropTexture() {
  const size = BACKDROP_SIZE;
  const { canvas, context } = create2dContext(size, size);

  const field = new Float32Array(size * size);
  addTileableNoise(field, size, 6, 0.045, 4441);
  addTileableNoise(field, size, 20, 0.065, 4542);
  addTileableNoise(field, size, 64, 0.025, 4643);

  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = 128 + field[y * size + x] * 220;
      const pixel = (y * size + x) * 4;
      image.data[pixel] = clamp(value * 1.03 + 14, 0, 255);
      image.data[pixel + 1] = clamp(value * 0.78 + 9, 0, 255);
      image.data[pixel + 2] = clamp(value * 0.94 + 13, 0, 255);
      image.data[pixel + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const wash = context.createLinearGradient(0, 0, 0, size);
  wash.addColorStop(0, "rgba(235, 211, 224, .22)");
  wash.addColorStop(0.42, "rgba(127, 83, 110, .04)");
  wash.addColorStop(1, "rgba(37, 20, 40, .23)");
  context.fillStyle = wash;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

type SurfaceDetailMaps = {
  height: THREE.Texture;
  roughness: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
};

type DetailMapOptions = {
  reliefFromAlbedo: number;
  microDetail: number;
  microScale: number;
  roughnessBase: number;
  roughnessVariation: number;
};

export function makeSurfaceDetailMaps(
  source: CanvasImageSource,
  textureScale: number,
  anisotropy: number,
  options: DetailMapOptions,
): SurfaceDetailMaps {
  const size = DETAIL_MAP_SIZE;
  const { context: sourceContext } = create2dContext(size, size);
  sourceContext.drawImage(source, 0, 0, size, size);
  const sourcePixels = sourceContext.getImageData(0, 0, size, size);

  const luminance = new Float32Array(size * size);
  for (let index = 0; index < luminance.length; index += 1) {
    const pixel = index * 4;
    luminance[index] =
      sourcePixels.data[pixel] * 0.2126
      + sourcePixels.data[pixel + 1] * 0.7152
      + sourcePixels.data[pixel + 2] * 0.0722;
  }

  const micro = new Float32Array(size * size);
  addTileableNoise(micro, size, Math.max(8, Math.round(options.microScale / 6)), 0.55, 9311);
  addTileableNoise(micro, size, Math.max(16, Math.round(options.microScale / 2)), 0.3, 9377);
  addTileableNoise(micro, size, Math.max(32, options.microScale), 0.16, 9433);

  const heightPixels = sourceContext.createImageData(size, size);
  const roughnessPixels = sourceContext.createImageData(size, size);
  const normalPixels = sourceContext.createImageData(size, size);
  const heightField = new Float32Array(size * size);
  const wrappedIndex = (x: number, y: number) =>
    positiveModulo(y, size) * size + positiveModulo(x, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const center = luminance[index];
      const neighborhood =
        (luminance[wrappedIndex(x - 1, y)]
          + luminance[wrappedIndex(x + 1, y)]
          + luminance[wrappedIndex(x, y - 1)]
          + luminance[wrappedIndex(x, y + 1)])
        * 0.25;
      const highPass = center - neighborhood;
      const albedoRelief =
        (highPass * 3.15 + (center - 128) * 0.26) * options.reliefFromAlbedo;
      const microRelief = micro[index] * 255 * options.microDetail;
      const height = clamp(128 + albedoRelief + microRelief, 18, 238);

      const relief = (height - 128) / 110;
      const roughness = clamp01(
        options.roughnessBase - relief * options.roughnessVariation,
      ) * 255;

      const pixel = index * 4;
      heightField[index] = height / 255;
      heightPixels.data[pixel] = height;
      heightPixels.data[pixel + 1] = height;
      heightPixels.data[pixel + 2] = height;
      heightPixels.data[pixel + 3] = 255;
      roughnessPixels.data[pixel] = roughness;
      roughnessPixels.data[pixel + 1] = roughness;
      roughnessPixels.data[pixel + 2] = roughness;
      roughnessPixels.data[pixel + 3] = 255;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const dx = heightField[wrappedIndex(x + 1, y)] - heightField[wrappedIndex(x - 1, y)];
      const dy = heightField[wrappedIndex(x, y + 1)] - heightField[wrappedIndex(x, y - 1)];
      const nx = -dx * 3.2;
      const ny = dy * 3.2;
      const inverseLength = 1 / Math.hypot(nx, ny, 1);
      const pixel = index * 4;
      normalPixels.data[pixel] = Math.round((nx * inverseLength * 0.5 + 0.5) * 255);
      normalPixels.data[pixel + 1] = Math.round((ny * inverseLength * 0.5 + 0.5) * 255);
      normalPixels.data[pixel + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      normalPixels.data[pixel + 3] = 255;
    }
  }

  const aoPixels = bakeAmbientOcclusion(sourceContext, heightField, AO_STRENGTH);

  return {
    height: makeMapTexture(heightPixels, textureScale, anisotropy),
    roughness: makeMapTexture(roughnessPixels, textureScale, anisotropy),
    normal: makeMapTexture(normalPixels, textureScale, anisotropy),
    ao: makeMapTexture(aoPixels, textureScale, anisotropy),
  };
}

export function makeAmbientOcclusionFromDisplacement(
  displacement: CanvasImageSource,
  textureScale: number,
  anisotropy: number,
): THREE.Texture {
  const size = DETAIL_MAP_SIZE;
  const { context } = create2dContext(size, size);
  context.drawImage(displacement, 0, 0, size, size);
  const source = context.getImageData(0, 0, size, size);

  const heights = new Float32Array(size * size);
  for (let index = 0; index < heights.length; index += 1) {
    heights[index] = source.data[index * 4] / 255;
  }

  return makeMapTexture(
    bakeAmbientOcclusion(context, heights, AO_STRENGTH),
    textureScale,
    anisotropy,
  );
}
