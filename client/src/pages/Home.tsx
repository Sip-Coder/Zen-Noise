import { useEffect, useMemo, useState } from "react";
import { useAudioEngine, ALL_AMBIENTS, type WaveIntensity, type AmbientVolumes } from "@/hooks/use-audio-engine";
import { useTimer } from "@/hooks/use-timer";
import { VolumeSlider } from "@/components/VolumeSlider";
import { TimerSelector } from "@/components/TimerSelector";
import { WaveControl } from "@/components/WaveControl";
import { AmbientSounds } from "@/components/AmbientSounds";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MixPresets } from "@/components/MixPresets";
import {
  DEFAULT_AMBIENT_VOLUMES,
  MIX_PRESETS,
  clampVolume,
  decodeMixFromSearch,
  encodeMixToSearchParams,
  normalizeAmbientVolumes,
  type MixPreset,
} from "@/lib/mix-presets";
import { Play, Pause, Moon, Info, Waves } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function loadSavedAmbientVolumes(): AmbientVolumes {
  try {
    const saved = localStorage.getItem('zen_ambient_volumes');
    if (saved) {
      const parsed = JSON.parse(saved);
      if ('chanting' in parsed && !('ring' in parsed)) {
        parsed.ring = parsed.chanting;
        delete parsed.chanting;
        localStorage.setItem('zen_ambient_volumes', JSON.stringify(parsed));
      }
      return normalizeAmbientVolumes(parsed);
    }
  } catch {}
  return { ...DEFAULT_AMBIENT_VOLUMES };
}

function loadSavedBrownVolume(): number {
  const saved = Number(localStorage.getItem('brown_noise_volume') || '0.35');
  const normalized = clampVolume(saved);
  return normalized > 0 ? normalized : 0.35;
}

function loadSavedBrownEnabled(): boolean {
  return localStorage.getItem('brown_noise_enabled') === 'true';
}

const MODULATION_VALUES: WaveIntensity[] = ["steady", "gentle", "deep"];

function loadSavedLayerModulation(): WaveIntensity {
  const saved = localStorage.getItem('layer_modulation_intensity')
    || localStorage.getItem('brown_noise_wave');

  return MODULATION_VALUES.includes(saved as WaveIntensity) ? saved as WaveIntensity : 'steady';
}

