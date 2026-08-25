import * as THREE from "three";

import { clamp01, lerp, positiveModulo, sineEase, smootherstep } from "../util/math";
import {
  CELL_CENTER,
  CUBE_EDGE,
  DROP_FRAMES,
  ENTRY_PATHS,
  ENTRY_SIDE,
  INV_PHI,
  LOOP_FRAMES,
  MAX_LEVEL,
  MIN_LEVEL,
  ROLL_AXIS,
  ROLL_DIRECTION,
  ROLL_IN_FRAMES,
  UP,
} from "./constants";

const SPAWN_LEAD_FRAMES = 57;

type Pose = {
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
};

type CameraStage = {
  base: number;
  elapsed: number;
  length: number;
  progress: number;
};

export function createPose(): Pose {
  return {
    position: new THREE.Vector3(),
    orientation: new THREE.Quaternion(),
  };
}

function copyPose(target: Pose, source: Pose) {
  target.position.copy(source.position);
  target.orientation.copy(source.orientation);
  return target;
}

const rollAxis = new THREE.Vector3();
const rollPivot = new THREE.Vector3();
const rollTurn = new THREE.Quaternion();
const rollOrientation = new THREE.Quaternion();

/**
 * Rotate `start` about the contact edge that lies `direction`-ward of it.
 * Safe to call with `out === start`.
 */
function quarterRollInto(
  out: Pose,
  start: Pose,
  direction: THREE.Vector3,
  angle: number,
): Pose {
  rollAxis.crossVectors(UP, direction).normalize();
  rollPivot
    .copy(start.position)
    .addScaledVector(direction, CUBE_EDGE / 2)
    .addScaledVector(UP, -CUBE_EDGE / 2);
  rollTurn.setFromAxisAngle(rollAxis, angle);
  rollOrientation.copy(rollTurn).multiply(start.orientation);
  out.position.copy(start.position).sub(rollPivot).applyQuaternion(rollTurn).add(rollPivot);
  out.orientation.copy(rollOrientation);
  return out;
}

const STEP_MATRIX = new THREE.Matrix4().compose(
  new THREE.Vector3(0.5, 0, 0),
  new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2),
  new THREE.Vector3(INV_PHI, INV_PHI, INV_PHI),
);
const INVERSE_STEP_MATRIX = STEP_MATRIX.clone().invert();

function matrixAtLevel(level: number) {
  const result = new THREE.Matrix4();
  const step = level >= 0 ? STEP_MATRIX : INVERSE_STEP_MATRIX;
  for (let index = 0; index < Math.abs(level); index += 1) result.multiply(step);
  return result;
}

const LEVEL_MATRICES: readonly THREE.Matrix4[] = Array.from(
  { length: MAX_LEVEL + 2 - MIN_LEVEL + 1 },
  (_, index) => matrixAtLevel(MIN_LEVEL + index),
);

// Returned matrices are shared and must not be mutated.
export function getLevelMatrix(level: number) {
  return LEVEL_MATRICES[level - MIN_LEVEL];
}

export function settledPoseInto(out: Pose): Pose {
  out.position.set(CELL_CENTER.x, -CUBE_EDGE / 2, CELL_CENTER.z);
  out.orientation.setFromAxisAngle(ROLL_AXIS, (3 * Math.PI) / 2);
  return out;
}

function mainDropFrame(level: number) {
  const shifted = level + 1;
  const phase = positiveModulo(shifted, 4);
  const cycle = Math.floor(shifted / 4);
  return DROP_FRAMES[phase] + cycle * LOOP_FRAMES;
}

const poseStart = createPose();
const poseSpawn = createPose();
const poseEntry = createPose();
const poseFirstLanding = createPose();
const poseFinalLanding = createPose();

export function mainCubeHasEntered(frame: number, level: number) {
  const age = frame - (mainDropFrame(level) - ROLL_IN_FRAMES);
  return age >= -SPAWN_LEAD_FRAMES;
}

