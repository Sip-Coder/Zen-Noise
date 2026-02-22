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

      if (Math.random() > 0.5) {
        const dripTime = now + 1 + Math.random() * (dur - 2);
        const dripBurst = ctx.createBufferSource();
        dripBurst.buffer = createWhiteNoiseBuffer(ctx, 0.15);
        const dripG = ctx.createGain();
        const dripBP = ctx.createBiquadFilter();
        dripBP.type = "bandpass";
        dripBP.frequency.value = 3000 + Math.random() * 2000;
        dripBP.Q.value = 1.5;
        dripG.gain.setValueAtTime(0, dripTime);
        dripG.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.04, dripTime + 0.01);
        dripG.gain.exponentialRampToValueAtTime(0.001, dripTime + 0.12);
        dripBurst.connect(dripBP);
        dripBP.connect(dripG);
        dripG.connect(mixGain);
        dripBurst.start(dripTime);
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

      if (rand > 0.65) {
        const clinkFreq = 2800 + Math.random() * 3500;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(clinkFreq, now);
        osc.frequency.exponentialRampToValueAtTime(clinkFreq * 0.75, now + 0.08);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.018, now + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + Math.random() * 0.1);
        osc.connect(g);
        g.connect(mixGain);
        osc.start(now);
        osc.stop(now + 0.3);

        if (Math.random() > 0.5) {
          const osc2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          const f2 = clinkFreq * (1.2 + Math.random() * 0.3);
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(f2, now + 0.02);
          osc2.frequency.exponentialRampToValueAtTime(f2 * 0.7, now + 0.1);
          g2.gain.setValueAtTime(0, now + 0.02);
          g2.gain.linearRampToValueAtTime(0.008, now + 0.025);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc2.connect(g2);
          g2.connect(mixGain);
          osc2.start(now + 0.02);
          osc2.stop(now + 0.2);
        }
      } else if (rand > 0.35) {
        const swellDur = 2 + Math.random() * 4;
        const peak = 0.5 + Math.random() * 0.4;
        const base = 0.2 + Math.random() * 0.15;
        mixGain.gain.cancelScheduledValues(now);
        mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
        mixGain.gain.linearRampToValueAtTime(peak, now + swellDur * 0.35);
        mixGain.gain.linearRampToValueAtTime(base, now + swellDur);
      } else {
        const stepBurst = ctx.createBufferSource();
        stepBurst.buffer = createBrownNoiseBuffer(ctx, 0.2);
        const stepG = ctx.createGain();
        const stepBP = ctx.createBiquadFilter();
        stepBP.type = "bandpass";
        stepBP.frequency.value = 200 + Math.random() * 300;
        stepBP.Q.value = 0.8;
        stepG.gain.setValueAtTime(0, now);
        stepG.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.03, now + 0.02);
        stepG.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        stepBurst.connect(stepBP);
        stepBP.connect(stepG);
        stepG.connect(mixGain);
        stepBurst.start(now);
      }

      const id = window.setTimeout(scheduleCoffeeEvent, 800 + Math.random() * 3500);
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

      if (Math.random() > 0.4) {
        const rustleTime = now + dur * 0.2 + Math.random() * dur * 0.5;
        const rustleSrc = ctx.createBufferSource();
        rustleSrc.buffer = createWhiteNoiseBuffer(ctx, 0.8);
        const rG = ctx.createGain();
        const rBP = ctx.createBiquadFilter();
        rBP.type = "bandpass";
        rBP.frequency.value = 2500 + Math.random() * 2000;
        rBP.Q.value = 0.4;
        rG.gain.setValueAtTime(0, rustleTime);
        rG.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.04, rustleTime + 0.15);
        rG.gain.linearRampToValueAtTime(0, rustleTime + 0.6 + Math.random() * 0.4);
        rustleSrc.connect(rBP);
        rBP.connect(rG);
        rG.connect(mixGain);
        rustleSrc.start(rustleTime);
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

      const isLoud = Math.random() > 0.6;
      const intensity = isLoud ? (0.6 + Math.random() * 0.4) : (0.15 + Math.random() * 0.3);
      const attack = isLoud ? (0.01 + Math.random() * 0.05) : (0.1 + Math.random() * 0.3);
      const decay = isLoud ? (3 + Math.random() * 5) : (1.5 + Math.random() * 3);

      mixGain.gain.cancelScheduledValues(now);
      mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
      mixGain.gain.linearRampToValueAtTime(intensity, now + attack);

      if (isLoud && Math.random() > 0.5) {
        const restrikeTime = now + attack + 0.3 + Math.random() * 0.8;
        const restrikeIntensity = intensity * (0.4 + Math.random() * 0.3);
        mixGain.gain.linearRampToValueAtTime(intensity * 0.3, restrikeTime - 0.1);
        mixGain.gain.linearRampToValueAtTime(restrikeIntensity, restrikeTime);
        mixGain.gain.exponentialRampToValueAtTime(0.03, restrikeTime + decay * 0.7);
      } else {
        mixGain.gain.exponentialRampToValueAtTime(0.03, now + attack + decay);
      }

      const nextDelay = 6000 + Math.random() * 20000;
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
      if (rand > 0.25) {
        const isLoud = Math.random() > 0.7;
        const crackleSrc = ctx.createBufferSource();
        crackleSrc.buffer = createWhiteNoiseBuffer(ctx, 0.08);
        const cG = ctx.createGain();
        const cHP = ctx.createBiquadFilter();
        cHP.type = "highpass";
        cHP.frequency.value = 2000 + Math.random() * 3000;
        const vol = isLoud ? (0.15 + Math.random() * 0.15) : (0.04 + Math.random() * 0.08);
        const dur = isLoud ? (0.04 + Math.random() * 0.03) : (0.02 + Math.random() * 0.02);
        cG.gain.setValueAtTime(0, now);
        cG.gain.linearRampToValueAtTime(vol, now + 0.003);
        cG.gain.exponentialRampToValueAtTime(0.001, now + dur);
        crackleSrc.connect(cHP);
        cHP.connect(cG);
        cG.connect(mixGain);
        crackleSrc.start(now);
      }

      if (Math.random() > 0.85) {
        const popDur = 0.3 + Math.random() * 0.5;
        mixGain.gain.cancelScheduledValues(now);
        mixGain.gain.setValueAtTime(Math.max(0.01, mixGain.gain.value), now);
        mixGain.gain.linearRampToValueAtTime(0.8 + Math.random() * 0.2, now + 0.05);
        mixGain.gain.linearRampToValueAtTime(0.4, now + popDur);
      }

      const id = window.setTimeout(scheduleCrackle, 40 + Math.random() * 350);
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

  // Ring - Tibetan singing bowl strikes + harmonic decay + vocal drone
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current || ambientVolumes.ring === 0) return;
    const ctx = audioContextRef.current;
    const mixGain = ambientGainsRef.current.ring;
    if (!mixGain) return;

    const scheduleBowlStrike = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      const bowlFreq = [293.66, 329.63, 392, 440, 523.25][Math.floor(Math.random() * 5)];
      const bowlDur = 8 + Math.random() * 6;
      const harmonics = [1, 2.76, 4.72, 6.83];
      harmonics.forEach((h, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(bowlFreq * h, now);
        osc.frequency.linearRampToValueAtTime(bowlFreq * h * (1 + Math.random() * 0.003), now + bowlDur);
        const vol = 0.045 / (idx + 1);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.15);
        g.gain.exponentialRampToValueAtTime(vol * 0.3, now + bowlDur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, now + bowlDur);
        osc.connect(g);
        g.connect(mixGain);
        osc.start(now);
        osc.stop(now + bowlDur + 0.1);
      });

      if (Math.random() > 0.4) {
        const droneStart = now + 2 + Math.random() * 2;
        const droneDur = 5 + Math.random() * 4;
        const droneFreq = [110, 130.81, 146.83, 164.81][Math.floor(Math.random() * 4)];
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
          g.connect(mixGain);
          osc.start(droneStart);
          osc.stop(droneStart + droneDur + 0.1);
        });
      }

      const nextDelay = 6000 + Math.random() * 6000;
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
      const cycleDur = 3 + Math.random() * 2;
      const baseFreq = 22 + Math.random() * 4;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 120;

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.03, now + cycleDur * 0.5);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.98, now + cycleDur);

      g.gain.setValueAtTime(0, now);
      const pulseInterval = 0.12 + Math.random() * 0.04;
      const numPulses = Math.floor(cycleDur / pulseInterval);
      for (let i = 0; i < numPulses; i++) {
        const t = now + i * pulseInterval;
        const breathMod = 0.5 + 0.5 * Math.sin((i / numPulses) * Math.PI);
        g.gain.linearRampToValueAtTime(0.09 * breathMod, t + pulseInterval * 0.35);
        g.gain.linearRampToValueAtTime(0.02 * breathMod, t + pulseInterval * 0.85);
      }
      g.gain.linearRampToValueAtTime(0, now + cycleDur);

      osc.connect(lpf);
      lpf.connect(g);
      g.connect(mixGain);
      osc.start(now);
      osc.stop(now + cycleDur + 0.1);

      const gap = 0.1 + Math.random() * 0.4;
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

      if (Math.random() > 0.4) {
        const rustleTime = now + 1 + Math.random() * (dur - 3);
        const rustleSrc = ctx.createBufferSource();
        rustleSrc.buffer = createWhiteNoiseBuffer(ctx, 0.6);
        const rG = ctx.createGain();
        const rBP = ctx.createBiquadFilter();
        rBP.type = "bandpass";
        rBP.frequency.value = 2000 + Math.random() * 2500;
        rBP.Q.value = 0.5;
        rG.gain.setValueAtTime(0, rustleTime);
        rG.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.06, rustleTime + 0.1);
        rG.gain.linearRampToValueAtTime(0, rustleTime + 0.4 + Math.random() * 0.4);
        rustleSrc.connect(rBP);
        rBP.connect(rG);
        rG.connect(mixGain);
        rustleSrc.start(rustleTime);
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
