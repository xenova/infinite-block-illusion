import * as THREE from "three";

import { degToRad } from "../util/math";

export const LOOP_FRAMES = 227;
export const LOOP_SECONDS = LOOP_FRAMES / 30;

const SHEPARD_TIME_SCALE = 1.5;
export const SHEPARD_LOOP_SECONDS = LOOP_SECONDS * SHEPARD_TIME_SCALE;
const LAVA_TIME_SCALE = 2;
export const LAVA_LOOP_SECONDS = LOOP_SECONDS * LAVA_TIME_SCALE;

export const SCENE_TRANSITION_MS = 620;

// Presentation is capped without slowing the animation clock.
export const TARGET_FPS = 60;

export const MIN_RUNTIME_SPEED = 0.001;
export const MAX_RUNTIME_SPEED = 100;
export const MAX_SLIDER_SPEED = 4;
export const MIN_SPEED_SLIDER_VALUE = Math.log10(MIN_RUNTIME_SPEED);
export const MAX_SPEED_SLIDER_VALUE = Math.log10(MAX_SLIDER_SPEED);

export const REFERENCE_ASPECT = 1;
const PHI = (1 + Math.sqrt(5)) / 2;
export const INV_PHI = 1 / PHI;
export const CUBE_EDGE = 0.99;
export const VOID_BACKSTOP_DEPTH = 24;
export const CAMERA_FOV = 41.8;
export const CAMERA_ROLL = degToRad(14.88);

export const DROP_FRAMES = [37, 94, 150, 207] as const;

export const ROLL_IN_FRAMES = 44;
export const MIN_LEVEL = -18;
export const MAX_LEVEL = 7;

export const UP = new THREE.Vector3(0, 1, 0);

export const ROLL_DIRECTION = new THREE.Vector3(0, 0, 1);
export const ENTRY_SIDE = new THREE.Vector3(1, 0, 0);

export const ENTRY_PATHS = [
  { side: 1, depth: 4.35 },
  { side: -1, depth: 3.85 },
  { side: -1, depth: 3 },
  { side: -1, depth: 4.75 },
] as const;

export const ROLL_AXIS = new THREE.Vector3()
  .crossVectors(UP, ROLL_DIRECTION)
  .normalize();
export const CELL_CENTER = new THREE.Vector3(0.5 - PHI / 2, CUBE_EDGE / 2, 0);
export const CAVITY_CENTER = new THREE.Vector3(CELL_CENTER.x, 0, CELL_CENTER.z);

export const BASE_CAMERA_POSITION = new THREE.Vector3(4.2924, 5.683, -6.4209);
export const BASE_CAMERA_TARGET = new THREE.Vector3(-1.1, 0.35, 0.7375);

export const REAR_TURNS = 17;
export const REAR_TURN_RATIO = INV_PHI ** (4 / REAR_TURNS);

const CAVITY_STOP_OVERSCAN = 1.5;
export const CAVITY_STOP_DEPTH = (CUBE_EDGE + 0.015) * PHI;
export const CAVITY_STOP_RADIUS = Math.hypot(PHI, 1) / 2 + CAVITY_STOP_OVERSCAN;

export const SHADOW_MAP_SIZE = 1024;
export const SHADOW_SOFTNESS_REFERENCE_SIZE = 2048;

export const KEY_LIGHT_INTENSITY_SCALE = 0.32;
export const HEMISPHERE_LIGHT_INTENSITY_SCALE = 0.22;
export const AMBIENT_LIGHT_INTENSITY_SCALE = 0.13;
export const BLOOM_STRENGTH_SCALE = 0.55;
