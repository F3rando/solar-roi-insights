import { useMemo } from "react";
import { ArrowUpRight, PiggyBank } from "lucide-react";
import type { Inputs, Zone } from "@/lib/solar";
import { cumulativeSavings, fmtUsd, paybackYears } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  payback: number;
  savings25: number;
};

export function TopOpportunitiesCard({
  zones,
  inputs,
  regionRows,
  selectedId,
  onSelect,
}: {
  zones: Zone[];
  inputs: Inputs;
  regionRows: RegionRowV1[] | null | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => {
    const byId = new Map((regionRows ?? []).map((r) => [r.id, r]));
    const computed: Row[] = zones.map((z) => {
      const ins = byId.get(z.id)?.solar_insights ?? null;
      return {
        id: z.id,
        name: z.name,
        payback: paybackYears(z, inputs, ins),
        savings25: cumulativeSavings(z, inputs, 25, ins),
      };
    });
    return computed;
  }, [zones, inputs, regionRows]);

  const topSavings = useMemo(
    () => [...rows].sort((a, b) => b.savings25 - a.savings25).slice(0, 5),
    [rows],
  );

  return (
    <div className="panel p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Top opportunities
          </div>
          <div className="text-sm mt-1">Highest 25-year savings</div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
          Click to focus <ArrowUpRight className="inline size-3 -mt-0.5" aria-hidden />
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-0">
        <MiniList
          title="Highest 25-yr savings"
          icon={<PiggyBank className="size-3.5" aria-hidden />}
          rows={topSavings.map((r) => ({
            ...r,
            right: fmtUsd(r.savings25),
          }))}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function MiniList({
  title,
  icon,
  rows,
  selectedId,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<{ id: string; name: string; right: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-foreground/80">
          <span className="text-solar">{icon}</span>
          <span className="font-semibold">{title}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Top 5
        </span>
      </div>

      <div className="mt-2 space-y-1">
        {rows.map((r, idx) => {
          const selected = r.id === selectedId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={cn(
                "w-full rounded-lg px-2.5 py-2 text-left transition border flex items-center justify-between gap-3",
                selected
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/50 bg-background/20 hover:bg-accent/40 hover:border-border/70",
              )}
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <span
                  className={cn(
                    "w-5 shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground",
                    selected && "text-primary",
                  )}
                >
                  {idx + 1}
                </span>
                <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-foreground/85")}>
                  {r.name}
                </span>
              </div>
              <span className={cn("shrink-0 text-xs font-mono tabular-nums", selected ? "text-primary" : "text-muted-foreground")}>
                {r.right}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

