import { cn } from "@/lib/utils";
import { Waves } from "lucide-react";
import type { WaveIntensity } from "@/hooks/use-audio-engine";
import { motion } from "framer-motion";

interface WaveControlProps {
  value: WaveIntensity;
  onChange: (val: WaveIntensity) => void;
}

export function WaveControl({ value, onChange }: WaveControlProps) {
  const options: { value: WaveIntensity; label: string }[] = [
    { value: "off", label: "Steady" },
    { value: "low", label: "Gentle" },
    { value: "medium", label: "Deep" },
    { value: "rain", label: "Rain" },
    { value: "coffee", label: "Coffee" },
    { value: "thunder", label: "Storm" },
    { value: "wind", label: "Wind" },
    { value: "birds", label: "Birds" },
    { value: "campfire", label: "Fire" },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between text-muted-foreground mb-4">
        <div className="flex items-center gap-2">
            <Waves className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-widest">Ambient Effects</span>
        </div>
        <span className="text-xs opacity-50">Procedural Synthesis</span>
      </div>

      <div className="grid grid-cols-3 gap-2 p-1 bg-secondary/50 rounded-2xl border border-white/5 relative">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "py-3 text-sm font-medium rounded-xl relative z-10 transition-colors duration-200",
              value === opt.value ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
            {value === opt.value && (
              <motion.div
                layoutId="wave-active-bg"
                className="absolute inset-0 bg-primary rounded-xl -z-10 shadow-lg shadow-primary/20"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
