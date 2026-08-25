import { SHEPARD_LOOP_SECONDS } from "../scene/constants";
import { clamp, positiveModulo } from "../util/math";

const TWO_PI = Math.PI * 2;
const BASE_FREQUENCY = 63.063;
const STEP_COUNT = 12;
const SECOND_STRIKE_POSITION = 0.75;
const SECOND_STRIKE_GAIN = 0.78;
const SPECTRAL_CENTER = 330;
const SPECTRAL_SPREAD_OCTAVES = 1.58;
const STEREO_WIDTH = 0.22;
const NOTE_LENGTH_SECONDS = 0.22;
const ATTACK_SECONDS = 0.035;
const RELEASE_START_SECONDS = 0.13;
const LOW_PASS_FREQUENCY = 5_800;
const LOW_PASS_Q = 0.64;
const TARGET_RMS = 0.068;
const PEAK_CEILING = 0.4;

type StereoPhrase = {
  left: Float32Array;
  right: Float32Array;
};

type FilterCoefficients = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
};

export type SoundtrackController = {
  start: () => Promise<boolean>;
  stop: () => void;
  dispose: () => void;
};

function noteEnvelope(age: number) {
  if (age < ATTACK_SECONDS) {
    return 0.5 - 0.5 * Math.cos((Math.PI * age) / ATTACK_SECONDS);
  }
  if (age > RELEASE_START_SECONDS) {
    return (
      0.5
      + 0.5
        * Math.cos(
          (Math.PI * (age - RELEASE_START_SECONDS))
            / (NOTE_LENGTH_SECONDS - RELEASE_START_SECONDS),
        )
    );
  }
  return 1;
}

function makeRawPhrase(sampleRate: number, frameCount: number): StereoPhrase {
  const duration = frameCount / sampleRate;
  const stepDuration = duration / STEP_COUNT;
  const nyquistLimit = sampleRate * 0.48;
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);

  for (let step = 0; step < STEP_COUNT; step += 1) {
    const fundamental = BASE_FREQUENCY * 2 ** (step / STEP_COUNT);
    const voices: Array<{
      frequency: number;
      gain: number;
      leftGain: number;
      rightGain: number;
    }> = [];
    let gainEnergy = 0;
    for (let octave = -3; octave <= 8; octave += 1) {
      const frequency = fundamental * 2 ** octave;
      if (frequency < 18 || frequency >= nyquistLimit) continue;
      const gain = Math.exp(
        -0.5
          * (
            Math.log2(frequency / SPECTRAL_CENTER)
              / SPECTRAL_SPREAD_OCTAVES
          ) ** 2,
      );
      const spectralPosition = clamp(
        Math.log2(frequency / SPECTRAL_CENTER) / 3.75,
        -1,
        1,
      );
      const panAngle = ((spectralPosition * STEREO_WIDTH + 1) * Math.PI) / 4;
      voices.push({
        frequency,
        gain,
        leftGain: Math.cos(panAngle),
        rightGain: Math.sin(panAngle),
      });
      gainEnergy += gain * gain;
    }
    const voiceNormalization = 1 / Math.max(0.0001, Math.sqrt(gainEnergy));

    const strikes = [
      { offset: 0, gain: 1 },
      { offset: stepDuration * SECOND_STRIKE_POSITION, gain: SECOND_STRIKE_GAIN },
    ];
    for (const strike of strikes) {
      const startFrame = Math.round(
        (step * stepDuration + strike.offset) * sampleRate,
      );
      const noteFrames = Math.ceil(NOTE_LENGTH_SECONDS * sampleRate);
      for (let noteFrame = 0; noteFrame < noteFrames; noteFrame += 1) {
        const frame = positiveModulo(startFrame + noteFrame, frameCount);
        const age = noteFrame / sampleRate;
        const envelope = noteEnvelope(age) * voiceNormalization * strike.gain;
        for (const voice of voices) {
          const tone = Math.sin(TWO_PI * voice.frequency * age);
          const sample = tone * voice.gain * envelope;
          left[frame] += sample * voice.leftGain;
          right[frame] += sample * voice.rightGain;
        }
      }
    }
  }

  return { left, right };
}

function addCircularRoom(phrase: StereoPhrase, sampleRate: number): StereoPhrase {
  const length = phrase.left.length;
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const delay = (seconds: number) => Math.round(seconds * sampleRate);
  const taps = [
    { leftDelay: delay(0.041), rightDelay: delay(0.047), gain: 0.05, cross: false },
    { leftDelay: delay(0.079), rightDelay: delay(0.091), gain: 0.034, cross: true },
    { leftDelay: delay(0.139), rightDelay: delay(0.153), gain: 0.019, cross: false },
  ];

  for (let frame = 0; frame < length; frame += 1) {
    let leftSample = phrase.left[frame];
    let rightSample = phrase.right[frame];
    for (const tap of taps) {
      const leftIndex = positiveModulo(frame - tap.leftDelay, length);
      const rightIndex = positiveModulo(frame - tap.rightDelay, length);
      if (tap.cross) {
        leftSample += phrase.right[rightIndex] * tap.gain;
        rightSample += phrase.left[leftIndex] * tap.gain;
      } else {
        leftSample += phrase.left[leftIndex] * tap.gain;
        rightSample += phrase.right[rightIndex] * tap.gain;
      }
    }
    left[frame] = leftSample;
    right[frame] = rightSample;
  }
  return { left, right };
}

