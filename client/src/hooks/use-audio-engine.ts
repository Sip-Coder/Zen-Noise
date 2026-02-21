import { useRef, useEffect, useState, useCallback } from "react";

export type WaveIntensity = "off" | "low" | "medium" | "rain" | "coffee" | "thunder" | "wind" | "birds" | "campfire";

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
  const rainGainRef = useRef<GainNode | null>(null);
  const thunderGainRef = useRef<GainNode | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const campfireGainRef = useRef<GainNode | null>(null);
  const birdsGainRef = useRef<GainNode | null>(null);

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
    coffeeGain.connect(ctx.destination);

    // --- Rain Generation (High-passed White Noise) ---
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGainRef.current = rainGain;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 2000;
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = buffer; // Reuse brown buffer but high-pass it
    rainSource.loop = true;
    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(ctx.destination);
    rainSource.start();

    // --- Wind Generation (Low-passed Noise with Moving Filter) ---
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windGainRef.current = windGain;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 500;
    const windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSource.start();

    // --- Campfire Generation (Pinkish Noise + Cracks) ---
    const campfireGain = ctx.createGain();
    campfireGain.gain.value = 0;
    campfireGainRef.current = campfireGain;
    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = "lowpass";
    fireFilter.frequency.value = 1000;
    const fireSource = ctx.createBufferSource();
    fireSource.buffer = buffer;
    fireSource.loop = true;
    fireSource.connect(fireFilter);
    fireFilter.connect(campfireGain);
    campfireGain.connect(ctx.destination);
    fireSource.start();

    // --- Thunder/Birds (Logic handled in useEffect) ---
    const thunderGain = ctx.createGain();
    thunderGain.gain.value = 0;
    thunderGainRef.current = thunderGain;
    thunderGain.connect(ctx.destination);

    const birdsGain = ctx.createGain();
    birdsGain.gain.value = 0;
    birdsGainRef.current = birdsGain;
    birdsGain.connect(ctx.destination);

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
        title: "Zen Noise",
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

  useEffect(() => {
    const isOff = waveIntensity === ("off" as any);
    if (!isPlaying || isOff || !gainNodeRef.current || !audioContextRef.current) {
      // Reset all extra gains
      [coffeeGainRef, rainGainRef, windGainRef, campfireGainRef, thunderGainRef, birdsGainRef].forEach(ref => {
        if (ref.current && audioContextRef.current) {
          ref.current.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.5);
        }
      });

      if (gainNodeRef.current && audioContextRef.current) {
        gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
        gainNodeRef.current.gain.setTargetAtTime(1, audioContextRef.current.currentTime, 1);
      }
      return;
    }

    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;

    // Set Base Gains for active modes
    const now = ctx.currentTime;
    if (coffeeGainRef.current) coffeeGainRef.current.gain.setTargetAtTime(waveIntensity === "coffee" ? 0.1 : 0, now, 1);
    if (rainGainRef.current) rainGainRef.current.gain.setTargetAtTime(waveIntensity === "rain" ? 0.3 : 0, now, 1);
    if (windGainRef.current) windGainRef.current.gain.setTargetAtTime(waveIntensity === "wind" ? 0.2 : 0, now, 1);
    if (campfireGainRef.current) campfireGainRef.current.gain.setTargetAtTime(waveIntensity === "campfire" ? 0.15 : 0, now, 1);

    const scheduleWave = () => {
      if (ctx.state !== "running" || waveIntensity === ("off" as any)) return;

      const now = ctx.currentTime;
      const isDeep = waveIntensity === "medium";
      const isWind = waveIntensity === "wind";
      const duration = (isDeep || isWind) ? (8 + Math.random() * 6) : (6 + Math.random() * 8); 
      const depth = isDeep ? 0.7 : 0.3; 
      const filterDepth = isDeep ? 600 : 200;

      // Wave/Wind timing
      const peakTime = now + duration * 0.4;
      const troughTime = now + duration;

      if (isWind) {
        // Wind modulation (filter sweep)
        // @ts-ignore - filter node exists if wind source does
        const wf = windGainRef.current?.previousSibling as BiquadFilterNode;
        if (wf) {
          wf.frequency.exponentialRampToValueAtTime(200 + Math.random() * 800, peakTime);
          wf.frequency.exponentialRampToValueAtTime(200, troughTime);
        }
      } else {
        // Normal Ocean Waves
        gainNode.gain.exponentialRampToValueAtTime(1, peakTime);
        gainNode.gain.exponentialRampToValueAtTime(1 - depth, troughTime);

        if (filterRef.current) {
          filterRef.current.frequency.exponentialRampToValueAtTime(400 + filterDepth, peakTime);
          filterRef.current.frequency.exponentialRampToValueAtTime(400, troughTime);
        }
      }

      waveIntervalRef.current = window.setTimeout(scheduleWave, duration * 1000);
    };

    const scheduleThunder = () => {
      if (ctx.state !== "running" || waveIntensity !== "thunder") return;
      const now = ctx.currentTime;
      
      // Distant rumble
      const g = thunderGainRef.current;
      if (g) {
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.4, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + 4 + Math.random() * 4);
      }
      
      window.setTimeout(scheduleThunder, 20000 + Math.random() * 40000);
    };

    const scheduleCampfireCrackle = () => {
      if (ctx.state !== "running" || waveIntensity !== "campfire") return;
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(100 + Math.random() * 100, now);
      
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.01, now + 0.001);
      g.gain.linearRampToValueAtTime(0, now + 0.01);
      
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.01);
      
      window.setTimeout(scheduleCampfireCrackle, 100 + Math.random() * 2000);
    };

    const scheduleBirds = () => {
      if (ctx.state !== "running" || waveIntensity !== "birds") return;
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      const freq = 1500 + Math.random() * 1500;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq + 500, now + 0.1);
      
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.02, now + 0.02);
      g.gain.linearRampToValueAtTime(0, now + 0.2);
      
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
      
      window.setTimeout(scheduleBirds, 2000 + Math.random() * 8000);
    };

    scheduleWave();
    if (waveIntensity === "low" || waveIntensity === "medium") {
      const scheduleSeagull = () => {
        if (ctx.state !== "running" || (waveIntensity !== "low" && waveIntensity !== "medium")) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
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
        seagullIntervalRef.current = window.setTimeout(scheduleSeagull, 15000 + Math.random() * 45000);
      };
      scheduleSeagull();
    }
    
    if (waveIntensity === "thunder") scheduleThunder();
    if (waveIntensity === "campfire") scheduleCampfireCrackle();
    if (waveIntensity === "birds") scheduleBirds();

    return () => {
      if (waveIntervalRef.current) clearTimeout(waveIntervalRef.current);
      if (seagullIntervalRef.current) clearTimeout(seagullIntervalRef.current);
    };
  }, [isPlaying, waveIntensity, volume]);

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
