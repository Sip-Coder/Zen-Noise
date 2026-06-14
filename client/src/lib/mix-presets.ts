import { ALL_AMBIENTS, type AmbientSound, type AmbientVolumes } from "@/hooks/use-audio-engine";

export interface MixState {
  ambientVolumes: AmbientVolumes;
}

export interface MixPreset extends MixState {
  id: string;
  label: string;
  icon: "focus" | "sleep" | "rain" | "forest" | "fire" | "bowl" | "ocean" | "city" | "travel";
  accent: string;
}

export const DEFAULT_AMBIENT_VOLUMES: AmbientVolumes = {
  rain: 0,
  coffee: 0,
  thunder: 0,
  wind: 0,
  birds: 0,
  campfire: 0,
  ring: 0,
  purring: 0,
  forest: 0,
  ocean: 0,
  stream: 0,
  waterfall: 0,
  crickets: 0,
  fan: 0,
  city: 0,
  train: 0,
  airplane: 0,
  washer: 0,
};

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeAmbientVolumes(volumes?: Partial<AmbientVolumes>): AmbientVolumes {
  const next = { ...DEFAULT_AMBIENT_VOLUMES };

  ALL_AMBIENTS.forEach((sound) => {
    if (volumes?.[sound] !== undefined) {
      next[sound] = clampVolume(Number(volumes[sound]));
    }
  });

  return next;
}

function createAmbientVolumes(values: Partial<AmbientVolumes>): AmbientVolumes {
  return normalizeAmbientVolumes(values);
}

export const MIX_PRESETS: MixPreset[] = [
  {
    id: "deep-focus",
    label: "Focus",
    icon: "focus",
    accent: "text-sky-300",
    ambientVolumes: createAmbientVolumes({ coffee: 0.2, fan: 0.16, city: 0.08 }),
  },
  {
    id: "sleep-rain",
    label: "Sleep",
    icon: "sleep",
    accent: "text-indigo-300",
    ambientVolumes: createAmbientVolumes({ rain: 0.24, ocean: 0.18, purring: 0.12 }),
  },
  {
    id: "rain-cabin",
    label: "Storm",
    icon: "rain",
    accent: "text-blue-300",
    ambientVolumes: createAmbientVolumes({ rain: 0.28, thunder: 0.14, waterfall: 0.1 }),
  },
  {
    id: "forest-rest",
    label: "Forest",
    icon: "forest",
    accent: "text-emerald-300",
    ambientVolumes: createAmbientVolumes({ forest: 0.2, stream: 0.16, birds: 0.1 }),
  },
  {
    id: "hearth",
    label: "Hearth",
    icon: "fire",
    accent: "text-orange-300",
    ambientVolumes: createAmbientVolumes({ campfire: 0.22, purring: 0.14, crickets: 0.1 }),
  },
  {
    id: "bowl-reset",
    label: "Reset",
    icon: "bowl",
    accent: "text-violet-300",
    ambientVolumes: createAmbientVolumes({ ring: 0.18, ocean: 0.14, wind: 0.08 }),
  },
  {
    id: "coast-drift",
    label: "Coast",
    icon: "ocean",
    accent: "text-cyan-300",
    ambientVolumes: createAmbientVolumes({ ocean: 0.28, stream: 0.08, wind: 0.06 }),
  },
  {
    id: "city-hush",
    label: "City",
    icon: "city",
    accent: "text-zinc-300",
    ambientVolumes: createAmbientVolumes({ city: 0.18, fan: 0.16, train: 0.08 }),
  },
  {
    id: "travel-hum",
    label: "Travel",
    icon: "travel",
    accent: "text-fuchsia-300",
    ambientVolumes: createAmbientVolumes({ airplane: 0.18, train: 0.12, washer: 0.08 }),
  },
];

function toPercent(value: number): string {
  return Math.round(clampVolume(value) * 100).toString();
}

function fromPercent(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return clampVolume(parsed / 100);
}

export function encodeMixToSearchParams(mix: MixState): string {
  const params = new URLSearchParams();

  ALL_AMBIENTS.forEach((sound) => {
    const volume = clampVolume(mix.ambientVolumes[sound]);
    if (volume > 0) {
      params.set(sound, toPercent(volume));
    }
  });

  return params.toString();
}

export function decodeMixFromSearch(search: string): MixState | null {
  const params = new URLSearchParams(search);
  const hasMixParams = ALL_AMBIENTS.some((sound) => params.has(sound));

  if (!hasMixParams) return null;

  const ambientVolumes = normalizeAmbientVolumes();
  ALL_AMBIENTS.forEach((sound: AmbientSound) => {
    const parsed = fromPercent(params.get(sound));
    if (parsed !== undefined) {
      ambientVolumes[sound] = parsed;
    }
  });

  return {
    ambientVolumes,
  };
}
