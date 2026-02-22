import { useRef, useEffect, useState, useCallback } from "react";

export type WaveIntensity = "steady" | "gentle" | "deep";
export type AmbientSound = "rain" | "coffee" | "thunder" | "wind" | "birds" | "campfire" | "chanting" | "purring" | "forest";

interface AudioEngineState {
  isPlaying: boolean;
  volume: number;
  waveIntensity: WaveIntensity;
  activeAmbients: AmbientSound[];
  togglePlay: () => void;
  setVolume: (vol: number) => void;
  setWaveIntensity: (intensity: WaveIntensity) => void;
  toggleAmbient: (sound: AmbientSound) => void;
  stopWithFade: (durationSec?: number) => void;
}

export function useAudioEngine(initialVolume: number = 0.5, initialAmbients: AmbientSound[] = []): AudioEngineState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(initialVolume);
  const [waveIntensity, setWaveIntensityState] = useState<WaveIntensity>("steady");
  const [activeAmbients, setActiveAmbients] = useState<AmbientSound[]>(initialAmbients);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const waveIntervalRef = useRef<number | null>(null);
  const ambientIntervalsRef = useRef<number[]>([]);

  const coffeeGainRef = useRef<GainNode | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const thunderGainRef = useRef<GainNode | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const campfireGainRef = useRef<GainNode | null>(null);
  const birdsGainRef = useRef<GainNode | null>(null);
  const chantingGainRef = useRef<GainNode | null>(null);
  const purringGainRef = useRef<GainNode | null>(null);
  const forestGainRef = useRef<GainNode | null>(null);

  const initAudio = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    audioContextRef.current = ctx;

    const bufferSize = ctx.sampleRate * 5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
      if (data[i] > 1) data[i] = 1;
      if (data[i] < -1) data[i] = -1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 400;
    filterRef.current = lowPass;

    const waveGain = ctx.createGain();
    waveGain.gain.value = 1.0;
    gainNodeRef.current = waveGain;

    const masterGain = ctx.createGain();
    masterGain.gain.value = initialVolume;
    masterGainRef.current = masterGain;

    noiseSource.connect(lowPass);
    lowPass.connect(waveGain);
    waveGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    // --- Coffee Shop (bandpass filtered noise) ---
    const coffeeGain = ctx.createGain();
    coffeeGain.gain.value = 0;
    coffeeGainRef.current = coffeeGain;
    const coffeeFilter = ctx.createBiquadFilter();
    coffeeFilter.type = "bandpass";
    coffeeFilter.frequency.value = 1000;
    coffeeFilter.Q.value = 0.5;
    noiseSource.connect(coffeeFilter);
    coffeeFilter.connect(coffeeGain);
    coffeeGain.connect(masterGain);

    // --- Rain (high-passed noise) ---
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGainRef.current = rainGain;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 2000;
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;
    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);
    rainSource.start();

    // --- Wind (low-passed noise) ---
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
    windGain.connect(masterGain);
    windSource.start();

    // --- Campfire (low-passed noise base) ---
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
    campfireGain.connect(masterGain);
    fireSource.start();

    // --- Forest (bandpass filtered noise) ---
    const forestGain = ctx.createGain();
    forestGain.gain.value = 0;
    forestGainRef.current = forestGain;
    const forestFilter = ctx.createBiquadFilter();
    forestFilter.type = "bandpass";
    forestFilter.frequency.value = 3000;
    forestFilter.Q.value = 0.3;
    const forestSource = ctx.createBufferSource();
    forestSource.buffer = buffer;
    forestSource.loop = true;
    forestSource.connect(forestFilter);
    forestFilter.connect(forestGain);
    forestGain.connect(masterGain);
    forestSource.start();

    // --- Thunder (gain node for scheduled rumbles) ---
    const thunderGain = ctx.createGain();
    thunderGain.gain.value = 0;
    thunderGainRef.current = thunderGain;
    const thunderSource = ctx.createBufferSource();
    thunderSource.buffer = buffer;
    thunderSource.loop = true;
    const thunderFilter = ctx.createBiquadFilter();
    thunderFilter.type = "lowpass";
    thunderFilter.frequency.value = 200;
    thunderSource.connect(thunderFilter);
    thunderFilter.connect(thunderGain);
    thunderGain.connect(masterGain);
    thunderSource.start();

    // --- Birds (gain node for scheduled chirps) ---
    const birdsGain = ctx.createGain();
    birdsGain.gain.value = 0;
    birdsGainRef.current = birdsGain;
    birdsGain.connect(masterGain);

    // --- Chanting (gain node for scheduled hums) ---
    const chantingGain = ctx.createGain();
    chantingGain.gain.value = 0;
    chantingGainRef.current = chantingGain;
    chantingGain.connect(masterGain);

    // --- Purring (gain node for scheduled purrs) ---
    const purringGain = ctx.createGain();
    purringGain.gain.value = 0;
    purringGainRef.current = purringGain;
    purringGain.connect(masterGain);

    noiseSource.start();

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Zen Noise",
        artist: "Sleep Aid",
        album: "Focus & Rest",
        artwork: [
          { src: "/favicon.png", sizes: "192x192", type: "image/png" },
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
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);
    setTimeout(() => {
      ctx.suspend();
      setIsPlaying(false);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
    }, durationSec * 1000);
  };

  const setVolume = (newVol: number) => {
    setVolumeState(newVol);
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setTargetAtTime(newVol, audioContextRef.current.currentTime, 0.1);
    }
  };

  // Wave intensity effect (brown noise modulation)
  useEffect(() => {
    if (!isPlaying || !gainNodeRef.current || !audioContextRef.current) return;
    const ctx = audioContextRef.current;

    const scheduleWave = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const isDeep = waveIntensity === "deep";
      const isGentle = waveIntensity === "gentle";
      const duration = isDeep ? (8 + Math.random() * 6) : (6 + Math.random() * 8);
      const depth = isDeep ? 0.7 : (isGentle ? 0.3 : 0.05);
      const filterDepth = isDeep ? 600 : (isGentle ? 200 : 30);
      const peakTime = now + duration * 0.4;
      const troughTime = now + duration;

      const gn = gainNodeRef.current;
      if (gn) {
        const currentVal = gn.gain.value || 0.01;
        gn.gain.setValueAtTime(Math.max(0.01, currentVal), now);
        gn.gain.linearRampToValueAtTime(1, peakTime);
        gn.gain.linearRampToValueAtTime(Math.max(0.01, 1 - depth), troughTime);
      }

      if (filterRef.current) {
        filterRef.current.frequency.setValueAtTime(filterRef.current.frequency.value || 400, now);
        filterRef.current.frequency.linearRampToValueAtTime(400 + filterDepth, peakTime);
        filterRef.current.frequency.linearRampToValueAtTime(400, troughTime);
      }
      waveIntervalRef.current = window.setTimeout(scheduleWave, duration * 1000);
    };

    scheduleWave();
    return () => {
      if (waveIntervalRef.current) clearTimeout(waveIntervalRef.current);
    };
  }, [isPlaying, waveIntensity]);

  // Ambient sounds effect (multi-select)
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current) {
      const allRefs = [coffeeGainRef, rainGainRef, windGainRef, campfireGainRef, thunderGainRef, birdsGainRef, chantingGainRef, purringGainRef, forestGainRef];
      allRefs.forEach(ref => {
        if (ref.current && audioContextRef.current) {
          ref.current.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.5);
        }
      });
      return;
    }

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const has = (s: AmbientSound) => activeAmbients.includes(s);

    // Continuous looping sounds - just set gain
    if (coffeeGainRef.current) coffeeGainRef.current.gain.setTargetAtTime(has("coffee") ? 0.08 : 0, now, 1);
    if (rainGainRef.current) rainGainRef.current.gain.setTargetAtTime(has("rain") ? 0.25 : 0, now, 1);
    if (windGainRef.current) windGainRef.current.gain.setTargetAtTime(has("wind") ? 0.15 : 0, now, 1);
    if (campfireGainRef.current) campfireGainRef.current.gain.setTargetAtTime(has("campfire") ? 0.12 : 0, now, 1);
    if (forestGainRef.current) forestGainRef.current.gain.setTargetAtTime(has("forest") ? 0.08 : 0, now, 1);

    // Clear previous scheduled ambient intervals
    ambientIntervalsRef.current.forEach(id => clearTimeout(id));
    ambientIntervalsRef.current = [];

    // Scheduled sounds (thunder rumbles, bird chirps, chanting hums, purring)
    if (has("thunder")) {
      const scheduleThunder = () => {
        if (ctx.state !== "running" || !activeAmbients.includes("thunder")) return;
        const g = thunderGainRef.current;
        if (g) {
          const t = ctx.currentTime;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.5, t + 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, t + 3 + Math.random() * 5);
        }
        const id = window.setTimeout(scheduleThunder, 15000 + Math.random() * 35000);
        ambientIntervalsRef.current.push(id);
      };
      scheduleThunder();
    } else if (thunderGainRef.current) {
      thunderGainRef.current.gain.setTargetAtTime(0, now, 0.5);
    }

    if (has("birds")) {
      const scheduleBird = () => {
        if (ctx.state !== "running" || !activeAmbients.includes("birds")) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        const freq = 1500 + Math.random() * 2000;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * (0.8 + Math.random() * 0.4), t + 0.15);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.02);
        g.gain.linearRampToValueAtTime(0, t + 0.25);
        osc.connect(g);
        g.connect(birdsGainRef.current || ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
        const id = window.setTimeout(scheduleBird, 1500 + Math.random() * 6000);
        ambientIntervalsRef.current.push(id);
      };
      if (birdsGainRef.current) birdsGainRef.current.gain.setTargetAtTime(1, now, 0.5);
      scheduleBird();
    } else if (birdsGainRef.current) {
      birdsGainRef.current.gain.setTargetAtTime(0, now, 0.5);
    }

    if (has("chanting")) {
      const scheduleChant = () => {
        if (ctx.state !== "running" || !activeAmbients.includes("chanting")) return;
        const t = ctx.currentTime;
        const baseFreq = 110; // Low A
        const harmonics = [1, 1.5, 2, 3];
        harmonics.forEach(h => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(baseFreq * h, t);
          osc.frequency.linearRampToValueAtTime(baseFreq * h * (1 + Math.random() * 0.02), t + 3);
          const vol = 0.03 / h;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(vol, t + 1.5);
          g.gain.linearRampToValueAtTime(0, t + 5);
          osc.connect(g);
          g.connect(chantingGainRef.current || ctx.destination);
          osc.start(t);
          osc.stop(t + 5.1);
        });
        const id = window.setTimeout(scheduleChant, 5000 + Math.random() * 2000);
        ambientIntervalsRef.current.push(id);
      };
      if (chantingGainRef.current) chantingGainRef.current.gain.setTargetAtTime(1, now, 0.5);
      scheduleChant();
    } else if (chantingGainRef.current) {
      chantingGainRef.current.gain.setTargetAtTime(0, now, 0.5);
    }

    if (has("purring")) {
      const schedulePurr = () => {
        if (ctx.state !== "running" || !activeAmbients.includes("purring")) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(25, t);
        const lpf = ctx.createBiquadFilter();
        lpf.type = "lowpass";
        lpf.frequency.value = 80;
        g.gain.setValueAtTime(0, t);
        for (let i = 0; i < 6; i++) {
          g.gain.linearRampToValueAtTime(0.08, t + i * 0.8 + 0.15);
          g.gain.linearRampToValueAtTime(0.02, t + i * 0.8 + 0.45);
        }
        g.gain.linearRampToValueAtTime(0, t + 5);
        osc.connect(lpf);
        lpf.connect(g);
        g.connect(purringGainRef.current || ctx.destination);
        osc.start(t);
        osc.stop(t + 5.1);
        const id = window.setTimeout(schedulePurr, 5200);
        ambientIntervalsRef.current.push(id);
      };
      if (purringGainRef.current) purringGainRef.current.gain.setTargetAtTime(1, now, 0.5);
      schedulePurr();
    } else if (purringGainRef.current) {
      purringGainRef.current.gain.setTargetAtTime(0, now, 0.5);
    }

    return () => {
      ambientIntervalsRef.current.forEach(id => clearTimeout(id));
      ambientIntervalsRef.current = [];
    };
  }, [isPlaying, activeAmbients]);

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

  const toggleAmbient = (sound: AmbientSound) => {
    setActiveAmbients(prev =>
      prev.includes(sound) ? prev.filter(s => s !== sound) : [...prev, sound]
    );
  };

  return {
    isPlaying,
    volume,
    waveIntensity,
    activeAmbients,
    togglePlay,
    setVolume,
    setWaveIntensity,
    toggleAmbient,
    stopWithFade,
  };
}
