import { useCallback, useEffect, useRef, useState } from "react";

export type WaveIntensity = "steady" | "gentle" | "deep";
export type AmbientSound = "rain" | "coffee" | "thunder" | "wind" | "birds" | "campfire" | "ring" | "purring" | "forest";

export const ALL_AMBIENTS: AmbientSound[] = ["rain", "coffee", "thunder", "wind", "birds", "campfire", "ring", "purring", "forest"];

export type AmbientVolumes = Record<AmbientSound, number>;

const DEFAULT_VOLUMES: AmbientVolumes = {
  rain: 0, coffee: 0, thunder: 0, wind: 0, birds: 0,
  campfire: 0, ring: 0, purring: 0, forest: 0,
};

const SAMPLE_SOURCES: Record<AmbientSound | "brown", string> = {
  brown: "/audio/brown-noise.ogg",
  rain: "/audio/rain.mp3",
  coffee: "/audio/coffee-shop.mp3",
  thunder: "/audio/thunderstorm.mp3",
  wind: "/audio/wind.mp3",
  birds: "/audio/birds.mp3",
  campfire: "/audio/campfire.mp3",
  ring: "/audio/tibetan-bowl.mp3",
  purring: "/audio/cat-purr.mp3",
  forest: "/audio/forest-leaves.mp3",
};

interface AudioEngineState {
  isPlaying: boolean;
  volume: number;
  waveIntensity: WaveIntensity;
  ambientVolumes: AmbientVolumes;
  togglePlay: () => void;
  setVolume: (vol: number) => void;
  setWaveIntensity: (intensity: WaveIntensity) => void;
  setAmbientVolume: (sound: AmbientSound, vol: number) => void;
  stopWithFade: (durationSec?: number) => void;
}
type SampleSound = AmbientSound | "brown";

interface SampleNode {
  gain: GainNode;
  buffer?: AudioBuffer;
  source?: AudioBufferSourceNode;
  loading?: Promise<void>;
}

interface ModulationProfile {
  cycleSeconds: number;
  starLift: number;
  starFloor: number;
  bedDuck: number;
  singleDepth: number;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getModulationProfile(intensity: WaveIntensity): ModulationProfile {
  if (intensity === "deep") {
    return {
      cycleSeconds: 7 + Math.random() * 4,
      starLift: 0.32,
      starFloor: 0.025,
      bedDuck: 0.18,
      singleDepth: 0.22,
    };
  }

  if (intensity === "gentle") {
    return {
      cycleSeconds: 8 + Math.random() * 4,
      starLift: 0.18,
      starFloor: 0.015,
      bedDuck: 0.1,
      singleDepth: 0.12,
    };
  }

  return {
    cycleSeconds: 10 + Math.random() * 5,
    starLift: 0.06,
    starFloor: 0.005,
    bedDuck: 0.03,
    singleDepth: 0.025,
  };
}

function holdGainAtCurrentValue(param: AudioParam, now: number) {
  const cancellable = param as AudioParam & { cancelAndHoldAtTime?: (time: number) => AudioParam };

  if (typeof cancellable.cancelAndHoldAtTime === "function") {
    cancellable.cancelAndHoldAtTime(now);
    return;
  }

  const current = Math.max(0.0001, param.value);
  param.cancelScheduledValues(now);
  param.setValueAtTime(current, now);
}

function starGainTarget(baseVolume: number, profile: ModulationProfile): number {
  return clampVolume(baseVolume * (1 + profile.starLift) + profile.starFloor);
}

function bedGainTarget(baseVolume: number, profile: ModulationProfile): number {
  return Math.max(0.0001, clampVolume(baseVolume * (1 - profile.bedDuck)));
}

function singleLayerLowTarget(baseVolume: number, profile: ModulationProfile): number {
  return Math.max(0.0001, clampVolume(baseVolume * (1 - profile.singleDepth)));
}

function normalizeAmbientVolumes(volumes?: Partial<AmbientVolumes>): AmbientVolumes {
  const next = { ...DEFAULT_VOLUMES };

  ALL_AMBIENTS.forEach((sound) => {
    if (volumes?.[sound] !== undefined) {
      next[sound] = clampVolume(Number(volumes[sound]));
    }
  });

  return next;
}

async function fetchAudioBuffer(ctx: AudioContext, sound: SampleSound): Promise<AudioBuffer> {
  try {
    const response = await fetch(SAMPLE_SOURCES[sound]);

    if (!response.ok) {
      throw new Error(`Failed to load ${sound} sample: ${response.status} ${response.statusText}`);
    }

    const audioData = await response.arrayBuffer();
    return await ctx.decodeAudioData(audioData);
  } catch (error) {
    if (sound === "brown") {
      console.warn("Using generated brown-noise fallback", error);
      return createBrownNoiseBuffer(ctx);
    }
    throw error;
  }
}

function createBrownNoiseBuffer(ctx: AudioContext, durationSeconds: number = 18): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    let lastOut = 0;

    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }

  return buffer;
}

