import { useEffect } from "react";
import { useAudioEngine, type WaveIntensity, type AmbientVolumes } from "@/hooks/use-audio-engine";
import { useTimer } from "@/hooks/use-timer";
import { VolumeSlider } from "@/components/VolumeSlider";
import { TimerSelector } from "@/components/TimerSelector";
import { WaveControl } from "@/components/WaveControl";
import { AmbientSounds } from "@/components/AmbientSounds";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Play, Pause, Moon, Info } from "lucide-react";
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

const DEFAULT_AMBIENT_VOLUMES: AmbientVolumes = {
  rain: 0, coffee: 0, thunder: 0, wind: 0, birds: 0,
  campfire: 0, chanting: 0, purring: 0, forest: 0,
};

function loadSavedAmbientVolumes(): AmbientVolumes {
  try {
    const saved = localStorage.getItem('zen_ambient_volumes');
    if (saved) return { ...DEFAULT_AMBIENT_VOLUMES, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_AMBIENT_VOLUMES };
}

export default function Home() {
  const savedVolume = parseFloat(localStorage.getItem('brown_noise_volume') || '0.5');
  const savedWave = (localStorage.getItem('brown_noise_wave') as WaveIntensity) || 'steady';
  const savedAmbientVolumes = loadSavedAmbientVolumes();

  const {
    isPlaying,
    volume,
    waveIntensity,
    ambientVolumes,
    togglePlay,
    setVolume,
    setWaveIntensity,
    setAmbientVolume,
    stopWithFade
  } = useAudioEngine(savedVolume, savedAmbientVolumes);

  useEffect(() => {
    localStorage.setItem('brown_noise_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    setWaveIntensity(savedWave);
  }, []);

  useEffect(() => {
    localStorage.setItem('brown_noise_wave', waveIntensity);
  }, [waveIntensity]);

  useEffect(() => {
    localStorage.setItem('zen_ambient_volumes', JSON.stringify(ambientVolumes));
  }, [ambientVolumes]);

  const { duration, remaining, startTimer, cancelTimer, formatTime } = useTimer(() => {
    stopWithFade(10);
  });

  const activeCount = Object.values(ambientVolumes).filter(v => v > 0).length;

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

          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Brown Noise</span>
              <span className="text-xs text-muted-foreground/50 font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <VolumeSlider volume={volume} onVolumeChange={setVolume} compact />
          </div>
        </div>

        <WaveControl value={waveIntensity} onChange={setWaveIntensity} />

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

