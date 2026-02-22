import { cn } from "@/lib/utils";
import { Sparkles, CloudRain, Coffee, CloudLightning, Wind, Bird, Flame, Music, Cat, TreePine } from "lucide-react";
import type { AmbientSound } from "@/hooks/use-audio-engine";

interface AmbientSoundsProps {
  activeAmbients: AmbientSound[];
  onToggle: (sound: AmbientSound) => void;
}

const AMBIENT_OPTIONS: { value: AmbientSound; label: string; icon: typeof CloudRain }[] = [
  { value: "rain", label: "Rain", icon: CloudRain },
  { value: "coffee", label: "Coffee", icon: Coffee },
  { value: "thunder", label: "Storm", icon: CloudLightning },
  { value: "wind", label: "Wind", icon: Wind },
  { value: "birds", label: "Birds", icon: Bird },
  { value: "campfire", label: "Fire", icon: Flame },
  { value: "chanting", label: "Chant", icon: Music },
  { value: "purring", label: "Cats", icon: Cat },
  { value: "forest", label: "Forest", icon: TreePine },
];

export function AmbientSounds({ activeAmbients, onToggle }: AmbientSoundsProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between text-muted-foreground mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium uppercase tracking-widest">Ambient Layers</span>
        </div>
        <span className="text-xs opacity-50">Multi-select</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {AMBIENT_OPTIONS.map((opt) => {
          const isActive = activeAmbients.includes(opt.value);
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              data-testid={`btn-ambient-${opt.value}`}
              onClick={() => onToggle(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all duration-200 border",
                isActive
                  ? "bg-primary/15 text-primary border-primary/30 shadow-md shadow-primary/10"
                  : "bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary hover:border-white/10 hover:text-foreground"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive && "text-primary")} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
