import { useRef, useEffect, useState, useCallback } from "react";

export type WaveIntensity = "steady" | "gentle" | "deep";
export type AmbientSound = "rain" | "coffee" | "thunder" | "wind" | "birds" | "campfire" | "chanting" | "purring" | "forest";

export const ALL_AMBIENTS: AmbientSound[] = ["rain", "coffee", "thunder", "wind", "birds", "campfire", "chanting", "purring", "forest"];

export type AmbientVolumes = Record<AmbientSound, number>;

const DEFAULT_VOLUMES: AmbientVolumes = {
  rain: 0, coffee: 0, thunder: 0, wind: 0, birds: 0,
  campfire: 0, chanting: 0, purring: 0, forest: 0,
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

function createWhiteNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const bufferSize = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return buffer;
}

function createBrownNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const bufferSize = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
      if (data[i] > 1) data[i] = 1;
      if (data[i] < -1) data[i] = -1;
    }
  }
  return buffer;
}

function createPinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const bufferSize = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buffer;
}

export function useAudioEngine(initialVolume: number = 0.5, initialAmbientVolumes?: AmbientVolumes): AudioEngineState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(initialVolume);
  const [waveIntensity, setWaveIntensityState] = useState<WaveIntensity>("steady");
  const [ambientVolumes, setAmbientVolumes] = useState<AmbientVolumes>({ ...DEFAULT_VOLUMES, ...initialAmbientVolumes });

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const waveIntervalRef = useRef<number | null>(null);
  const ambientIntervalsRef = useRef<Map<string, number[]>>(new Map());

  const ambientGainsRef = useRef<Record<AmbientSound, GainNode | null>>({
    rain: null, coffee: null, thunder: null, wind: null, birds: null,
    campfire: null, chanting: null, purring: null, forest: null,
  });

  const ambientUserGainsRef = useRef<Record<AmbientSound, GainNode | null>>({
    rain: null, coffee: null, thunder: null, wind: null, birds: null,
    campfire: null, chanting: null, purring: null, forest: null,
  });

  const ambientVolumesRef = useRef(ambientVolumes);
  useEffect(() => { ambientVolumesRef.current = ambientVolumes; }, [ambientVolumes]);

  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const initAudio = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    audioContextRef.current = ctx;

    const brownBuffer = createBrownNoiseBuffer(ctx, 5);
    const whiteBuffer = createWhiteNoiseBuffer(ctx, 4);
    const pinkBuffer = createPinkNoiseBuffer(ctx, 4);

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = brownBuffer;
    noiseSource.loop = true;

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 400;
    filterRef.current = lowPass;

    const waveGain = ctx.createGain();
    waveGain.gain.value = 1.0;
    gainNodeRef.current = waveGain;

    const masterGain = ctx.createGain();
    masterGain.gain.value = volumeRef.current;
    masterGainRef.current = masterGain;

    noiseSource.connect(lowPass);
    lowPass.connect(waveGain);
    waveGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    const createAmbientChannel = (sound: AmbientSound): GainNode => {
      const userGain = ctx.createGain();
      userGain.gain.value = ambientVolumesRef.current[sound];
      ambientUserGainsRef.current[sound] = userGain;

      const mixGain = ctx.createGain();
      mixGain.gain.value = 1.0;
      ambientGainsRef.current[sound] = mixGain;

      mixGain.connect(userGain);
      userGain.connect(ctx.destination);
      return mixGain;
    };

    // === RAIN: Filtered white noise with gentle volume modulation ===
    const rainMix = createAmbientChannel("rain");
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = whiteBuffer;
    rainSrc.loop = true;
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = "highpass";
    rainHP.frequency.value = 800;
    const rainLP = ctx.createBiquadFilter();
    rainLP.type = "lowpass";
    rainLP.frequency.value = 8000;
    const rainBP = ctx.createBiquadFilter();
    rainBP.type = "peaking";
    rainBP.frequency.value = 3000;
    rainBP.gain.value = 4;
    rainBP.Q.value = 0.5;
    rainSrc.connect(rainHP);
    rainHP.connect(rainLP);
    rainLP.connect(rainBP);
    rainBP.connect(rainMix);
    rainSrc.start();
    const rainSrc2 = ctx.createBufferSource();
    rainSrc2.buffer = pinkBuffer;
    rainSrc2.loop = true;
    const rainLP2 = ctx.createBiquadFilter();
    rainLP2.type = "lowpass";
    rainLP2.frequency.value = 2000;
    const rainG2 = ctx.createGain();
    rainG2.gain.value = 0.3;
    rainSrc2.connect(rainLP2);
    rainLP2.connect(rainG2);
    rainG2.connect(rainMix);
    rainSrc2.start();

    // === COFFEE: Improved murmur and clinks ===
    const coffeeMix = createAmbientChannel("coffee");
    const coffeeMurmurSrc = ctx.createBufferSource();
    coffeeMurmurSrc.buffer = pinkBuffer;
    coffeeMurmurSrc.loop = true;
    const coffeeLP = ctx.createBiquadFilter();
    coffeeLP.type = "lowpass";
    coffeeLP.frequency.value = 1200;
    const coffeeHP = ctx.createBiquadFilter();
    coffeeHP.type = "highpass";
    coffeeHP.frequency.value = 200;
    const coffeeMurmurGain = ctx.createGain();
    coffeeMurmurGain.gain.value = 0.7;
    coffeeMurmurSrc.connect(coffeeLP);
    coffeeLP.connect(coffeeHP);
    coffeeHP.connect(coffeeMurmurGain);
    coffeeMurmurGain.connect(coffeeMix);
    coffeeMurmurSrc.start();

    // === WIND: Low-frequency filtered noise with slow modulation ===
    const windMix = createAmbientChannel("wind");
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = whiteBuffer;
    windSrc.loop = true;
    const windLP = ctx.createBiquadFilter();
    windLP.type = "lowpass";
    windLP.frequency.value = 600;
    const windLP2 = ctx.createBiquadFilter();
    windLP2.type = "lowpass";
    windLP2.frequency.value = 400;
    windSrc.connect(windLP);
    windLP.connect(windLP2);
    windLP2.connect(windMix);
    windSrc.start();
    const windSrc2 = ctx.createBufferSource();
    windSrc2.buffer = pinkBuffer;
    windSrc2.loop = true;
    const windBP = ctx.createBiquadFilter();
    windBP.type = "bandpass";
    windBP.frequency.value = 1200;
    windBP.Q.value = 0.3;
    const windLeafGain = ctx.createGain();
    windLeafGain.gain.value = 0.15;
    windSrc2.connect(windBP);
    windBP.connect(windLeafGain);
    windLeafGain.connect(windMix);
    windSrc2.start();

    // === FOREST: Improved canopy and rustle ===
    const forestMix = createAmbientChannel("forest");
    const forestCanopySrc = ctx.createBufferSource();
    forestCanopySrc.buffer = pinkBuffer;
    forestCanopySrc.loop = true;
    const forestLP = ctx.createBiquadFilter();
    forestLP.type = "lowpass";
    forestLP.frequency.value = 1500;
    const forestCanopyGain = ctx.createGain();
    forestCanopyGain.gain.value = 0.4;
    forestCanopySrc.connect(forestLP);
    forestLP.connect(forestCanopyGain);
    forestCanopyGain.connect(forestMix);
    forestCanopySrc.start();

    // === CAMPFIRE: Improved crackle and rumble ===
    const fireMix = createAmbientChannel("campfire");
    const fireRumbleSrc = ctx.createBufferSource();
    fireRumbleSrc.buffer = brownBuffer;
    fireRumbleSrc.loop = true;
    const fireLP = ctx.createBiquadFilter();
    fireLP.type = "lowpass";
    fireLP.frequency.value = 500;
    const fireRumbleGain = ctx.createGain();
    fireRumbleGain.gain.value = 0.3;
    fireRumbleSrc.connect(fireLP);
    fireLP.connect(fireRumbleGain);
    fireRumbleGain.connect(fireMix);
    fireRumbleSrc.start();

    // === THUNDER: Improved rumbling ===
    const thunderMix = createAmbientChannel("thunder");
    const thunderRumbleSrc = ctx.createBufferSource();
    thunderRumbleSrc.buffer = brownBuffer;
    thunderRumbleSrc.loop = true;
    const thunderLP = ctx.createBiquadFilter();
    thunderLP.type = "lowpass";
    thunderLP.frequency.value = 100;
    const thunderGain = ctx.createGain();
    thunderGain.gain.value = 0.4;
    thunderRumbleSrc.connect(thunderLP);
    thunderLP.connect(thunderGain);
    thunderGain.connect(thunderMix);
    thunderRumbleSrc.start();

    // === BIRDS: Oscillator-based (scheduled in effect) ===
    createAmbientChannel("birds");

    // === CHANTING: Oscillator-based (scheduled in effect) ===
    createAmbientChannel("chanting");

    // === PURRING: Oscillator-based (scheduled in effect) ===
    createAmbientChannel("purring");

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
  }, []);

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

    ALL_AMBIENTS.forEach(s => {
      const ug = ambientUserGainsRef.current[s];
      if (ug) {
        ug.gain.cancelScheduledValues(now);
        ug.gain.setValueAtTime(ug.gain.value, now);
        ug.gain.linearRampToValueAtTime(0, now + durationSec);
      }
    });

    setTimeout(() => {
      ctx.suspend();
      setIsPlaying(false);
      gain.gain.setValueAtTime(volumeRef.current, ctx.currentTime);
      ALL_AMBIENTS.forEach(s => {
        const ug = ambientUserGainsRef.current[s];
        if (ug) ug.gain.setValueAtTime(ambientVolumesRef.current[s], ctx.currentTime);
      });
    }, durationSec * 1000);
  };

  const setVolume = (newVol: number) => {
    setVolumeState(newVol);
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setTargetAtTime(newVol, audioContextRef.current.currentTime, 0.1);
    }
  };

  const setAmbientVolume = useCallback((sound: AmbientSound, vol: number) => {
    setAmbientVolumes(prev => ({ ...prev, [sound]: vol }));
    const ug = ambientUserGainsRef.current[sound];
    if (ug && audioContextRef.current) {
      ug.gain.setTargetAtTime(vol, audioContextRef.current.currentTime, 0.1);
    }
  }, []);

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

  // Wind modulation effect
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.wind === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.wind;
    if (!mixGain) return;

    const scheduleGust = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const dur = 4 + Math.random() * 8;
      const peak = 0.6 + Math.random() * 0.4;
      const base = 0.2 + Math.random() * 0.3;
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(peak, now + dur * 0.4);
      mixGain.gain.linearRampToValueAtTime(base, now + dur);
      const id = window.setTimeout(scheduleGust, dur * 1000);
      const ids = ambientIntervalsRef.current.get("wind") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("wind", ids);
    };
    scheduleGust();

    return () => {
      (ambientIntervalsRef.current.get("wind") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("wind", []);
    };
  }, [isPlaying, ambientVolumes.wind > 0]);

  // Rain modulation effect
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.rain === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.rain;
    if (!mixGain) return;

    const scheduleRainSwell = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const dur = 6 + Math.random() * 10;
      const peak = 0.7 + Math.random() * 0.3;
      const base = 0.3 + Math.random() * 0.2;
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(peak, now + dur * 0.5);
      mixGain.gain.linearRampToValueAtTime(base, now + dur);
      const id = window.setTimeout(scheduleRainSwell, dur * 1000);
      const ids = ambientIntervalsRef.current.get("rain") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("rain", ids);
    };
    scheduleRainSwell();

    return () => {
      (ambientIntervalsRef.current.get("rain") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("rain", []);
    };
  }, [isPlaying, ambientVolumes.rain > 0]);

  // Campfire crackle modulation
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.campfire === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.campfire;
    if (!mixGain) return;

    const scheduleCrackle = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const dur = 2 + Math.random() * 4;
      const peak = 0.6 + Math.random() * 0.4;
      const base = 0.3 + Math.random() * 0.2;
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(peak, now + 0.1 + Math.random() * 0.3);
      mixGain.gain.linearRampToValueAtTime(base, now + dur);
      const id = window.setTimeout(scheduleCrackle, dur * 1000);
      const ids = ambientIntervalsRef.current.get("campfire") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("campfire", ids);
    };
    scheduleCrackle();

    return () => {
      (ambientIntervalsRef.current.get("campfire") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("campfire", []);
    };
  }, [isPlaying, ambientVolumes.campfire > 0]);

  // Thunder rumbles - random loud strikes
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.thunder === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.thunder;
    if (!mixGain) return;

    mixGain.gain.setValueAtTime(0.1, ctx.currentTime);

    const scheduleStrike = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const intensity = 0.4 + Math.random() * 0.6;
      const rumbleDur = 2 + Math.random() * 6;
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(intensity, now + 0.05 + Math.random() * 0.2);
      mixGain.gain.linearRampToValueAtTime(intensity * 0.4, now + rumbleDur * 0.3);
      if (Math.random() > 0.5) {
        mixGain.gain.linearRampToValueAtTime(intensity * 0.7, now + rumbleDur * 0.5);
      }
      mixGain.gain.linearRampToValueAtTime(0.05, now + rumbleDur);
      const nextDelay = 8000 + Math.random() * 25000;
      const id = window.setTimeout(scheduleStrike, nextDelay);
      const ids = ambientIntervalsRef.current.get("thunder") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("thunder", ids);
    };
    const initialId = window.setTimeout(scheduleStrike, 2000 + Math.random() * 5000);
    ambientIntervalsRef.current.set("thunder", [initialId]);

    return () => {
      (ambientIntervalsRef.current.get("thunder") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("thunder", []);
    };
  }, [isPlaying, ambientVolumes.thunder > 0]);

  // Birds - individual chirps with varied patterns
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.birds === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.birds;
    if (!mixGain) return;

    const scheduleChirpGroup = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const numChirps = 2 + Math.floor(Math.random() * 4);
      const baseFreq = 2000 + Math.random() * 2500;

      for (let c = 0; c < numChirps; c++) {
        const chirpStart = now + c * (0.12 + Math.random() * 0.15);
        const chirpDur = 0.06 + Math.random() * 0.12;
        const freq = baseFreq * (0.85 + Math.random() * 0.3);
        const endFreq = freq * (0.7 + Math.random() * 0.6);

        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, chirpStart);
        osc.frequency.linearRampToValueAtTime(endFreq, chirpStart + chirpDur);
        g.gain.setValueAtTime(0, chirpStart);
        g.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.03, chirpStart + chirpDur * 0.15);
        g.gain.setValueAtTime(0.04 + Math.random() * 0.02, chirpStart + chirpDur * 0.7);
        g.gain.linearRampToValueAtTime(0, chirpStart + chirpDur);
        osc.connect(g);
        g.connect(mixGain);
        osc.start(chirpStart);
        osc.stop(chirpStart + chirpDur + 0.01);
      }

      if (Math.random() > 0.6) {
        const trillStart = now + numChirps * 0.2 + Math.random() * 0.3;
        const trillDur = 0.3 + Math.random() * 0.4;
        const trillFreq = 3000 + Math.random() * 2000;
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 20 + Math.random() * 15;
        lfoGain.gain.value = trillFreq * 0.05;
        lfo.connect(lfoGain);
        lfoGain.connect(osc2.frequency);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(trillFreq, trillStart);
        g2.gain.setValueAtTime(0, trillStart);
        g2.gain.linearRampToValueAtTime(0.025, trillStart + 0.05);
        g2.gain.setValueAtTime(0.02, trillStart + trillDur * 0.8);
        g2.gain.linearRampToValueAtTime(0, trillStart + trillDur);
        osc2.connect(g2);
        g2.connect(mixGain);
        osc2.start(trillStart);
        osc2.stop(trillStart + trillDur + 0.01);
        lfo.start(trillStart);
        lfo.stop(trillStart + trillDur + 0.01);
      }

      const nextDelay = 1200 + Math.random() * 4000;
      const id = window.setTimeout(scheduleChirpGroup, nextDelay);
      const ids = ambientIntervalsRef.current.get("birds") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("birds", ids);
    };
    scheduleChirpGroup();

    return () => {
      (ambientIntervalsRef.current.get("birds") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("birds", []);
    };
  }, [isPlaying, ambientVolumes.birds > 0]);

  // Chanting - Tibetan bowl + vocal drone
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.chanting === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.chanting;
    if (!mixGain) return;

    const scheduleBowlAndChant = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      const bowlFreq = [293.66, 329.63, 392, 440, 523.25][Math.floor(Math.random() * 5)];
      const bowlDur = 6 + Math.random() * 4;
      const harmonics = [1, 2.76, 4.72, 6.83];
      harmonics.forEach((h, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(bowlFreq * h, now);
        const vol = 0.04 / (idx + 1);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.3);
        g.gain.setValueAtTime(vol * 0.8, now + bowlDur * 0.3);
        g.gain.linearRampToValueAtTime(0, now + bowlDur);
        osc.connect(g);
        g.connect(mixGain);
        osc.start(now);
        osc.stop(now + bowlDur + 0.1);
      });

      if (Math.random() > 0.4) {
        const droneStart = now + 1 + Math.random() * 2;
        const droneDur = 4 + Math.random() * 3;
        const droneFreq = [110, 130.81, 146.83, 164.81][Math.floor(Math.random() * 4)];
        [1, 1.5, 2, 3].forEach((h, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(droneFreq * h, droneStart);
          osc.frequency.linearRampToValueAtTime(droneFreq * h * (1 + Math.random() * 0.015), droneStart + droneDur);
          const vol = 0.025 / (idx + 1);
          g.gain.setValueAtTime(0, droneStart);
          g.gain.linearRampToValueAtTime(vol, droneStart + droneDur * 0.3);
          g.gain.linearRampToValueAtTime(vol * 0.9, droneStart + droneDur * 0.7);
          g.gain.linearRampToValueAtTime(0, droneStart + droneDur);
          osc.connect(g);
          g.connect(mixGain);
          osc.start(droneStart);
          osc.stop(droneStart + droneDur + 0.1);
        });
      }

      const nextDelay = 5000 + Math.random() * 4000;
      const id = window.setTimeout(scheduleBowlAndChant, nextDelay);
      const ids = ambientIntervalsRef.current.get("chanting") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("chanting", ids);
    };
    scheduleBowlAndChant();

    return () => {
      (ambientIntervalsRef.current.get("chanting") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("chanting", []);
    };
  }, [isPlaying, ambientVolumes.chanting > 0]);

  // Purring - rhythmic low-frequency oscillation
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.purring === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.purring;
    if (!mixGain) return;

    const schedulePurrCycle = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const cycleDur = 4 + Math.random() * 2;
      const numPulses = Math.floor(cycleDur / 0.6);

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 100;

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(25 + Math.random() * 3, now);

      g.gain.setValueAtTime(0, now);
      for (let i = 0; i < numPulses; i++) {
        const t = now + i * 0.6;
        g.gain.linearRampToValueAtTime(0.12, t + 0.12);
        g.gain.linearRampToValueAtTime(0.03, t + 0.35);
      }
      g.gain.linearRampToValueAtTime(0, now + cycleDur);

      osc.connect(lpf);
      lpf.connect(g);
      g.connect(mixGain);
      osc.start(now);
      osc.stop(now + cycleDur + 0.1);

      const gap = Math.random() > 0.7 ? 1 + Math.random() * 2 : 0.3;
      const id = window.setTimeout(schedulePurrCycle, (cycleDur + gap) * 1000);
      const ids = ambientIntervalsRef.current.get("purring") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("purring", ids);
    };
    schedulePurrCycle();

    return () => {
      (ambientIntervalsRef.current.get("purring") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("purring", []);
    };
  }, [isPlaying, ambientVolumes.purring > 0]);

  // Coffee shop modulation (clinks, murmurs, footsteps)
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.coffee === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.coffee;
    if (!mixGain) return;

    const scheduleCoffeeEvent = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const rand = Math.random();

      if (rand > 0.6) {
        // Clink
        const clinkFreq = 2500 + Math.random() * 4000;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(clinkFreq, now);
        osc.frequency.exponentialRampToValueAtTime(clinkFreq * 0.8, now + 0.1);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.01 + Math.random() * 0.015, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(g);
        g.connect(mixGain);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (rand > 0.3) {
        // Footstep/Murmur swell
        const swellDur = 0.5 + Math.random() * 1.5;
        const peak = 0.4 + Math.random() * 0.4;
        mixGain.gain.cancelScheduledValues(now);
        mixGain.gain.setValueAtTime(mixGain.gain.value, now);
        mixGain.gain.linearRampToValueAtTime(peak, now + swellDur * 0.4);
        mixGain.gain.linearRampToValueAtTime(0.2, now + swellDur);
      }

      const id = window.setTimeout(scheduleCoffeeEvent, 500 + Math.random() * 3000);
      const ids = ambientIntervalsRef.current.get("coffee") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("coffee", ids);
    };
    scheduleCoffeeEvent();

    return () => {
      (ambientIntervalsRef.current.get("coffee") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("coffee", []);
    };
  }, [isPlaying, ambientVolumes.coffee > 0]);

  // Forest modulation (leaf rustles and wind in trees)
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.forest === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.forest;
    if (!mixGain) return;

    const scheduleForestEvent = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      if (Math.random() > 0.5) {
        // Rustle
        const osc = ctx.createBufferSource();
        osc.buffer = createPinkNoiseBuffer(ctx, 0.5);
        const g = ctx.createGain();
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 2000 + Math.random() * 2000;
        bp.Q.value = 0.5;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.1, now + 0.1);
        g.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.connect(bp);
        bp.connect(g);
        g.connect(mixGain);
        osc.start(now);
      }

      const id = window.setTimeout(scheduleForestEvent, 2000 + Math.random() * 5000);
      const ids = ambientIntervalsRef.current.get("forest") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("forest", ids);
    };
    scheduleForestEvent();

    return () => {
      (ambientIntervalsRef.current.get("forest") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("forest", []);
    };
  }, [isPlaying, ambientVolumes.forest > 0]);

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
    ambientVolumes,
    togglePlay,
    setVolume,
    setWaveIntensity,
    setAmbientVolume,
    stopWithFade,
  };
}
