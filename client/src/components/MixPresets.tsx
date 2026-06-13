import {
  Bell,
  BriefcaseBusiness,
  CloudRain,
  Flame,
  Link2,
  Moon,
  Shuffle,
  TreePine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MixPreset } from "@/lib/mix-presets";

type MixShareState = "idle" | "copied" | "linked";

interface MixPresetsProps {
  presets: MixPreset[];
  activeMixId: string | null;
  shareState: MixShareState;
  onApply: (preset: MixPreset) => void;
  onShuffle: () => void;
  onCopyLink: () => void;
}

const ICONS = {
  focus: BriefcaseBusiness,
  sleep: Moon,
  rain: CloudRain,
  forest: TreePine,
  fire: Flame,
  bowl: Bell,
};

export function MixPresets({
  presets,
  activeMixId,
  shareState,
  onApply,
  onShuffle,
  onCopyLink,
}: MixPresetsProps) {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Mixes</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Shuffle mix"
            title="Shuffle mix"
            onClick={onShuffle}
            className="h-9 w-9 rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            data-testid="btn-mix-shuffle"
          >
            <Shuffle className="mx-auto h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            data-testid="btn-mix-share"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>{shareState === "copied" ? "Copied" : shareState === "linked" ? "Linked" : "Share"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {presets.map((preset) => {
          const Icon = ICONS[preset.icon];
          const isActive = activeMixId === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset)}
              aria-pressed={isActive}
              data-testid={`btn-mix-${preset.id}`}
              className={cn(
                "min-h-[76px] rounded-2xl border p-3 text-left transition-all duration-200",
                "hover:-translate-y-0.5 active:translate-y-0",
                isActive
                  ? "border-primary/40 bg-primary/15 shadow-lg shadow-primary/10"
                  : "border-white/[0.05] bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]",
              )}
            >
              <div className="flex h-full flex-col justify-between gap-3">
                <Icon className={cn("h-4 w-4", isActive ? preset.accent : "text-muted-foreground/55")} />
                <span className={cn("text-sm font-semibold", isActive ? "text-foreground" : "text-foreground/80")}>
                  {preset.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