export function useAudioEngine(initialVolume: number = 0.5, initialAmbientVolumes?: AmbientVolumes): AudioEngineState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(clampVolume(initialVolume));
  const [waveIntensity, setWaveIntensityState] = useState<WaveIntensity>("steady");
  const [ambientVolumes, setAmbientVolumes] = useState<AmbientVolumes>(() => normalizeAmbientVolumes(initialAmbientVolumes));

  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleNodesRef = useRef<Map<SampleSound, SampleNode>>(new Map());
  const modulationTimerRef = useRef<number | null>(null);
  const modulationIndexRef = useRef(0);
  const fadeTimeoutRef = useRef<number | null>(null);

  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const waveIntensityRef = useRef(waveIntensity);
  const ambientVolumesRef = useRef(ambientVolumes);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { waveIntensityRef.current = waveIntensity; }, [waveIntensity]);
  useEffect(() => { ambientVolumesRef.current = ambientVolumes; }, [ambientVolumes]);

  const getTargetVolume = useCallback((sound: SampleSound): number => {
    return sound === "brown" ? volumeRef.current : ambientVolumesRef.current[sound];
  }, []);

  const getActiveSampleSounds = useCallback((): SampleSound[] => {
    const activeSounds: SampleSound[] = [];

    ALL_AMBIENTS.forEach((sound) => {
      if (ambientVolumesRef.current[sound] > 0) activeSounds.push(sound);
    });

    if (volumeRef.current > 0) activeSounds.push("brown");

    return activeSounds;
  }, []);

  const getAudioContext = useCallback((): AudioContext => {
    if (audioContextRef.current) return audioContextRef.current;

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    audioContextRef.current = ctx;
    return ctx;
  }, []);

  const getSampleNode = useCallback((sound: SampleSound): SampleNode => {
    const existing = sampleNodesRef.current.get(sound);
    if (existing) return existing;

    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.gain.value = getTargetVolume(sound);
    gain.connect(ctx.destination);

    const node: SampleNode = { gain };
    sampleNodesRef.current.set(sound, node);
    return node;
  }, [getAudioContext, getTargetVolume]);

  const ensureSample = useCallback(async (sound: SampleSound): Promise<void> => {
    const ctx = getAudioContext();
    const node = getSampleNode(sound);

    if (node.source) return;
    if (node.loading) return node.loading;

    node.loading = fetchAudioBuffer(ctx, sound)
      .then((buffer) => {
        node.buffer = buffer;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(node.gain);
        source.start();
        node.source = source;
      })
      .catch((error) => {
        node.loading = undefined;
        console.error(error);
        throw error;
      });

    return node.loading;
  }, [getAudioContext, getSampleNode]);

  const clearModulationTimer = useCallback(() => {
    if (modulationTimerRef.current !== null) {
      window.clearTimeout(modulationTimerRef.current);
      modulationTimerRef.current = null;
    }
  }, []);

  const applyBrownGain = useCallback((target: number, rampSeconds: number = 0.12) => {
    const ctx = audioContextRef.current;
    const node = sampleNodesRef.current.get("brown");
    if (!ctx || !node) return;

    const now = ctx.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setTargetAtTime(clampVolume(target), now, rampSeconds);
  }, []);

  const scheduleLayerModulation = useCallback(() => {
    clearModulationTimer();

    const ctx = audioContextRef.current;
    if (!ctx || !isPlayingRef.current || getActiveSampleSounds().length === 0) return;

    const tick = () => {
      const liveCtx = audioContextRef.current;
      if (!liveCtx || !isPlayingRef.current || liveCtx.state !== "running") return;

      const activeSounds = getActiveSampleSounds().filter((sound) => {
        const node = sampleNodesRef.current.get(sound);
        return Boolean(node) && getTargetVolume(sound) > 0;
      });

      if (activeSounds.length === 0) {
        clearModulationTimer();
        return;
      }

      const profile = getModulationProfile(waveIntensityRef.current);
      const starSound = activeSounds[modulationIndexRef.current % activeSounds.length];
      modulationIndexRef.current = (modulationIndexRef.current + 1) % activeSounds.length;
      const now = liveCtx.currentTime;

      activeSounds.forEach((sound) => {
        const node = sampleNodesRef.current.get(sound);
        if (!node) return;

        const baseVolume = clampVolume(getTargetVolume(sound));
        const param = node.gain.gain;

        holdGainAtCurrentValue(param, now);

        if (activeSounds.length === 1) {
          const low = singleLayerLowTarget(baseVolume, profile);
          param.linearRampToValueAtTime(baseVolume, now + profile.cycleSeconds * 0.3);
          param.linearRampToValueAtTime(low, now + profile.cycleSeconds * 0.75);
          param.linearRampToValueAtTime(baseVolume, now + profile.cycleSeconds);
          return;
        }

        const target = sound === starSound
          ? starGainTarget(baseVolume, profile)
          : bedGainTarget(baseVolume, profile);

        param.linearRampToValueAtTime(target, now + profile.cycleSeconds * 0.32);
        param.linearRampToValueAtTime(target, now + profile.cycleSeconds * 0.68);
        param.linearRampToValueAtTime(baseVolume, now + profile.cycleSeconds);
      });

      modulationTimerRef.current = window.setTimeout(tick, profile.cycleSeconds * 1000);
    };

    tick();
  }, [clearModulationTimer, getActiveSampleSounds, getTargetVolume]);

  const applyAmbientGain = useCallback((sound: AmbientSound, target: number, rampSeconds: number = 0.1) => {
    const ctx = audioContextRef.current;
    const node = sampleNodesRef.current.get(sound);
    if (!ctx || !node) return;

    const now = ctx.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setTargetAtTime(clampVolume(target), now, rampSeconds);
  }, []);

  const resetGainsToCurrentState = useCallback(() => {
    applyBrownGain(volumeRef.current);
    ALL_AMBIENTS.forEach((sound) => applyAmbientGain(sound, ambientVolumesRef.current[sound]));
  }, [applyAmbientGain, applyBrownGain]);

  const togglePlay = async () => {
    const ctx = getAudioContext();

    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    try {
      if (volumeRef.current > 0) {
        await ensureSample("brown");
      }

      await Promise.all(
        ALL_AMBIENTS
          .filter((sound) => ambientVolumesRef.current[sound] > 0)
          .map((sound) => ensureSample(sound)),
      );

      resetGainsToCurrentState();

      if (ctx.state === "suspended" || !isPlayingRef.current) {
        await ctx.resume();
        isPlayingRef.current = true;
        setIsPlaying(true);
        scheduleLayerModulation();
      } else {
        isPlayingRef.current = false;
        clearModulationTimer();
        await ctx.suspend();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Audio playback could not start", error);
    }
  };

  const stopWithFade = (durationSec: number = 5) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    clearModulationTimer();

    const now = ctx.currentTime;
    sampleNodesRef.current.forEach((node) => {
      node.gain.gain.cancelScheduledValues(now);
      node.gain.gain.setValueAtTime(Math.max(0.0001, node.gain.gain.value), now);
      node.gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);
    });

    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
    }

    fadeTimeoutRef.current = window.setTimeout(() => {
      ctx.suspend();
      isPlayingRef.current = false;
      setIsPlaying(false);
      resetGainsToCurrentState();
    }, durationSec * 1000);
  };

  const setVolume = (newVol: number) => {
    const nextVol = clampVolume(newVol);
    setVolumeState(nextVol);
    volumeRef.current = nextVol;

    if (nextVol <= 0) {
      applyBrownGain(0);
      if (isPlayingRef.current) scheduleLayerModulation();
      return;
    }

    if (isPlayingRef.current) {
      ensureSample("brown")
        .then(() => {
          applyBrownGain(nextVol);
          scheduleLayerModulation();
        })
        .catch((error) => console.error("Could not load brown-noise sample", error));
    } else {
      applyBrownGain(nextVol);
    }
  };

  const setAmbientVolume = useCallback((sound: AmbientSound, vol: number) => {
    const nextVol = clampVolume(vol);
    setAmbientVolumes((prev) => ({ ...prev, [sound]: nextVol }));
    ambientVolumesRef.current = { ...ambientVolumesRef.current, [sound]: nextVol };

    if (nextVol > 0 && isPlayingRef.current) {
      ensureSample(sound)
        .then(() => {
          applyAmbientGain(sound, nextVol);
          scheduleLayerModulation();
        })
        .catch((error) => console.error(`Could not load ${sound} sample`, error));
    } else {
      applyAmbientGain(sound, nextVol);
      if (isPlayingRef.current) scheduleLayerModulation();
    }
  }, [applyAmbientGain, ensureSample, scheduleLayerModulation]);

  const setWaveIntensity = (val: WaveIntensity) => {
    setWaveIntensityState(val);
    waveIntensityRef.current = val;
    if (isPlayingRef.current && getActiveSampleSounds().length > 0) scheduleLayerModulation();
  };

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Zen Noise",
        artist: "Sleep Aid",
        album: "Focus & Rest",
        artwork: [
          { src: "/favicon.png", sizes: "192x192", type: "image/png" },
          { src: "/favicon.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.setActionHandler("play", () => togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => togglePlay());
      navigator.mediaSession.setActionHandler("stop", () => stopWithFade(1));
    }

    return () => {
      clearModulationTimer();
      if (fadeTimeoutRef.current !== null) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
      sampleNodesRef.current.forEach((node) => {
        try {
          node.source?.stop();
        } catch {}
      });
      audioContextRef.current?.close();
    };
    // Media Session should be registered once after the hook is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isPlayingRef.current && audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume().then(() => scheduleLayerModulation());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return {
    isPlaying,
    volume,
    waveIntensity,
    ambientVolumes,
    togglePlay,
    setVolume,
    setWaveIntensity,
    setAmbientVolume,
    stopWithFade,
  };
}
