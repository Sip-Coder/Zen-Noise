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
  rain: "/audio/rain.ogg",
  coffee: "/audio/coffee-shop.ogg",
  thunder: "/audio/thunderstorm.ogg",
  wind: "/audio/wind.ogg",
  birds: "/audio/birds.ogg",
  campfire: "/audio/campfire.ogg",
  ring: "/audio/tibetan-bowl.ogg",
  purring: "/audio/cat-purr.ogg",
  forest: "/audio/forest-leaves.wav",
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

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
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
  const response = await fetch(SAMPLE_SOURCES[sound]);

  if (!response.ok) {
    throw new Error(`Failed to load ${sound} sample: ${response.status} ${response.statusText}`);
  }

  const audioData = await response.arrayBuffer();
  return await ctx.decodeAudioData(audioData);
}

export function useAudioEngine(initialVolume: number = 0.5, initialAmbientVolumes?: AmbientVolumes): AudioEngineState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(clampVolume(initialVolume));
  const [waveIntensity, setWaveIntensityState] = useState<WaveIntensity>("steady");
  const [ambientVolumes, setAmbientVolumes] = useState<AmbientVolumes>(() => normalizeAmbientVolumes(initialAmbientVolumes));

  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleNodesRef = useRef<Map<SampleSound, SampleNode>>(new Map());
  const waveIntervalRef = useRef<number | null>(null);
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

  const clearWaveTimer = useCallback(() => {
    if (waveIntervalRef.current !== null) {
      window.clearTimeout(waveIntervalRef.current);
      waveIntervalRef.current = null;
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

  const scheduleWave = useCallback(() => {
    clearWaveTimer();

    const ctx = audioContextRef.current;
    const node = sampleNodesRef.current.get("brown");
    if (!ctx || !node || !isPlayingRef.current) return;

    const tick = () => {
      if (!audioContextRef.current || !node || !isPlayingRef.current || audioContextRef.current.state !== "running") return;

      const baseVolume = volumeRef.current;
      const intensity = waveIntensityRef.current;
      const duration = intensity === "deep" ? 9 + Math.random() * 5 : 7 + Math.random() * 5;
      const depth = intensity === "deep" ? 0.42 : intensity === "gentle" ? 0.22 : 0.04;
      const now = audioContextRef.current.currentTime;
      const low = Math.max(0.01, baseVolume * (1 - depth));

      node.gain.gain.cancelScheduledValues(now);
      node.gain.gain.setValueAtTime(Math.max(0.001, node.gain.gain.value), now);
      node.gain.gain.linearRampToValueAtTime(baseVolume, now + duration * 0.45);
      node.gain.gain.linearRampToValueAtTime(low, now + duration);

      waveIntervalRef.current = window.setTimeout(tick, duration * 1000);
    };

    tick();
  }, [clearWaveTimer]);

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
      await ensureSample("brown");

      await Promise.all(
        ALL_AMBIENTS
          .filter((sound) => ambientVolumesRef.current[sound] > 0)
          .map((sound) => ensureSample(sound)),
      );

      resetGainsToCurrentState();

      if (ctx.state === "suspended" || !isPlayingRef.current) {
        await ctx.resume();
        setIsPlaying(true);
        scheduleWave();
      } else {
        clearWaveTimer();
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

    clearWaveTimer();

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
      setIsPlaying(false);
      resetGainsToCurrentState();
    }, durationSec * 1000);
  };

  const setVolume = (newVol: number) => {
    const nextVol = clampVolume(newVol);
    setVolumeState(nextVol);
    volumeRef.current = nextVol;
    applyBrownGain(nextVol);
  };

  const setAmbientVolume = useCallback((sound: AmbientSound, vol: number) => {
    const nextVol = clampVolume(vol);
    setAmbientVolumes((prev) => ({ ...prev, [sound]: nextVol }));
    ambientVolumesRef.current = { ...ambientVolumesRef.current, [sound]: nextVol };

    if (nextVol > 0 && isPlayingRef.current) {
      ensureSample(sound)
        .then(() => applyAmbientGain(sound, nextVol))
        .catch((error) => console.error(`Could not load ${sound} sample`, error));
    } else {
      applyAmbientGain(sound, nextVol);
    }
  }, [applyAmbientGain, ensureSample]);

  const setWaveIntensity = (val: WaveIntensity) => {
    setWaveIntensityState(val);
    waveIntensityRef.current = val;
    if (isPlayingRef.current) scheduleWave();
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
      clearWaveTimer();
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
        audioContextRef.current.resume();
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
