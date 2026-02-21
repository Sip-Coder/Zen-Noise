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
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const waveIntervalRef = useRef<number | null>(null);
  const coffeeGainRef = useRef<GainNode | null>(null);
  const seagullIntervalRef = useRef<number | null>(null);

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
    filterRef.current = lowPass;

    // --- Coffee Shop Chatter Generation (Filtered Brown/Pinkish Noise) ---
    const coffeeGain = ctx.createGain();
    coffeeGain.gain.value = 0; // Start muted
    coffeeGainRef.current = coffeeGain;

    const coffeeFilter = ctx.createBiquadFilter();
    coffeeFilter.type = "bandpass";
    coffeeFilter.frequency.value = 1000;
    coffeeFilter.Q.value = 0.5;

    // Reuse noise source for chatter base
    noiseSource.connect(coffeeFilter);
    coffeeFilter.connect(coffeeGain);
    coffeeGain.connect(ctx.destination); // Connect directly to destination to avoid master volume modulation of chatter if desired, or connect to masterGain

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
      const isDeep = waveIntensity === "medium";
      const duration = isDeep ? (8 + Math.random() * 6) : (6 + Math.random() * 8); 
      const depth = isDeep ? 0.7 : 0.3; 
      const filterDepth = isDeep ? 600 : 200;

      // Wave timing: slow build (crash) and slow recede
      const peakTime = now + duration * 0.4;
      const troughTime = now + duration;

      // Amplitude crash/recede
      gainNode.gain.exponentialRampToValueAtTime(1, peakTime);
      gainNode.gain.exponentialRampToValueAtTime(1 - depth, troughTime);

      // Filter modulation for "crashing" brightness
      if (filterRef.current) {
        filterRef.current.frequency.exponentialRampToValueAtTime(400 + filterDepth, peakTime);
        filterRef.current.frequency.exponentialRampToValueAtTime(400, troughTime);
      }

      // Sync coffee shop chatter volume (subtle rise with the waves)
      if (coffeeGainRef.current) {
        coffeeGainRef.current.gain.linearRampToValueAtTime(isDeep ? 0.05 : 0.02, peakTime);
        coffeeGainRef.current.gain.linearRampToValueAtTime(isDeep ? 0.02 : 0.01, troughTime);
      }

      waveIntervalRef.current = window.setTimeout(scheduleWave, duration * 1000);
    };

    const scheduleSeagull = () => {
      if (ctx.state !== "running" || waveIntensity === "off") return;
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      
      osc.type = "sine";
      // Seagull "cry" pitch sweep
      osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
      osc.frequency.exponentialRampToValueAtTime(1200 + Math.random() * 200, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
      
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.02, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.connect(g);
      g.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.6);
      
      const nextSeagull = 15000 + Math.random() * 45000; // Every 15-60 seconds
      seagullIntervalRef.current = window.setTimeout(scheduleSeagull, nextSeagull);
    };

    scheduleWave();
    scheduleSeagull();

    return () => {
      if (waveIntervalRef.current) clearTimeout(waveIntervalRef.current);
      if (seagullIntervalRef.current) clearTimeout(seagullIntervalRef.current);
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
