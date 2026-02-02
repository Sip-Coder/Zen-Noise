import { useRef, useEffect, useState, useCallback } from "react";

export type WaveIntensity = "off" | "low" | "medium";

interface AudioEngineState {
  isPlaying: boolean;
  volume: number;
  waveIntensity: WaveIntensity;
  togglePlay: () => void;
  setVolume: (vol: number) => void;
  setWaveIntensity: (intensity: WaveIntensity) => void;
  stopWithFade: (durationSec?: number) => void;
}

export function useAudioEngine(initialVolume: number = 0.5): AudioEngineState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(initialVolume);
  const [waveIntensity, setWaveIntensityState] = useState<WaveIntensity>("off");

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const waveIntervalRef = useRef<number | null>(null);

  // Initialize Audio Context (lazy load on user gesture usually, but setup nodes)
  const initAudio = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    audioContextRef.current = ctx;

    // --- Brown Noise Generation ---
    // Create buffer
    const bufferSize = ctx.sampleRate * 5; // 5 seconds buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate white noise -> brown noise (leaky integrator)
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5; // Compensate for gain loss
      // Hard clip to prevent blowing speakers if it drifts
      if (data[i] > 1) data[i] = 1;
      if (data[i] < -1) data[i] = -1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // --- Processing Chain ---
    // Source -> LowPass -> Gain (Wave Modulation) -> Master Gain (Volume) -> Dest

    // LowPass Filter - smooth out the harshness
    const lowPass = ctx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 400; // Deep rumble

    // Gain Node for Wave Modulation (or just base noise)
    const waveGain = ctx.createGain();
    waveGain.gain.value = 1.0;
    gainNodeRef.current = waveGain;

    // Master Volume
    const masterGain = ctx.createGain();
    masterGain.gain.value = initialVolume;
    masterGainRef.current = masterGain;

    // Connect graph
    noiseSource.connect(lowPass);
    lowPass.connect(waveGain);
    waveGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    noiseSource.start();

    // Setup Media Session API
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Brown Noise",
        artist: "Sleep Aid",
        album: "Focus & Rest",
        artwork: [
          { src: "https://images.unsplash.com/photo-1517177579828-569d6c700cb7?w=512&q=80", sizes: "512x512", type: "image/jpeg" },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => togglePlay());
      navigator.mediaSession.setActionHandler("stop", () => stopWithFade(1));
    }

    return ctx;
  }, [initialVolume]);

  const togglePlay = async () => {
    const ctx = initAudio();

    if (ctx.state === "suspended") {
      await ctx.resume();
      setIsPlaying(true);
      
      // Handle background playback if needed (iOS often requires audio element hack, omitted for simplicity unless requested)
    } else if (ctx.state === "running") {
      await ctx.suspend();
      setIsPlaying(false);
    }
  };

  const stopWithFade = (durationSec: number = 5) => {
    if (!audioContextRef.current || !masterGainRef.current) return;
    
    const ctx = audioContextRef.current;
    const gain = masterGainRef.current;
    const now = ctx.currentTime;

    // Ramp down
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);

    setTimeout(() => {
      ctx.suspend();
      setIsPlaying(false);
      // Reset volume for next play
      gain.gain.setValueAtTime(volume, ctx.currentTime); 
    }, durationSec * 1000);
  };

  // Handle Volume Change
  const setVolume = (newVol: number) => {
    setVolumeState(newVol);
    if (masterGainRef.current && audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      masterGainRef.current.gain.setTargetAtTime(newVol, now, 0.1);
    }
  };

  // Ocean Wave Effect Logic
  useEffect(() => {
    if (!isPlaying || waveIntensity === "off" || !gainNodeRef.current || !audioContextRef.current) {
      // Reset to flat if off
      if (gainNodeRef.current && audioContextRef.current) {
        gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
        gainNodeRef.current.gain.setTargetAtTime(1, audioContextRef.current.currentTime, 1);
      }
      return;
    }

    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;

    const scheduleWave = () => {
      if (ctx.state !== "running") return;

      const now = ctx.currentTime;
      const duration = 6 + Math.random() * 8; // 6-14 seconds
      const depth = waveIntensity === "low" ? 0.2 : 0.4; // +/- 20% or 40%
      const target = 1 - (Math.random() * depth); // Dip volume down for "receding" wave

      // Ramp down (recede)
      gainNode.gain.linearRampToValueAtTime(target, now + duration / 2);
      // Ramp up (crash)
      gainNode.gain.linearRampToValueAtTime(1, now + duration);

      waveIntervalRef.current = window.setTimeout(scheduleWave, duration * 1000);
    };

    scheduleWave();

    return () => {
      if (waveIntervalRef.current) clearTimeout(waveIntervalRef.current);
    };
  }, [isPlaying, waveIntensity]);

  // Handle Visibility Change for background resume
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying && audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPlaying]);

  const setWaveIntensity = (val: WaveIntensity) => {
    setWaveIntensityState(val);
  };

  return {
    isPlaying,
    volume,
    waveIntensity,
    togglePlay,
    setVolume,
    setWaveIntensity,
    stopWithFade,
  };
}