export function sampleMainPoseInto(out: Pose, frame: number, level: number): Pose {
  const age = frame - (mainDropFrame(level) - ROLL_IN_FRAMES);

  poseStart.position
    .copy(CELL_CENTER)
    .addScaledVector(ROLL_DIRECTION, -3 * CUBE_EDGE);
  poseStart.orientation.identity();

  const path = ENTRY_PATHS[positiveModulo(level + 1, 4)];
  poseSpawn.position
    .copy(poseStart.position)
    .addScaledVector(ROLL_DIRECTION, -path.depth * CUBE_EDGE)
    .addScaledVector(ENTRY_SIDE, path.side * path.depth * CUBE_EDGE);
  poseSpawn.orientation.setFromAxisAngle(UP, (-path.side * Math.PI) / 2);

  if (age < -SPAWN_LEAD_FRAMES) return copyPose(out, poseSpawn);

  if (age < -12) {
    const progress = smootherstep(
      (age + SPAWN_LEAD_FRAMES) / (SPAWN_LEAD_FRAMES - 12),
    );
    out.position.copy(poseSpawn.position).lerp(poseStart.position, progress);
    out.orientation.copy(poseSpawn.orientation).slerp(poseStart.orientation, progress);
    return out;
  }

  if (age < 0) {
    const angle = sineEase((age + 12) / 12) * (Math.PI / 2);
    return quarterRollInto(out, poseStart, ROLL_DIRECTION, angle);
  }

  quarterRollInto(poseEntry, poseStart, ROLL_DIRECTION, Math.PI / 2);
  if (age < 19) {
    const angle = sineEase(age / 19) * (Math.PI / 2);
    return quarterRollInto(out, poseEntry, ROLL_DIRECTION, angle);
  }

  quarterRollInto(poseFirstLanding, poseEntry, ROLL_DIRECTION, Math.PI / 2);
  if (age < 27) return copyPose(out, poseFirstLanding);
  if (age < 37) {
    const angle = sineEase((age - 27) / 10) * (Math.PI / 2);
    return quarterRollInto(out, poseFirstLanding, ROLL_DIRECTION, angle);
  }

  quarterRollInto(poseFinalLanding, poseFirstLanding, ROLL_DIRECTION, Math.PI / 2);
  if (age < ROLL_IN_FRAMES) return copyPose(out, poseFinalLanding);

  if (age < 52) {
    copyPose(out, poseFinalLanding);
    out.position.y = lerp(
      CUBE_EDGE / 2,
      -CUBE_EDGE / 2,
      smootherstep((age - ROLL_IN_FRAMES) / 8),
    );
    return out;
  }

  return settledPoseInto(out);
}

export function createCameraStage(): CameraStage {
  return { base: 0, elapsed: 0, length: 0, progress: 0 };
}

/**
 * Most of the stage is a slow drift; the push happens during the cube's drop so
 * the recursion hand-off is hidden by the motion the viewer is already tracking.
 */
function cameraProgress(elapsed: number, length: number) {
  if (elapsed <= ROLL_IN_FRAMES) {
    return 0.39 * clamp01(elapsed / ROLL_IN_FRAMES);
  }
  if (elapsed <= 52) {
    return lerp(0.39, 0.97, smootherstep((elapsed - ROLL_IN_FRAMES) / 8));
  }
  return lerp(0.97, 1, smootherstep((elapsed - 52) / Math.max(1, length - 52)));
}

/** Which recursion level the camera is travelling through, and how far along. */
export function sampleCameraStageInto(out: CameraStage, frame: number): CameraStage {
  if (frame < 50) {
    out.base = -1;
    out.elapsed = frame + 7;
    out.length = 57;
  } else if (frame < 106) {
    out.base = 0;
    out.elapsed = frame - 50;
    out.length = 56;
  } else if (frame < 163) {
    out.base = 1;
    out.elapsed = frame - 106;
    out.length = 57;
  } else if (frame < 220) {
    out.base = 2;
    out.elapsed = frame - 163;
    out.length = 57;
  } else {
    out.base = 3;
    out.elapsed = frame - 220;
    out.length = 57;
  }
  out.progress = cameraProgress(out.elapsed, out.length);
  return out;
}

export function cameraEndpointInto(
  out: THREE.Vector3,
  level: number,
  basePosition: THREE.Vector3,
) {
  out.set(0, 0, 0).applyMatrix4(getLevelMatrix(level));
  return out.addScaledVector(basePosition, INV_PHI ** level);
}

const worldScale = new THREE.Vector3();

export function composeWorldMatrixInto(
  out: THREE.Matrix4,
  level: number,
  pose: Pose,
) {
  out.compose(pose.position, pose.orientation, worldScale.setScalar(CUBE_EDGE));
  return out.premultiply(getLevelMatrix(level));
}
