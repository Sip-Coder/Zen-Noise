import { ALL_AMBIENTS, type AmbientSound, type AmbientVolumes } from "@/hooks/use-audio-engine";

export interface MixState {
  ambientVolumes: AmbientVolumes;
}

export interface MixPreset extends MixState {
  id: string;
  label: string;
  icon: "focus" | "sleep" | "rain" | "forest" | "fire" | "bowl";
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
    ambientVolumes: createAmbientVolumes({ coffee: 0.22, rain: 0.1 }),
  },
  {
    id: "sleep-rain",
    label: "Sleep",
    icon: "sleep",
    accent: "text-indigo-300",
    ambientVolumes: createAmbientVolumes({ rain: 0.28, purring: 0.16, wind: 0.08 }),
  },
  {
    id: "rain-cabin",
    label: "Storm",
    icon: "rain",
    accent: "text-blue-300",
    ambientVolumes: createAmbientVolumes({ rain: 0.34, thunder: 0.18, campfire: 0.12 }),
  },
  {
    id: "forest-rest",
    label: "Forest",
    icon: "forest",
    accent: "text-emerald-300",
    ambientVolumes: createAmbientVolumes({ forest: 0.22, birds: 0.14, wind: 0.08 }),
  },
  {
    id: "hearth",
    label: "Hearth",
    icon: "fire",
    accent: "text-orange-300",
    ambientVolumes: createAmbientVolumes({ campfire: 0.24, purring: 0.18, wind: 0.06 }),
  },
  {
    id: "bowl-reset",
    label: "Reset",
    icon: "bowl",
    accent: "text-violet-300",
    ambientVolumes: createAmbientVolumes({ ring: 0.2, forest: 0.12, wind: 0.08 }),
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
