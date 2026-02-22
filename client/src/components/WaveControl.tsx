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
    { value: "steady", label: "Steady" },
    { value: "gentle", label: "Gentle" },
    { value: "deep", label: "Deep" },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Waves className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Modulation</span>
        </div>
      </div>

      <div className="flex p-1 bg-white/[0.03] rounded-xl border border-white/[0.04] relative">
        {options.map((opt) => (
          <button
            key={opt.value}
            data-testid={`btn-wave-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 py-2 text-xs font-medium rounded-lg relative z-10 transition-colors duration-200",
              value === opt.value ? "text-primary-foreground" : "text-muted-foreground/60 hover:text-foreground"
            )}
          >
            {opt.label}
            {value === opt.value && (
              <motion.div
                layoutId="wave-active-bg"
                className="absolute inset-0 bg-primary rounded-lg -z-10 shadow-lg shadow-primary/20"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
