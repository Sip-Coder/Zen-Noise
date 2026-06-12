import { useRef, useEffect, useState, useCallback } from "react";

export type WaveIntensity = "steady" | "gentle" | "deep";
export type AmbientSound = "rain" | "coffee" | "thunder" | "wind" | "birds" | "campfire" | "ring" | "purring" | "forest";

export const ALL_AMBIENTS: AmbientSound[] = ["rain", "coffee", "thunder", "wind", "birds", "campfire", "ring", "purring", "forest"];

export type AmbientVolumes = Record<AmbientSound, number>;

const DEFAULT_VOLUMES: AmbientVolumes = {
  rain: 0, coffee: 0, thunder: 0, wind: 0, birds: 0,
  campfire: 0, ring: 0, purring: 0, forest: 0,
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

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

type NoiseColor = "white" | "pink" | "brown";

interface FilterSpec {
  type: BiquadFilterType;
  frequency: number;
  q?: number;
  gain?: number;
}

interface NoiseBurstOptions {
  startTime: number;
  duration: number;
  peak: number;
  attack?: number;
  noise?: NoiseColor;
  filters?: FilterSpec[];
  pan?: number;
}

function createNoiseBuffer(ctx: AudioContext, color: NoiseColor, seconds: number): AudioBuffer {
  if (color === "brown") return createBrownNoiseBuffer(ctx, seconds);
  if (color === "pink") return createPinkNoiseBuffer(ctx, seconds);
  return createWhiteNoiseBuffer(ctx, seconds);
}

function connectWithPan(ctx: AudioContext, node: AudioNode, destination: AudioNode, pan: number = 0) {
  if (typeof ctx.createStereoPanner === "function" && Math.abs(pan) > 0.01) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(panner);
    panner.connect(destination);
    return;
  }
  node.connect(destination);
}

