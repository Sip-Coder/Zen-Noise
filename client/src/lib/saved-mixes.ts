import type { AmbientVolumes, WaveIntensity } from "@/hooks/use-audio-engine";
import { clampVolume, normalizeAmbientVolumes } from "@/lib/mix-presets";

export const SAVED_MIXES_STORAGE_KEY = "zen_saved_mixes";

const MODULATION_VALUES: WaveIntensity[] = ["steady", "gentle", "deep"];

export interface SavedMixState {
  ambientVolumes: AmbientVolumes;
  brownNoiseEnabled: boolean;
  brownNoiseLevel: number;
  waveIntensity: WaveIntensity;
}

export interface SavedMix extends SavedMixState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export function sanitizeSavedMixName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

function normalizeWaveIntensity(value: unknown): WaveIntensity {
  return MODULATION_VALUES.includes(value as WaveIntensity) ? value as WaveIntensity : "steady";
}

function normalizeSavedMix(value: unknown): SavedMix | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<SavedMix>;
  const name = sanitizeSavedMixName(String(raw.name ?? ""));
  if (!name) return null;

  const id = typeof raw.id === "string" && raw.id.trim()
    ? raw.id
    : `mix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now();
  const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : createdAt;
  const brownNoiseLevel = clampVolume(Number(raw.brownNoiseLevel ?? 0));

  return {
    id,
    name,
    ambientVolumes: normalizeAmbientVolumes(raw.ambientVolumes),
    brownNoiseEnabled: Boolean(raw.brownNoiseEnabled) && brownNoiseLevel > 0,
    brownNoiseLevel,
    waveIntensity: normalizeWaveIntensity(raw.waveIntensity),
    createdAt,
    updatedAt,
  };
}

export function loadSavedMixes(): SavedMix[] {
  try {
    const saved = localStorage.getItem(SAVED_MIXES_STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeSavedMix)
      .filter((mix): mix is SavedMix => Boolean(mix))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function persistSavedMixes(mixes: SavedMix[]) {
  localStorage.setItem(SAVED_MIXES_STORAGE_KEY, JSON.stringify(mixes));
}

export function createSavedMix(name: string, state: SavedMixState, existing?: SavedMix): SavedMix {
  const now = Date.now();
  const brownNoiseLevel = clampVolume(state.brownNoiseLevel);

  return {
    id: existing?.id ?? `mix-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: sanitizeSavedMixName(name),
    ambientVolumes: normalizeAmbientVolumes(state.ambientVolumes),
    brownNoiseEnabled: state.brownNoiseEnabled && brownNoiseLevel > 0,
    brownNoiseLevel,
    waveIntensity: normalizeWaveIntensity(state.waveIntensity),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
