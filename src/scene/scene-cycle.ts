import { clamp01, positiveModulo } from "../util/math";
import { DROP_FRAMES, LOOP_FRAMES } from "./constants";

export const CYCLE_ROTATIONS = [0.25, 0.5, 0.75, 1] as const;

export type CycleRotations = (typeof CYCLE_ROTATIONS)[number];

export type SceneCycleOptions = Readonly<{
  enabled: boolean;
  rotations: CycleRotations;
  transition: number;
}>;

export type SceneCycleWindow = Readonly<{
  centerIndex: number;
  startFrame: number;
  centerFrame: number;
  endFrame: number;
}>;

/** Quiet choreography points halfway between each completed cube drop. */
const SWITCH_PHASES = Object.freeze(
  DROP_FRAMES.map((frame, index) => {
    const following = index === DROP_FRAMES.length - 1
      ? DROP_FRAMES[0] + LOOP_FRAMES
      : DROP_FRAMES[index + 1];
    return positiveModulo((frame + following) / 2, LOOP_FRAMES);
  }).sort((a, b) => a - b),
);

const switchFrameAt = (index: number) => {
  const cycle = Math.floor(index / SWITCH_PHASES.length);
  const phase = SWITCH_PHASES[positiveModulo(index, SWITCH_PHASES.length)];
  return cycle * LOOP_FRAMES + phase;
};

const cadenceSteps = (rotations: CycleRotations) =>
  Math.round(rotations * SWITCH_PHASES.length);

const nextSwitchIndexAfter = (timelineFrame: number) => {
  const cycle = Math.floor(timelineFrame / LOOP_FRAMES);
  const localFrame = timelineFrame - cycle * LOOP_FRAMES;
  const phaseIndex = SWITCH_PHASES.findIndex((phase) => phase > localFrame);
  return phaseIndex >= 0
    ? cycle * SWITCH_PHASES.length + phaseIndex
    : (cycle + 1) * SWITCH_PHASES.length;
};

/**
 * A transition is centered on a quiet point. At strength 0 it is an instant cut;
 * at strength 1 its edges meet the neighboring transition windows exactly, so
 * cycling becomes continuous without drifting away from the drop choreography.
 */
export function sceneCycleWindow(
  centerIndex: number,
  rotations: CycleRotations,
  transition: number,
): SceneCycleWindow {
  const steps = cadenceSteps(rotations);
  const strength = clamp01(transition);
  const previousCenter = switchFrameAt(centerIndex - steps);
  const centerFrame = switchFrameAt(centerIndex);
  const nextCenter = switchFrameAt(centerIndex + steps);
  return {
    centerIndex,
    startFrame: centerFrame - ((centerFrame - previousCenter) * strength) / 2,
    centerFrame,
    endFrame: centerFrame + ((nextCenter - centerFrame) * strength) / 2,
  };
}

/** The first complete window whose start has not already passed. */
export function nextSceneCycleWindow(
  timelineFrame: number,
  rotations: CycleRotations,
  transition: number,
): SceneCycleWindow {
  const steps = cadenceSteps(rotations);
  let centerIndex = nextSwitchIndexAfter(timelineFrame);
  let window = sceneCycleWindow(centerIndex, rotations, transition);
  while (window.startFrame <= timelineFrame) {
    centerIndex += steps;
    window = sceneCycleWindow(centerIndex, rotations, transition);
  }
  return window;
}

export function followingSceneCycleWindow(
  current: SceneCycleWindow,
  rotations: CycleRotations,
  transition: number,
) {
  return sceneCycleWindow(
    current.centerIndex + cadenceSteps(rotations),
    rotations,
    transition,
  );
}
