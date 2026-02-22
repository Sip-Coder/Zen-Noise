import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface VolumeSliderProps {
  volume: number;
  onVolumeChange: (val: number) => void;
  className?: string;
  compact?: boolean;
}

export function VolumeSlider({ volume, onVolumeChange, className, compact }: VolumeSliderProps) {
  if (compact) {
    return (
      <div className={cn("w-full flex items-center gap-3", className)}>
        <button
          onClick={() => onVolumeChange(volume === 0 ? 0.5 : 0)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          data-testid="btn-mute"
        >
          {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <div className="relative flex-1 h-6 flex items-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-full z-10 opacity-0 cursor-pointer h-full absolute inset-0"
            aria-label="Volume"
            data-testid="slider-volume"
          />
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-foreground/80 absolute left-0 top-0 transition-all duration-100 ease-out rounded-full"
              style={{ width: `${volume * 100}%` }}
            />
          </div>
          <div
            className="w-4 h-4 bg-white rounded-full shadow-md absolute pointer-events-none transition-all duration-100 ease-out"
            style={{ left: `calc(${volume * 100}% - 8px)` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-xs flex items-center gap-4", className)}>
      <button
        onClick={() => onVolumeChange(0)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        data-testid="btn-mute"
      >
        {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      <div className="relative flex-1 h-12 flex items-center">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full z-10 opacity-0 cursor-pointer h-full absolute inset-0"
          aria-label="Volume"
          data-testid="slider-volume"
        />
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden relative">
          <div
            className="h-full bg-foreground absolute left-0 top-0 transition-all duration-100 ease-out"
            style={{ width: `${volume * 100}%` }}
          />
        </div>
        <div
          className="w-6 h-6 bg-white rounded-full shadow-lg absolute pointer-events-none transition-all duration-100 ease-out flex items-center justify-center"
          style={{ left: `calc(${volume * 100}% - 12px)` }}
        >
          <div className="w-1.5 h-1.5 bg-black rounded-full opacity-20" />
        </div>
      </div>

      <span className="text-sm font-medium w-8 text-right font-mono text-muted-foreground">
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}
