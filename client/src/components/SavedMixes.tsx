import { useState, type FormEvent } from "react";
import { Play, Save, Trash2 } from "lucide-react";
import type { SavedMix } from "@/lib/saved-mixes";
import { sanitizeSavedMixName } from "@/lib/saved-mixes";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saved" | "updated" | "empty";

interface SavedMixesProps {
  savedMixes: SavedMix[];
  saveState: SaveState;
  onSave: (name: string) => boolean;
  onApply: (mix: SavedMix) => void;
  onDelete: (id: string) => void;
}

function formatMixSummary(mix: SavedMix): string {
  const activeLayers = Object.values(mix.ambientVolumes).filter((volume) => volume > 0).length;
  const parts = [`${activeLayers} ${activeLayers === 1 ? "layer" : "layers"}`];

  if (mix.brownNoiseEnabled) parts.push(`Brown ${Math.round(mix.brownNoiseLevel * 100)}%`);
  if (mix.waveIntensity !== "steady") parts.push(`${mix.waveIntensity[0].toUpperCase()}${mix.waveIntensity.slice(1)} mod`);

  return parts.join(" / ");
}

export function SavedMixes({ savedMixes, saveState, onSave, onApply, onDelete }: SavedMixesProps) {
  const [mixName, setMixName] = useState("");
  const normalizedName = sanitizeSavedMixName(mixName);

  const submitSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (onSave(normalizedName)) {
      setMixName("");
    }
  };

  return (
    <section className="w-full space-y-3" data-testid="saved-mixes-panel">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Saved Mixes</span>
        <span
          className={cn(
            "min-h-4 text-[10px] font-medium uppercase tracking-widest",
            saveState === "empty" ? "text-destructive" : "text-muted-foreground/50",
          )}
          data-testid="saved-mix-status"
        >
          {saveState === "saved" ? "Saved" : saveState === "updated" ? "Updated" : saveState === "empty" ? "Name required" : ""}
        </span>
      </div>

      <form onSubmit={submitSave} className="flex gap-2">
        <Input
          value={mixName}
          onChange={(event) => setMixName(event.target.value)}
          placeholder="Mix name"
          maxLength={40}
          data-testid="input-saved-mix-name"
          className="h-11 rounded-xl border-white/[0.06] bg-white/[0.03] text-sm placeholder:text-muted-foreground/40 focus-visible:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!normalizedName}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 text-sm font-medium text-foreground/85 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="btn-save-current-mix"
        >
          <Save className="h-4 w-4" />
          <span>Save</span>
        </button>
      </form>

      {savedMixes.length > 0 && (
        <div className="space-y-2">
          {savedMixes.map((mix) => (
            <div
              key={mix.id}
              className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3"
              data-testid={`saved-mix-row-${mix.id}`}
            >
              <button
                type="button"
                onClick={() => onApply(mix)}
                className="min-w-0 flex-1 text-left"
                data-testid={`btn-apply-saved-mix-${mix.id}`}
              >
                <div className="truncate text-sm font-semibold text-foreground/90">{mix.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground/50">{formatMixSummary(mix)}</div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label={`Apply ${mix.name}`}
                  title={`Apply ${mix.name}`}
                  onClick={() => onApply(mix)}
                  className="h-9 w-9 rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
                  data-testid={`btn-play-saved-mix-${mix.id}`}
                >
                  <Play className="mx-auto h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${mix.name}`}
                  title={`Delete ${mix.name}`}
                  onClick={() => onDelete(mix.id)}
                  className="h-9 w-9 rounded-xl border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  data-testid={`btn-delete-saved-mix-${mix.id}`}
                >
                  <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