function scheduleNoiseBurst(ctx: AudioContext, destination: AudioNode, options: NoiseBurstOptions) {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, options.noise ?? "white", Math.max(0.05, options.duration + 0.05));

  let tail: AudioNode = source;
  options.filters?.forEach((spec) => {
    const filter = ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.frequency;
    if (spec.q !== undefined) filter.Q.value = spec.q;
    if (spec.gain !== undefined) filter.gain.value = spec.gain;
    tail.connect(filter);
    tail = filter;
  });

  const gain = ctx.createGain();
  const attack = options.attack ?? Math.min(0.02, options.duration * 0.25);
  const start = options.startTime;
  const end = start + options.duration;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(options.peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  tail.connect(gain);
  connectWithPan(ctx, gain, destination, options.pan ?? 0);
  source.start(start);
  source.stop(end + 0.05);
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
    campfire: null, ring: null, purring: null, forest: null,
  });

  const ambientUserGainsRef = useRef<Record<AmbientSound, GainNode | null>>({
    rain: null, coffee: null, thunder: null, wind: null, birds: null,
    campfire: null, ring: null, purring: null, forest: null,
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

    // === RAIN: Gentle rain shower - layered filtered noise for realistic patter ===
    const rainMix = createAmbientChannel("rain");
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = whiteBuffer;
    rainSrc.loop = true;
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = "highpass";
    rainHP.frequency.value = 1000;
    const rainLP = ctx.createBiquadFilter();
    rainLP.type = "lowpass";
    rainLP.frequency.value = 6000;
    const rainPeak = ctx.createBiquadFilter();
    rainPeak.type = "peaking";
    rainPeak.frequency.value = 2500;
    rainPeak.gain.value = 3;
    rainPeak.Q.value = 0.4;
    const rainG1 = ctx.createGain();
    rainG1.gain.value = 0.5;
    rainSrc.connect(rainHP);
    rainHP.connect(rainLP);
    rainLP.connect(rainPeak);
    rainPeak.connect(rainG1);
    rainG1.connect(rainMix);
    rainSrc.start();
    const rainSrc2 = ctx.createBufferSource();
    rainSrc2.buffer = pinkBuffer;
    rainSrc2.loop = true;
    const rainLP2 = ctx.createBiquadFilter();
    rainLP2.type = "lowpass";
    rainLP2.frequency.value = 1800;
    const rainG2 = ctx.createGain();
    rainG2.gain.value = 0.35;
    rainSrc2.connect(rainLP2);
    rainLP2.connect(rainG2);
    rainG2.connect(rainMix);
    rainSrc2.start();
    const rainSrc3 = ctx.createBufferSource();
    rainSrc3.buffer = brownBuffer;
    rainSrc3.loop = true;
    const rainLP3 = ctx.createBiquadFilter();
    rainLP3.type = "lowpass";
    rainLP3.frequency.value = 300;
    const rainG3 = ctx.createGain();
    rainG3.gain.value = 0.15;
    rainSrc3.connect(rainLP3);
    rainLP3.connect(rainG3);
    rainG3.connect(rainMix);
    rainSrc3.start();

    // === COFFEE: Background chatter murmur + ambient hum ===
    const coffeeMix = createAmbientChannel("coffee");
    const coffeeSrc1 = ctx.createBufferSource();
    coffeeSrc1.buffer = pinkBuffer;
    coffeeSrc1.loop = true;
    const coffeeLP1 = ctx.createBiquadFilter();
    coffeeLP1.type = "lowpass";
    coffeeLP1.frequency.value = 1400;
    const coffeeHP1 = ctx.createBiquadFilter();
    coffeeHP1.type = "highpass";
    coffeeHP1.frequency.value = 180;
    const coffeePeak = ctx.createBiquadFilter();
    coffeePeak.type = "peaking";
    coffeePeak.frequency.value = 600;
    coffeePeak.gain.value = 3;
    coffeePeak.Q.value = 0.6;
    const coffeeG1 = ctx.createGain();
    coffeeG1.gain.value = 0.55;
    coffeeSrc1.connect(coffeeHP1);
    coffeeHP1.connect(coffeeLP1);
    coffeeLP1.connect(coffeePeak);
    coffeePeak.connect(coffeeG1);
    coffeeG1.connect(coffeeMix);
    coffeeSrc1.start();
    const coffeeSrc2 = ctx.createBufferSource();
    coffeeSrc2.buffer = brownBuffer;
    coffeeSrc2.loop = true;
    const coffeeLP2 = ctx.createBiquadFilter();
    coffeeLP2.type = "lowpass";
    coffeeLP2.frequency.value = 400;
    const coffeeG2 = ctx.createGain();
    coffeeG2.gain.value = 0.2;
    coffeeSrc2.connect(coffeeLP2);
    coffeeLP2.connect(coffeeG2);
    coffeeG2.connect(coffeeMix);
    coffeeSrc2.start();

    // === WIND: Gentle breeze with leaf rustle ===
    const windMix = createAmbientChannel("wind");
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = pinkBuffer;
    windSrc.loop = true;
    const windLP = ctx.createBiquadFilter();
    windLP.type = "lowpass";
    windLP.frequency.value = 800;
    const windLP2 = ctx.createBiquadFilter();
    windLP2.type = "lowpass";
    windLP2.frequency.value = 500;
    const windG1 = ctx.createGain();
    windG1.gain.value = 0.6;
    windSrc.connect(windLP);
    windLP.connect(windLP2);
    windLP2.connect(windG1);
    windG1.connect(windMix);
    windSrc.start();
    const windSrc2 = ctx.createBufferSource();
    windSrc2.buffer = whiteBuffer;
    windSrc2.loop = true;
    const windBP = ctx.createBiquadFilter();
    windBP.type = "bandpass";
    windBP.frequency.value = 2000;
    windBP.Q.value = 0.2;
    const windG2 = ctx.createGain();
    windG2.gain.value = 0.08;
    windSrc2.connect(windBP);
    windBP.connect(windG2);
    windG2.connect(windMix);
    windSrc2.start();

    // === FOREST: Calm canopy ambience with subtle depth ===
    const forestMix = createAmbientChannel("forest");
    const forestSrc1 = ctx.createBufferSource();
    forestSrc1.buffer = pinkBuffer;
    forestSrc1.loop = true;
    const forestLP1 = ctx.createBiquadFilter();
    forestLP1.type = "lowpass";
    forestLP1.frequency.value = 2000;
    const forestBP = ctx.createBiquadFilter();
    forestBP.type = "peaking";
    forestBP.frequency.value = 1200;
    forestBP.gain.value = 2;
    forestBP.Q.value = 0.3;
    const forestG1 = ctx.createGain();
    forestG1.gain.value = 0.4;
    forestSrc1.connect(forestLP1);
    forestLP1.connect(forestBP);
    forestBP.connect(forestG1);
    forestG1.connect(forestMix);
    forestSrc1.start();
    const forestSrc2 = ctx.createBufferSource();
    forestSrc2.buffer = brownBuffer;
    forestSrc2.loop = true;
    const forestLP2 = ctx.createBiquadFilter();
    forestLP2.type = "lowpass";
    forestLP2.frequency.value = 350;
    const forestG2 = ctx.createGain();
    forestG2.gain.value = 0.15;
    forestSrc2.connect(forestLP2);
    forestLP2.connect(forestG2);
    forestG2.connect(forestMix);
    forestSrc2.start();

    // === CAMPFIRE: Low rumble base for crackling overlay ===
    const fireMix = createAmbientChannel("campfire");
    const fireSrc1 = ctx.createBufferSource();
    fireSrc1.buffer = brownBuffer;
    fireSrc1.loop = true;
    const fireLP1 = ctx.createBiquadFilter();
    fireLP1.type = "lowpass";
    fireLP1.frequency.value = 600;
    const fireG1 = ctx.createGain();
    fireG1.gain.value = 0.3;
    fireSrc1.connect(fireLP1);
    fireLP1.connect(fireG1);
    fireG1.connect(fireMix);
    fireSrc1.start();
    const fireSrc2 = ctx.createBufferSource();
    fireSrc2.buffer = pinkBuffer;
    fireSrc2.loop = true;
    const fireHP = ctx.createBiquadFilter();
    fireHP.type = "highpass";
    fireHP.frequency.value = 1500;
    const fireLP2 = ctx.createBiquadFilter();
    fireLP2.type = "lowpass";
    fireLP2.frequency.value = 5000;
    const fireG2 = ctx.createGain();
    fireG2.gain.value = 0.12;
    fireSrc2.connect(fireHP);
    fireHP.connect(fireLP2);
    fireLP2.connect(fireG2);
    fireG2.connect(fireMix);
    fireSrc2.start();

    // === THUNDER: Deep rumble base for strike overlay ===
    const thunderMix = createAmbientChannel("thunder");
    const thunderSrc1 = ctx.createBufferSource();
    thunderSrc1.buffer = brownBuffer;
    thunderSrc1.loop = true;
    const thunderLP1 = ctx.createBiquadFilter();
    thunderLP1.type = "lowpass";
    thunderLP1.frequency.value = 80;
    const thunderG1 = ctx.createGain();
    thunderG1.gain.value = 0.35;
    thunderSrc1.connect(thunderLP1);
    thunderLP1.connect(thunderG1);
    thunderG1.connect(thunderMix);
    thunderSrc1.start();
    const thunderSrc2 = ctx.createBufferSource();
    thunderSrc2.buffer = pinkBuffer;
    thunderSrc2.loop = true;
    const thunderLP2 = ctx.createBiquadFilter();
    thunderLP2.type = "lowpass";
    thunderLP2.frequency.value = 200;
    const thunderG2 = ctx.createGain();
    thunderG2.gain.value = 0.15;
    thunderSrc2.connect(thunderLP2);
    thunderLP2.connect(thunderG2);
    thunderG2.connect(thunderMix);
    thunderSrc2.start();

    // === BIRDS: Oscillator-based chirps (scheduled in effect) ===
    createAmbientChannel("birds");

    // === RING: Tibetan singing bowl (scheduled in effect) ===
    createAmbientChannel("ring");

    // === PURRING: Cat purr oscillator (scheduled in effect) ===
    createAmbientChannel("purring");

    noiseSource.start();

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

  // Rain modulation - gentle shower swells with occasional drip bursts
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.rain === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.rain;
    if (!mixGain) return;

    const scheduleRainEvent = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const dur = 8 + Math.random() * 12;
      const peak = 0.6 + Math.random() * 0.35;
      const base = 0.25 + Math.random() * 0.15;
      mixGain.gain.cancelScheduledValues(now);
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(peak, now + dur * 0.4);
      mixGain.gain.linearRampToValueAtTime(base, now + dur);

      const dropCount = 5 + Math.floor(Math.random() * 10);
      for (let i = 0; i < dropCount; i++) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now + randomBetween(0.4, dur - 0.4),
          duration: randomBetween(0.035, 0.14),
          peak: randomBetween(0.012, 0.045),
          attack: randomBetween(0.002, 0.008),
          noise: "white",
          filters: [
            { type: "highpass", frequency: randomBetween(900, 1800) },
            { type: "bandpass", frequency: randomBetween(2300, 5400), q: randomBetween(0.7, 1.8) },
          ],
          pan: randomBetween(-0.85, 0.85),
        });
      }

      if (Math.random() > 0.65) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now + randomBetween(1, dur - 1),
          duration: randomBetween(0.16, 0.32),
          peak: randomBetween(0.035, 0.07),
          attack: 0.01,
          noise: "pink",
          filters: [
            { type: "bandpass", frequency: randomBetween(450, 1100), q: randomBetween(0.7, 1.2) },
            { type: "lowpass", frequency: randomBetween(1800, 2600) },
          ],
          pan: randomBetween(-0.55, 0.55),
        });
      }

      const id = window.setTimeout(scheduleRainEvent, dur * 1000);
      const ids = ambientIntervalsRef.current.get("rain") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("rain", ids);
    };
    scheduleRainEvent();

    return () => {
      (ambientIntervalsRef.current.get("rain") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("rain", []);
    };
  }, [isPlaying, ambientVolumes.rain > 0]);

  // Coffee shop modulation - cup clinks, murmur swells, footsteps
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.coffee === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.coffee;
    if (!mixGain) return;

    const scheduleCoffeeEvent = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const rand = Math.random();

      if (rand > 0.68) {
        const pan = randomBetween(-0.7, 0.7);
        const clinkFreq = randomBetween(2600, 6200);
        const partials = [1, randomBetween(1.18, 1.38), randomBetween(1.9, 2.25)];
        partials.forEach((partial, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const start = now + idx * randomBetween(0.008, 0.024);
          const freq = clinkFreq * partial;
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);
          osc.frequency.exponentialRampToValueAtTime(freq * randomBetween(0.62, 0.82), start + randomBetween(0.08, 0.18));
          g.gain.setValueAtTime(0.0001, start);
          g.gain.linearRampToValueAtTime((0.014 + Math.random() * 0.018) / (idx + 1), start + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, start + randomBetween(0.14, 0.32));
          osc.connect(g);
          connectWithPan(ctx, g, mixGain, pan + randomBetween(-0.08, 0.08));
          osc.start(start);
          osc.stop(start + 0.35);
        });
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now,
          duration: 0.035,
          peak: 0.018,
          attack: 0.002,
          noise: "white",
          filters: [
            { type: "highpass", frequency: 3200 },
            { type: "lowpass", frequency: 9000 },
          ],
          pan,
        });
      } else if (rand > 0.38) {
        const phraseDur = randomBetween(0.9, 2.6);
        const peak = randomBetween(0.35, 0.68);
        const base = randomBetween(0.22, 0.34);
        mixGain.gain.cancelScheduledValues(now);
        mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
        mixGain.gain.linearRampToValueAtTime(peak, now + phraseDur * 0.35);
        mixGain.gain.linearRampToValueAtTime(base, now + phraseDur);

        const syllables = 3 + Math.floor(Math.random() * 5);
        const pan = randomBetween(-0.8, 0.8);
        for (let i = 0; i < syllables; i++) {
          scheduleNoiseBurst(ctx, mixGain, {
            startTime: now + randomBetween(0.05, phraseDur * 0.9),
            duration: randomBetween(0.08, 0.22),
            peak: randomBetween(0.018, 0.04),
            attack: randomBetween(0.01, 0.03),
            noise: "pink",
            filters: [
              { type: "highpass", frequency: randomBetween(160, 280) },
              { type: "bandpass", frequency: randomBetween(420, 1600), q: randomBetween(0.5, 1.1) },
              { type: "lowpass", frequency: randomBetween(1700, 2600) },
            ],
            pan: pan + randomBetween(-0.18, 0.18),
          });
        }
      } else if (rand > 0.2) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now,
          duration: randomBetween(0.45, 1.2),
          peak: randomBetween(0.014, 0.032),
          attack: randomBetween(0.08, 0.18),
          noise: "white",
          filters: [
            { type: "highpass", frequency: randomBetween(1800, 2600) },
            { type: "lowpass", frequency: randomBetween(5200, 7600) },
          ],
          pan: randomBetween(-0.75, 0.75),
        });
      } else {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now,
          duration: randomBetween(0.16, 0.34),
          peak: randomBetween(0.024, 0.055),
          attack: randomBetween(0.012, 0.025),
          noise: "brown",
          filters: [
            { type: "bandpass", frequency: randomBetween(180, 520), q: randomBetween(0.6, 1.1) },
            { type: "lowpass", frequency: 900 },
          ],
          pan: randomBetween(-0.65, 0.65),
        });
      }

      const id = window.setTimeout(scheduleCoffeeEvent, randomBetween(550, 3200));
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

  // Wind modulation - slow gusts with gentle rustle
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.wind === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.wind;
    if (!mixGain) return;

    const scheduleGust = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const dur = 6 + Math.random() * 10;
      const peak = 0.5 + Math.random() * 0.4;
      const base = 0.15 + Math.random() * 0.2;
      mixGain.gain.cancelScheduledValues(now);
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(peak, now + dur * 0.35);
      mixGain.gain.linearRampToValueAtTime(base, now + dur);

      const rustleCount = 2 + Math.floor(Math.random() * 5);
      for (let i = 0; i < rustleCount; i++) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now + dur * randomBetween(0.18, 0.82),
          duration: randomBetween(0.35, 1.15),
          peak: randomBetween(0.018, 0.055),
          attack: randomBetween(0.08, 0.22),
          noise: Math.random() > 0.4 ? "pink" : "white",
          filters: [
            { type: "highpass", frequency: randomBetween(900, 1500) },
            { type: "bandpass", frequency: randomBetween(1800, 4200), q: randomBetween(0.25, 0.7) },
          ],
          pan: randomBetween(-0.95, 0.95),
        });
      }

      if (Math.random() > 0.55) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now + dur * randomBetween(0.2, 0.55),
          duration: randomBetween(1.4, 3.8),
          peak: randomBetween(0.018, 0.045),
          attack: randomBetween(0.35, 0.8),
          noise: "pink",
          filters: [
            { type: "bandpass", frequency: randomBetween(520, 1200), q: randomBetween(0.18, 0.45) },
            { type: "lowpass", frequency: randomBetween(1400, 2200) },
          ],
          pan: randomBetween(-0.6, 0.6),
        });
      }

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

  // Thunder - inconsistent rumbling strikes with varied intensity
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.thunder === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.thunder;
    if (!mixGain) return;

    mixGain.gain.setValueAtTime(0.05, ctx.currentTime);

    const scheduleStrike = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      const isClose = Math.random() > 0.72;
      const intensity = isClose ? randomBetween(0.48, 0.75) : randomBetween(0.12, 0.32);
      const attack = isClose ? randomBetween(0.025, 0.09) : randomBetween(0.16, 0.45);
      const decay = isClose ? randomBetween(4.5, 8) : randomBetween(2.2, 5.2);
      const pan = randomBetween(-0.35, 0.35);

      mixGain.gain.cancelScheduledValues(now);
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(intensity, now + attack);

      scheduleNoiseBurst(ctx, mixGain, {
        startTime: now,
        duration: decay + randomBetween(0.4, 1.2),
        peak: intensity * 0.22,
        attack,
        noise: "brown",
        filters: [
          { type: "lowpass", frequency: randomBetween(70, 125) },
          { type: "peaking", frequency: randomBetween(45, 80), q: 0.8, gain: 4 },
        ],
        pan,
      });

      const rollCount = isClose ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < rollCount; i++) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now + randomBetween(0.25, decay * 0.9),
          duration: randomBetween(0.9, 2.6),
          peak: intensity * randomBetween(0.06, 0.16),
          attack: randomBetween(0.18, 0.5),
          noise: Math.random() > 0.5 ? "brown" : "pink",
          filters: [
            { type: "bandpass", frequency: randomBetween(85, 220), q: randomBetween(0.35, 0.85) },
            { type: "lowpass", frequency: randomBetween(260, 520) },
          ],
          pan: pan + randomBetween(-0.25, 0.25),
        });
      }

      if (isClose) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now + randomBetween(0, 0.08),
          duration: randomBetween(0.07, 0.16),
          peak: randomBetween(0.055, 0.11),
          attack: 0.004,
          noise: "white",
          filters: [
            { type: "highpass", frequency: randomBetween(900, 1600) },
            { type: "lowpass", frequency: randomBetween(3800, 6200) },
          ],
          pan,
        });
      }

      if (isClose && Math.random() > 0.45) {
        const restrikeTime = now + attack + 0.3 + Math.random() * 0.8;
        const restrikeIntensity = intensity * (0.4 + Math.random() * 0.3);
        mixGain.gain.linearRampToValueAtTime(intensity * 0.3, restrikeTime - 0.1);
        mixGain.gain.linearRampToValueAtTime(restrikeIntensity, restrikeTime);
        mixGain.gain.exponentialRampToValueAtTime(0.03, restrikeTime + decay * 0.7);
      } else {
        mixGain.gain.exponentialRampToValueAtTime(0.03, now + attack + decay);
      }

      const nextDelay = randomBetween(9000, 28000);
      const id = window.setTimeout(scheduleStrike, nextDelay);
      const ids = ambientIntervalsRef.current.get("thunder") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("thunder", ids);
    };
    const initialId = window.setTimeout(scheduleStrike, 1000 + Math.random() * 4000);
    ambientIntervalsRef.current.set("thunder", [initialId]);

    return () => {
      (ambientIntervalsRef.current.get("thunder") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("thunder", []);
    };
  }, [isPlaying, ambientVolumes.thunder > 0]);

  // Campfire - crackling pops at various intensities + ember glow modulation
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.campfire === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.campfire;
    if (!mixGain) return;

    const scheduleCrackle = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      const rand = Math.random();
      if (rand > 0.32) {
        const clusterCount = Math.random() > 0.78 ? 2 + Math.floor(Math.random() * 4) : 1;
        for (let i = 0; i < clusterCount; i++) {
          const isLoud = Math.random() > 0.72;
          scheduleNoiseBurst(ctx, mixGain, {
            startTime: now + i * randomBetween(0.018, 0.055),
            duration: isLoud ? randomBetween(0.045, 0.11) : randomBetween(0.018, 0.05),
            peak: isLoud ? randomBetween(0.085, 0.18) : randomBetween(0.025, 0.075),
            attack: randomBetween(0.0015, 0.005),
            noise: "white",
            filters: [
              { type: "highpass", frequency: randomBetween(1500, 3200) },
              { type: "lowpass", frequency: randomBetween(4800, 8200) },
            ],
            pan: randomBetween(-0.75, 0.75),
          });
        }
      }

      if (Math.random() > 0.9) {
        const popStart = now + randomBetween(0.03, 0.18);
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: popStart,
          duration: randomBetween(0.08, 0.18),
          peak: randomBetween(0.08, 0.16),
          attack: randomBetween(0.004, 0.012),
          noise: "pink",
          filters: [
            { type: "bandpass", frequency: randomBetween(350, 900), q: randomBetween(0.8, 1.5) },
            { type: "lowpass", frequency: randomBetween(2200, 3600) },
          ],
          pan: randomBetween(-0.5, 0.5),
        });
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: popStart + randomBetween(0.01, 0.035),
          duration: randomBetween(0.025, 0.06),
          peak: randomBetween(0.035, 0.08),
          attack: 0.002,
          noise: "white",
          filters: [
            { type: "highpass", frequency: randomBetween(2800, 4600) },
            { type: "lowpass", frequency: randomBetween(6500, 9000) },
          ],
          pan: randomBetween(-0.55, 0.55),
        });
      }

      const id = window.setTimeout(scheduleCrackle, randomBetween(70, 430));
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

  // Birds - individual chirps with varied patterns and trills
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.birds === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.birds;
    if (!mixGain) return;

    const scheduleChirpGroup = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const motif = randomChoice([
        { minFreq: 2200, maxFreq: 3800, minChirps: 2, maxChirps: 5, gap: 0.13, dur: 0.11 },
        { minFreq: 3200, maxFreq: 5400, minChirps: 3, maxChirps: 7, gap: 0.085, dur: 0.07 },
        { minFreq: 1500, maxFreq: 2600, minChirps: 1, maxChirps: 3, gap: 0.22, dur: 0.18 },
      ]);
      const numChirps = motif.minChirps + Math.floor(Math.random() * (motif.maxChirps - motif.minChirps + 1));
      const baseFreq = randomBetween(motif.minFreq, motif.maxFreq);
      const pan = randomBetween(-0.9, 0.9);

      for (let c = 0; c < numChirps; c++) {
        const chirpStart = now + c * randomBetween(motif.gap * 0.7, motif.gap * 1.45);
        const chirpDur = randomBetween(motif.dur * 0.65, motif.dur * 1.45);
        const freq = baseFreq * randomBetween(0.82, 1.22);
        const midFreq = freq * randomBetween(1.04, 1.32);
        const endFreq = freq * randomBetween(0.72, 1.12);

        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = randomChoice<OscillatorType>(["sine", "triangle"]);
        osc.frequency.setValueAtTime(freq, chirpStart);
        osc.frequency.exponentialRampToValueAtTime(midFreq, chirpStart + chirpDur * randomBetween(0.25, 0.45));
        osc.frequency.exponentialRampToValueAtTime(endFreq, chirpStart + chirpDur);
        g.gain.setValueAtTime(0.0001, chirpStart);
        g.gain.linearRampToValueAtTime(randomBetween(0.026, 0.055), chirpStart + chirpDur * 0.18);
        g.gain.setValueAtTime(randomBetween(0.018, 0.04), chirpStart + chirpDur * 0.68);
        g.gain.linearRampToValueAtTime(0, chirpStart + chirpDur);
        osc.connect(g);
        connectWithPan(ctx, g, mixGain, pan + randomBetween(-0.12, 0.12));
        osc.start(chirpStart);
        osc.stop(chirpStart + chirpDur + 0.01);

        if (Math.random() > 0.55) {
          const overtone = ctx.createOscillator();
          const overtoneGain = ctx.createGain();
          overtone.type = "sine";
          overtone.frequency.setValueAtTime(freq * randomBetween(1.48, 1.72), chirpStart);
          overtone.frequency.exponentialRampToValueAtTime(endFreq * randomBetween(1.45, 1.65), chirpStart + chirpDur);
          overtoneGain.gain.setValueAtTime(0.0001, chirpStart);
          overtoneGain.gain.linearRampToValueAtTime(randomBetween(0.006, 0.014), chirpStart + chirpDur * 0.2);
          overtoneGain.gain.exponentialRampToValueAtTime(0.0001, chirpStart + chirpDur);
          overtone.connect(overtoneGain);
          connectWithPan(ctx, overtoneGain, mixGain, pan + randomBetween(-0.12, 0.12));
          overtone.start(chirpStart);
          overtone.stop(chirpStart + chirpDur + 0.01);
        }

        scheduleNoiseBurst(ctx, mixGain, {
          startTime: chirpStart,
          duration: chirpDur * randomBetween(0.6, 1),
          peak: randomBetween(0.002, 0.006),
          attack: 0.006,
          noise: "white",
          filters: [
            { type: "highpass", frequency: 2600 },
            { type: "lowpass", frequency: 8500 },
          ],
          pan,
        });
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
        connectWithPan(ctx, g2, mixGain, pan + randomBetween(-0.2, 0.2));
        osc2.start(trillStart);
        osc2.stop(trillStart + trillDur + 0.01);
        lfo.start(trillStart);
        lfo.stop(trillStart + trillDur + 0.01);
      }

      const nextDelay = randomBetween(1600, 6200);
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

  // Ring - Tibetan singing bowl strikes + harmonic decay + vocal drone
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.ring === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.ring;
    if (!mixGain) return;

    const scheduleBowlStrike = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      const bowlFreq = randomChoice([293.66, 329.63, 392, 440, 523.25]);
      const bowlDur = randomBetween(9, 15);
      const pan = randomBetween(-0.18, 0.18);
      const harmonics = [1, 2.01, 2.76, 4.72, 6.83];

      scheduleNoiseBurst(ctx, mixGain, {
        startTime: now,
        duration: randomBetween(0.08, 0.16),
        peak: randomBetween(0.012, 0.026),
        attack: 0.004,
        noise: "pink",
        filters: [
          { type: "bandpass", frequency: randomBetween(900, 1800), q: randomBetween(1.2, 2.4) },
          { type: "lowpass", frequency: 3600 },
        ],
        pan,
      });

      harmonics.forEach((h, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        const harmonicFreq = bowlFreq * h * randomBetween(0.998, 1.002);
        osc.frequency.setValueAtTime(harmonicFreq, now);
        osc.frequency.linearRampToValueAtTime(harmonicFreq * (1 + Math.random() * 0.004), now + bowlDur);
        const vol = 0.05 / (idx + 1);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + randomBetween(0.12, 0.28));
        g.gain.exponentialRampToValueAtTime(vol * 0.3, now + bowlDur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, now + bowlDur);
        osc.connect(g);
        connectWithPan(ctx, g, mixGain, pan + (idx % 2 === 0 ? -0.08 : 0.08));
        osc.start(now);
        osc.stop(now + bowlDur + 0.1);

        if (idx < 3) {
          const beat = ctx.createOscillator();
          const beatGain = ctx.createGain();
          beat.type = "sine";
          beat.frequency.setValueAtTime(harmonicFreq * randomBetween(1.003, 1.008), now);
          beat.frequency.linearRampToValueAtTime(harmonicFreq * randomBetween(0.997, 1.002), now + bowlDur);
          beatGain.gain.setValueAtTime(0, now + 0.03);
          beatGain.gain.linearRampToValueAtTime(vol * 0.32, now + randomBetween(0.3, 0.7));
          beatGain.gain.exponentialRampToValueAtTime(0.001, now + bowlDur * randomBetween(0.65, 0.9));
          beat.connect(beatGain);
          connectWithPan(ctx, beatGain, mixGain, pan + (idx % 2 === 0 ? 0.1 : -0.1));
          beat.start(now + 0.03);
          beat.stop(now + bowlDur + 0.1);
        }
      });

      if (Math.random() > 0.4) {
        const droneStart = now + randomBetween(2, 4);
        const droneDur = randomBetween(5, 9);
        const droneFreq = randomChoice([110, 130.81, 146.83, 164.81]);
        [1, 1.5, 2, 3].forEach((h, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(droneFreq * h, droneStart);
          osc.frequency.linearRampToValueAtTime(droneFreq * h * (1 + Math.random() * 0.01), droneStart + droneDur);
          const vol = 0.022 / (idx + 1);
          g.gain.setValueAtTime(0, droneStart);
          g.gain.linearRampToValueAtTime(vol, droneStart + droneDur * 0.25);
          g.gain.linearRampToValueAtTime(vol * 0.8, droneStart + droneDur * 0.7);
          g.gain.linearRampToValueAtTime(0, droneStart + droneDur);
          osc.connect(g);
          connectWithPan(ctx, g, mixGain, randomBetween(-0.16, 0.16));
          osc.start(droneStart);
          osc.stop(droneStart + droneDur + 0.1);
        });
      }

      const nextDelay = randomBetween(9000, 15000);
      const id = window.setTimeout(scheduleBowlStrike, nextDelay);
      const ids = ambientIntervalsRef.current.get("ring") || [];
      ids.push(id);
      ambientIntervalsRef.current.set("ring", ids);
    };
    scheduleBowlStrike();

    return () => {
      (ambientIntervalsRef.current.get("ring") || []).forEach(clearTimeout);
      ambientIntervalsRef.current.set("ring", []);
    };
  }, [isPlaying, ambientVolumes.ring > 0]);

  // Purring - ASMR cat purr with natural breathing rhythm
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.purring === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.purring;
    if (!mixGain) return;

    const schedulePurrCycle = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const cycleDur = randomBetween(3.4, 5.4);
      const baseFreq = randomBetween(24, 31);
      const pulseInterval = randomBetween(0.095, 0.145);
      const numPulses = Math.floor(cycleDur / pulseInterval);

      const applyPurrEnvelope = (gain: GainNode, peak: number, floor: number) => {
        gain.gain.setValueAtTime(0.0001, now);
        for (let i = 0; i < numPulses; i++) {
          const t = now + i * pulseInterval;
          const breathMod = 0.45 + 0.55 * Math.sin((i / Math.max(1, numPulses - 1)) * Math.PI);
          gain.gain.linearRampToValueAtTime(peak * breathMod, t + pulseInterval * 0.35);
          gain.gain.linearRampToValueAtTime(floor * breathMod, t + pulseInterval * 0.9);
        }
        gain.gain.linearRampToValueAtTime(0.0001, now + cycleDur);
      };

      const schedulePurrLayer = (type: OscillatorType, freqMult: number, peak: number, floor: number, lpfFreq: number, pan: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const lpf = ctx.createBiquadFilter();
        lpf.type = "lowpass";
        lpf.frequency.value = lpfFreq;
        osc.type = type;
        osc.frequency.setValueAtTime(baseFreq * freqMult, now);
        osc.frequency.linearRampToValueAtTime(baseFreq * freqMult * randomBetween(1.01, 1.035), now + cycleDur * 0.48);
        osc.frequency.linearRampToValueAtTime(baseFreq * freqMult * randomBetween(0.97, 1), now + cycleDur);
        applyPurrEnvelope(g, peak, floor);
        osc.connect(lpf);
        lpf.connect(g);
        connectWithPan(ctx, g, mixGain, pan);
        osc.start(now);
        osc.stop(now + cycleDur + 0.1);
      };

      schedulePurrLayer("triangle", 1, 0.055, 0.018, 95, -0.08);
      schedulePurrLayer("sawtooth", 2, 0.024, 0.008, 150, 0.06);
      schedulePurrLayer("sine", 3, 0.012, 0.004, 220, 0.02);

      const texture = ctx.createBufferSource();
      texture.buffer = createNoiseBuffer(ctx, "brown", cycleDur + 0.1);
      const textureHP = ctx.createBiquadFilter();
      const textureLP = ctx.createBiquadFilter();
      const textureG = ctx.createGain();
      textureHP.type = "highpass";
      textureHP.frequency.value = 22;
      textureLP.type = "lowpass";
      textureLP.frequency.value = 260;
      applyPurrEnvelope(textureG, 0.018, 0.005);
      texture.connect(textureHP);
      textureHP.connect(textureLP);
      textureLP.connect(textureG);
      connectWithPan(ctx, textureG, mixGain, 0);
      texture.start(now);
      texture.stop(now + cycleDur + 0.1);

      const gap = randomBetween(0.12, 0.55);
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

  // Forest - calm rustling leaves with gentle sway
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.forest === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.forest;
    if (!mixGain) return;

    const scheduleForestEvent = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      const dur = 6 + Math.random() * 10;
      const peak = 0.5 + Math.random() * 0.4;
      const base = 0.2 + Math.random() * 0.15;
      mixGain.gain.cancelScheduledValues(now);
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(peak, now + dur * 0.4);
      mixGain.gain.linearRampToValueAtTime(base, now + dur);

      const leafSweeps = 3 + Math.floor(Math.random() * 6);
      for (let i = 0; i < leafSweeps; i++) {
        scheduleNoiseBurst(ctx, mixGain, {
          startTime: now + randomBetween(0.6, dur - 0.7),
          duration: randomBetween(0.28, 1.35),
          peak: randomBetween(0.018, 0.06),
          attack: randomBetween(0.07, 0.22),
          noise: Math.random() > 0.5 ? "pink" : "white",
          filters: [
            { type: "highpass", frequency: randomBetween(800, 1400) },
            { type: "bandpass", frequency: randomBetween(1600, 4200), q: randomBetween(0.3, 0.75) },
            { type: "lowpass", frequency: randomBetween(4300, 6800) },
          ],
          pan: randomBetween(-0.95, 0.95),
        });
      }

      if (Math.random() > 0.78) {
        const creakStart = now + randomBetween(1, dur - 1);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const bp = ctx.createBiquadFilter();
        const creakFreq = randomBetween(120, 260);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(creakFreq, creakStart);
        osc.frequency.exponentialRampToValueAtTime(creakFreq * randomBetween(0.58, 0.82), creakStart + randomBetween(0.55, 1.2));
        bp.type = "bandpass";
        bp.frequency.value = creakFreq * 1.4;
        bp.Q.value = 0.9;
        g.gain.setValueAtTime(0.0001, creakStart);
        g.gain.linearRampToValueAtTime(randomBetween(0.006, 0.014), creakStart + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, creakStart + randomBetween(0.8, 1.5));
        osc.connect(bp);
        bp.connect(g);
        connectWithPan(ctx, g, mixGain, randomBetween(-0.35, 0.35));
        osc.start(creakStart);
        osc.stop(creakStart + 1.6);
      }

      const id = window.setTimeout(scheduleForestEvent, dur * 1000);
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
