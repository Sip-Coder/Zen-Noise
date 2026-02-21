import { useEffect, useState } from "react";
import { useAudioEngine, type WaveIntensity } from "@/hooks/use-audio-engine";
import { useTimer } from "@/hooks/use-timer";
import { VolumeSlider } from "@/components/VolumeSlider";
import { TimerSelector } from "@/components/TimerSelector";
import { WaveControl } from "@/components/WaveControl";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Play, Pause, Moon, Info } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Home() {
  // Restore settings from local storage if available
  const savedVolume = parseFloat(localStorage.getItem('brown_noise_volume') || '0.5');
  const savedWave = (localStorage.getItem('brown_noise_wave') as WaveIntensity) || 'off';

  const {
    isPlaying,
    volume,
    waveIntensity,
    togglePlay,
    setVolume,
    setWaveIntensity,
    stopWithFade
  } = useAudioEngine(savedVolume);

  // Sync state with local storage
  useEffect(() => {
    localStorage.setItem('brown_noise_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('brown_noise_wave', waveIntensity);
    // On mount, set the initial wave intensity in the engine
    setWaveIntensity(savedWave);
  }, []); // Run once on mount to sync, then rely on setWaveIntensity

  const { duration, remaining, startTimer, cancelTimer, formatTime } = useTimer(() => {
    stopWithFade(10); // 10s fade out when timer ends
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Ambient Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
      </div>

      <header className="absolute top-6 left-0 w-full px-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground/10 rounded-full flex items-center justify-center">
                <Moon className="w-4 h-4 text-foreground" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">Zen Noise</span>
        </div>
        
        <Dialog>
            <DialogTrigger asChild>
                <button className="p-2 rounded-full hover:bg-white/5 text-muted-foreground transition-colors">
                    <Info className="w-5 h-5" />
                </button>
            </DialogTrigger>
            <DialogContent className="bg-secondary/95 backdrop-blur border-white/10 text-foreground max-w-sm">
                <DialogHeader>
                    <DialogTitle>About Brown Noise</DialogTitle>
                    <DialogDescription className="text-muted-foreground pt-2">
                        Brown noise mimics the frequency response of deep ocean roar or thunder. It cuts high frequencies to produce a deep, rumbling sound that masks external noise effectively.
                        <br/><br/>
                        <strong>Tip:</strong> Keep the volume low. It should blend into the background, not dominate it.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
      </header>

      <main className="w-full max-w-md flex flex-col items-center gap-12 z-10">
        
        {/* Play Button */}
        <div className="relative group">
            {/* Pulsing ring when playing */}
            {isPlaying && (
                <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-75 duration-[3000ms]" />
            )}
            
            <motion.button
              onClick={togglePlay}
              whileTap={{ scale: 0.95 }}
              animate={{ 
                boxShadow: isPlaying 
                  ? "0 0 60px -15px rgba(var(--primary), 0.3)" 
                  : "0 0 0px 0px rgba(0,0,0,0)"
              }}
              className="w-32 h-32 md:w-40 md:h-40 bg-foreground text-background rounded-full flex items-center justify-center shadow-2xl relative z-10 hover:scale-105 transition-transform duration-300"
            >
              {isPlaying ? (
                <Pause className="w-12 h-12 md:w-14 md:h-14 fill-current" />
              ) : (
                <Play className="w-12 h-12 md:w-14 md:h-14 fill-current ml-2" />
              )}
            </motion.button>
        </div>

        {/* Controls Container */}
        <div className="w-full space-y-8 bg-white/5 backdrop-blur-sm p-6 md:p-8 rounded-3xl border border-white/5 shadow-xl">
            {/* Volume */}
            <div className="space-y-3">
                <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>Volume</span>
                </div>
                <VolumeSlider volume={volume} onVolumeChange={setVolume} />
            </div>
            
            <div className="h-px bg-white/5 w-full" />

            {/* Wave Setting */}
            <WaveControl value={waveIntensity} onChange={setWaveIntensity} />

            <div className="h-px bg-white/5 w-full" />

            {/* Timer */}
            <TimerSelector 
              selectedDuration={duration}
              remainingSeconds={remaining}
              onSelect={startTimer}
              onCancel={cancelTimer}
              formatTime={formatTime}
            />
        </div>

      </main>

      <footer className="absolute bottom-6 text-xs text-muted-foreground/40 font-mono">
        Generated locally • No data collection
      </footer>
      
      <InstallPrompt />
    </div>
  );
}
