import { cn } from "@/lib/utils";
import { CloudRain, Coffee, CloudLightning, Wind, Bird, Flame, Bell, Cat, TreePine } from "lucide-react";
import type { AmbientSound, AmbientVolumes } from "@/hooks/use-audio-engine";

interface AmbientSoundsProps {
  ambientVolumes: AmbientVolumes;
  onVolumeChange: (sound: AmbientSound, vol: number) => void;
}

const AMBIENT_OPTIONS: { value: AmbientSound; label: string; icon: typeof CloudRain; color: string }[] = [
  { value: "rain", label: "Rain", icon: CloudRain, color: "from-blue-500/20 to-blue-600/5" },
  { value: "coffee", label: "Coffee", icon: Coffee, color: "from-amber-500/20 to-amber-600/5" },
  { value: "thunder", label: "Storm", icon: CloudLightning, color: "from-purple-500/20 to-purple-600/5" },
  { value: "wind", label: "Wind", icon: Wind, color: "from-teal-500/20 to-teal-600/5" },
  { value: "birds", label: "Birds", icon: Bird, color: "from-green-500/20 to-green-600/5" },
  { value: "campfire", label: "Fire", icon: Flame, color: "from-orange-500/20 to-orange-600/5" },
  { value: "ring", label: "Ring", icon: Bell, color: "from-indigo-500/20 to-indigo-600/5" },
  { value: "purring", label: "Cats", icon: Cat, color: "from-pink-500/20 to-pink-600/5" },
  { value: "forest", label: "Forest", icon: TreePine, color: "from-emerald-500/20 to-emerald-600/5" },
];

const ACTIVE_COLORS: Record<AmbientSound, string> = {
  rain: "text-blue-400",
  coffee: "text-amber-400",
  thunder: "text-purple-400",
  wind: "text-teal-400",
  birds: "text-green-400",
  campfire: "text-orange-400",
  ring: "text-indigo-400",
  purring: "text-pink-400",
  forest: "text-emerald-400",
};

const ACTIVE_BG: Record<AmbientSound, string> = {
  rain: "bg-blue-500",
  coffee: "bg-amber-500",
  thunder: "bg-purple-500",
  wind: "bg-teal-500",
  birds: "bg-green-500",
  campfire: "bg-orange-500",
  ring: "bg-indigo-500",
  purring: "bg-pink-500",
  forest: "bg-emerald-500",
};

export function AmbientSounds({ ambientVolumes, onVolumeChange }: AmbientSoundsProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-3">
        {AMBIENT_OPTIONS.map((opt) => {
          const vol = ambientVolumes[opt.value];
          const isActive = vol > 0;
          const Icon = opt.icon;
          return (
            <div
              key={opt.value}
              data-testid={`ambient-tile-${opt.value}`}
              className={cn(
                "relative flex flex-col items-center rounded-2xl transition-all duration-300 overflow-hidden",
                isActive
                  ? `bg-gradient-to-b ${opt.color} border border-white/10`
                  : "bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06]"
              )}
            >
              <button
                data-testid={`btn-ambient-${opt.value}`}
                onClick={() => onVolumeChange(opt.value, isActive ? 0 : 0.5)}
                className="w-full pt-4 pb-2 flex flex-col items-center gap-1.5"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isActive ? `bg-white/10` : "bg-white/[0.04]"
                )}>
                  <Icon className={cn(
                    "w-5 h-5 transition-colors duration-300",
                    isActive ? ACTIVE_COLORS[opt.value] : "text-muted-foreground/60"
                  )} />
                </div>
                <span className={cn(
                  "text-[11px] font-medium tracking-wide transition-colors duration-300",
                  isActive ? "text-foreground/90" : "text-muted-foreground/50"
                )}>
                  {opt.label}
                </span>
              </button>

              <div className={cn(
                "w-full px-3 pb-3 transition-all duration-300",
                isActive ? "opacity-100 h-10" : "opacity-0 h-0 overflow-hidden"
              )}>
                <div className="relative w-full h-6 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={vol}
                    onChange={(e) => onVolumeChange(opt.value, parseFloat(e.target.value))}
                    className="w-full absolute inset-0 z-10 opacity-0 cursor-pointer h-full"
                    data-testid={`slider-ambient-${opt.value}`}
                  />
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-100", ACTIVE_BG[opt.value])}
                      style={{ width: `${vol * 100}%` }}
                    />
                  </div>
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full absolute pointer-events-none transition-all duration-100 shadow-sm",
                      ACTIVE_BG[opt.value]
                    )}
                    style={{ left: `calc(${vol * 100}% - 7px)` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