function lowPassCoefficients(sampleRate: number): FilterCoefficients {
  const omega = (TWO_PI * LOW_PASS_FREQUENCY) / sampleRate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * LOW_PASS_Q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - cosine) / 2) / a0,
    b1: (1 - cosine) / a0,
    b2: ((1 - cosine) / 2) / a0,
    a1: (-2 * cosine) / a0,
    a2: (1 - alpha) / a0,
  };
}

function filterPeriodicChannel(
  input: Float32Array,
  coefficients: FilterCoefficients,
) {
  const output = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  // Warm-up converges the IIR state to the same state it has while looping.
  for (let cycle = 0; cycle < 5; cycle += 1) {
    for (let frame = 0; frame < input.length; frame += 1) {
      const x0 = input[frame];
      const y0 =
        coefficients.b0 * x0
        + coefficients.b1 * x1
        + coefficients.b2 * x2
        - coefficients.a1 * y1
        - coefficients.a2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      if (cycle === 4) output[frame] = y0;
    }
  }
  return output;
}

function filterPhrase(phrase: StereoPhrase, sampleRate: number): StereoPhrase {
  const coefficients = lowPassCoefficients(sampleRate);
  return {
    left: filterPeriodicChannel(phrase.left, coefficients),
    right: filterPeriodicChannel(phrase.right, coefficients),
  };
}

function normalizePhrase(phrase: StereoPhrase) {
  let sumSquares = 0;
  let peak = 0;
  for (let frame = 0; frame < phrase.left.length; frame += 1) {
    const left = phrase.left[frame];
    const right = phrase.right[frame];
    sumSquares += left * left + right * right;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
  }
  const rms = Math.sqrt(sumSquares / (phrase.left.length * 2));
  const gain = Math.min(
    TARGET_RMS / Math.max(0.000001, rms),
    PEAK_CEILING / Math.max(0.000001, peak),
  );
  for (let frame = 0; frame < phrase.left.length; frame += 1) {
    phrase.left[frame] *= gain;
    phrase.right[frame] *= gain;
  }
}

function makeShepardBuffer(context: AudioContext) {
  const sampleRate = context.sampleRate;
  const frameCount = Math.round(sampleRate * SHEPARD_LOOP_SECONDS);
  const duration = frameCount / sampleRate;
  const raw = makeRawPhrase(sampleRate, frameCount);
  const phrase = filterPhrase(addCircularRoom(raw, sampleRate), sampleRate);
  normalizePhrase(phrase);

  const buffer = context.createBuffer(2, frameCount, sampleRate);
  buffer.getChannelData(0).set(phrase.left);
  buffer.getChannelData(1).set(phrase.right);

  return { buffer, duration };
}

/**
 * Playback is phase-locked to a wall-clock epoch fixed at creation, so muting
 * and unmuting resumes where the scale would have been rather than restarting.
 */
export function createShepardSoundtrack(): SoundtrackController {
  const epochMs = performance.now();
  let context: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let duration = SHEPARD_LOOP_SECONDS;
  let activeSource: AudioBufferSourceNode | null = null;
  let activeGain: GainNode | null = null;

  const stop = () => {
    if (!context || !activeSource || !activeGain) return;
    const source = activeSource;
    const gain = activeGain;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    source.stop(now + 0.2);
    activeSource = null;
    activeGain = null;
  };

  const start = async () => {
    try {
      if (activeSource) return true;
      if (!context || context.state === "closed") {
        context = new AudioContext({ latencyHint: "playback" });
      }
      if (context.state === "suspended") await context.resume();
      if (!buffer) {
        const soundtrack = makeShepardBuffer(context);
        buffer = soundtrack.buffer;
        duration = soundtrack.duration;
      }

      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = duration;
      source.connect(gain).connect(context.destination);

      const now = context.currentTime;
      const startAt = now + 0.02;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(1, now + 0.48);
      const elapsed = positiveModulo(
        (performance.now() + (startAt - now) * 1000 - epochMs) / 1000,
        duration,
      );
      source.start(startAt, elapsed);
      activeSource = source;
      activeGain = gain;
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      return true;
    } catch {
      return false;
    }
  };

  return {
    start,
    stop,
    dispose: () => {
      stop();
      void context?.close();
      context = null;
      buffer = null;
    },
  };
}