export default function Home() {
  const initialMix = useMemo(() => decodeMixFromSearch(window.location.search), []);
  const savedWave = loadSavedLayerModulation();
  const savedAmbientVolumes = initialMix?.ambientVolumes ?? loadSavedAmbientVolumes();
  const savedBrownVolume = loadSavedBrownVolume();
  const [brownNoiseEnabled, setBrownNoiseEnabled] = useState(loadSavedBrownEnabled);
  const [brownNoiseLevel, setBrownNoiseLevel] = useState(savedBrownVolume);
  const [mixShareState, setMixShareState] = useState<"idle" | "copied" | "linked">("idle");

  const {
    isPlaying,
    waveIntensity,
    ambientVolumes,
    togglePlay,
    setVolume,
    setWaveIntensity,
    setAmbientVolume,
    stopWithFade
  } = useAudioEngine(brownNoiseEnabled ? savedBrownVolume : 0, savedAmbientVolumes);

  useEffect(() => {
    localStorage.setItem('brown_noise_volume', brownNoiseLevel.toString());
  }, [brownNoiseLevel]);

  useEffect(() => {
    localStorage.setItem('brown_noise_enabled', brownNoiseEnabled ? 'true' : 'false');
  }, [brownNoiseEnabled]);

  useEffect(() => {
    setWaveIntensity(savedWave);
  }, []);

  useEffect(() => {
    localStorage.setItem('layer_modulation_intensity', waveIntensity);
    localStorage.removeItem('brown_noise_wave');
  }, [waveIntensity]);

  useEffect(() => {
    localStorage.setItem('zen_ambient_volumes', JSON.stringify(ambientVolumes));
  }, [ambientVolumes]);

  const { duration, remaining, startTimer, cancelTimer, formatTime } = useTimer(() => {
    stopWithFade(10);
  });

  const activeCount = Object.values(ambientVolumes).filter(v => v > 0).length;
  const activeMixId = useMemo(() => {
    return MIX_PRESETS.find((preset) => {
      const ambientsMatch = ALL_AMBIENTS.every((sound) => Math.abs(preset.ambientVolumes[sound] - ambientVolumes[sound]) < 0.005);
      return ambientsMatch;
    })?.id ?? null;
  }, [ambientVolumes]);

  const toggleBrownNoise = () => {
    const nextEnabled = !brownNoiseEnabled;
    setBrownNoiseEnabled(nextEnabled);
    setVolume(nextEnabled ? brownNoiseLevel : 0);
  };

  const changeBrownNoiseLevel = (nextLevel: number) => {
    const normalized = clampVolume(nextLevel);
    if (normalized <= 0) {
      setBrownNoiseEnabled(false);
      setVolume(0);
      return;
    }

    setBrownNoiseLevel(normalized);
    setBrownNoiseEnabled(true);
    setVolume(normalized);
  };

  const applyMix = (preset: MixPreset) => {
    ALL_AMBIENTS.forEach((sound) => setAmbientVolume(sound, preset.ambientVolumes[sound]));
  };

  const shuffleMix = () => {
    const choices = MIX_PRESETS.filter((preset) => preset.id !== activeMixId);
    const nextPreset = choices[Math.floor(Math.random() * choices.length)] || MIX_PRESETS[0];
    applyMix(nextPreset);
  };

  const copyCurrentMixLink = async () => {
    const params = encodeMixToSearchParams({
      ambientVolumes,
    });
    const url = params
      ? `${window.location.origin}${window.location.pathname}?${params}`
      : `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState(null, "", url);

    try {
      await navigator.clipboard.writeText(url);
      setMixShareState("copied");
    } catch {
      setMixShareState("linked");
    }

    window.setTimeout(() => setMixShareState("idle"), 1800);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 md:p-6 relative overflow-hidden">

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
      </div>

      <header className="w-full max-w-lg flex justify-between items-center pt-2 pb-6 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-foreground/10 rounded-full flex items-center justify-center">
            <Moon className="w-4 h-4 text-foreground" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Zen Noise</span>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <button className="p-2 rounded-full hover:bg-white/5 text-muted-foreground transition-colors" data-testid="btn-info">
              <Info className="w-5 h-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-secondary/95 backdrop-blur border-white/10 text-foreground max-w-sm">
            <DialogHeader>
              <DialogTitle>About Zen Noise</DialogTitle>
              <DialogDescription className="text-muted-foreground pt-2">
                Brown noise produces a deep, rumbling sound that masks external noise effectively. Layer ambient sounds on top to create your perfect soundscape.
                <br /><br />
                Each sound has its own volume control so you can fine-tune the mix. Your settings are saved automatically.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </header>

      <main className="w-full max-w-lg flex flex-col items-center gap-6 z-10 flex-1">

        <div className="flex items-center gap-5 w-full">
          <div className="relative">
            {isPlaying && (
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-50" style={{ animationDuration: '3s' }} />
            )}
            <motion.button
              data-testid="btn-play-pause"
              onClick={togglePlay}
              whileTap={{ scale: 0.92 }}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 shrink-0",
                isPlaying
                  ? "bg-foreground text-background shadow-lg"
                  : "bg-foreground/90 text-background hover:bg-foreground"
              )}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </motion.button>
          </div>

          <button
            type="button"
            onClick={toggleBrownNoise}
            aria-pressed={brownNoiseEnabled}
            data-testid="btn-brown-noise"
            className={cn(
              "flex-1 min-h-16 rounded-2xl border px-4 text-left transition-all duration-200",
              brownNoiseEnabled
                ? "border-primary/35 bg-primary/15 shadow-lg shadow-primary/10"
                : "border-white/[0.05] bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  brownNoiseEnabled ? "bg-primary/20 text-primary" : "bg-white/[0.04] text-muted-foreground/60"
                )}>
                  <Waves className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-foreground/90">Brown Noise</div>
                  <div className="text-[11px] text-muted-foreground/55">{brownNoiseEnabled ? "On" : "Off"}</div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground/50 font-mono">{brownNoiseEnabled ? `${Math.round(brownNoiseLevel * 100)}%` : "0%"}</span>
            </div>
          </button>
        </div>

        {brownNoiseEnabled && (
          <div className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4" data-testid="brown-noise-panel">
            <VolumeSlider volume={brownNoiseLevel} onVolumeChange={changeBrownNoiseLevel} compact />
          </div>
        )}

        <div className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4" data-testid="layer-modulation-panel">
          <WaveControl value={waveIntensity} onChange={setWaveIntensity} />
        </div>

        <MixPresets
          presets={MIX_PRESETS}
          activeMixId={activeMixId}
          shareState={mixShareState}
          onApply={applyMix}
          onShuffle={shuffleMix}
          onCopyLink={copyCurrentMixLink}
        />

        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Ambient Layers</span>
            {activeCount > 0 && (
              <span className="text-xs text-muted-foreground/50">{activeCount} active</span>
            )}
          </div>
          <AmbientSounds
            ambientVolumes={ambientVolumes}
            onVolumeChange={setAmbientVolume}
          />
        </div>

        <div className="w-full bg-white/[0.03] rounded-2xl border border-white/[0.04] p-4">
          <TimerSelector
            selectedDuration={duration}
            remainingSeconds={remaining}
            onSelect={startTimer}
            onCancel={cancelTimer}
            formatTime={formatTime}
          />
        </div>

      </main>

      <footer className="mt-6 mb-4 text-[10px] text-muted-foreground/30 font-mono">
        Generated locally &bull; No data collection
      </footer>

      <InstallPrompt />
    </div>
  );
}

