import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

const PRESETS = [15, 30, 45, 60, 90, 120];

interface TimerSelectorProps {
  selectedDuration: number;
  remainingSeconds: number;
  onSelect: (minutes: number) => void;
  onCancel: () => void;
  formatTime: (seconds: number) => void;
}

export function TimerSelector({ 
  selectedDuration, 
  remainingSeconds, 
  onSelect, 
  onCancel,
  formatTime 
}: TimerSelectorProps) {
  
  if (selectedDuration > 0 && remainingSeconds > 0) {
    return (
      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-4xl font-mono font-bold tracking-wider text-foreground mb-2">
          {/* @ts-ignore */}
          {formatTime(remainingSeconds)}
        </div>
        <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Timer Active</span>
            <button 
                onClick={onCancel}
                className="text-xs px-3 py-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium transition-colors"
            >
                Stop Timer
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium uppercase tracking-widest">Sleep Timer</span>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {PRESETS.map((mins) => (
          <button
            key={mins}
            onClick={() => onSelect(mins)}
            className={cn(
              "px-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 border",
              "hover:-translate-y-0.5 active:translate-y-0",
              selectedDuration === mins
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                : "bg-secondary/50 text-secondary-foreground border-transparent hover:bg-secondary hover:border-white/10"
            )}
          >
            {mins}m
          </button>
        ))}
      </div>
    </div>
  );
}
