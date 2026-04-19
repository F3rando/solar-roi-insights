import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type MetricGlossaryKey, METRIC_GLOSSARY } from "@/content/metricGlossary";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Open: fly to center, then crossfade metric → glossary (no 3D — avoids mirrored/blank GPU bugs). */
const OPEN_MOVE_DURATION = 0.72;
const OPEN_GLOSSARY_DELAY = 0.05;
const OPEN_CROSSFADE_DURATION = 1;

/** Close: glossary → metric crossfade runs in parallel with dimmer fade and fly-back (no wait on overlay). */
const CLOSE_CROSSFADE_DURATION = 1;
const CLOSE_SHRINK_DELAY = 0.04;
const CLOSE_SHRINK_DURATION = 0.62;

/** Card motion end (open / close) — overlay fades finish this much earlier for a softer handoff. */
const OVERLAY_LEAD_S = 0.14;

const OPEN_CARD_END_S = Math.max(OPEN_MOVE_DURATION, OPEN_GLOSSARY_DELAY + OPEN_CROSSFADE_DURATION);

/** Longest parallel close leg (crossfade vs shrink) — not their sum. */
const CLOSE_MOTION_END_S = Math.max(CLOSE_CROSSFADE_DURATION, CLOSE_SHRINK_DELAY + CLOSE_SHRINK_DURATION);

/** Backdrop eases in / out over this length (slightly shorter than the card so it settles first). */
const OPEN_OVERLAY_DURATION = Math.max(0.32, OPEN_CARD_END_S - OVERLAY_LEAD_S);
const CLOSE_OVERLAY_DURATION = Math.max(0.26, CLOSE_MOTION_END_S - OVERLAY_LEAD_S);

type Box = { top: number; left: number; width: number; height: number };

function expandedFrame(o: Box): { top: number; left: number; width: number; height: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const width = Math.min(Math.max(o.width * 2, 550), vw * 0.92);
  const height = Math.min(Math.max(o.height * 1.8, 300), vh * 0.78);
  return {
    width,
    height,
    top: (vh - height) / 2,
    left: (vw - width) / 2,
  };
}

type MetricFlipCardProps = {
  metricKey: MetricGlossaryKey;
  className?: string;
  front: React.ReactNode;
};

export function MetricFlipCard({ metricKey, className, front }: MetricFlipCardProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<Box | null>(null);
  const [open, setOpen] = useState(false);
  /** True while portal exit runs — keeps layout shell hidden so it doesn't flash over the flying card. */
  const [exitInProgress, setExitInProgress] = useState(false);
  /** Portal only: glossary layer on top after delay; false during fly and while closing so the metric front shows. */
  const [showGlossary, setShowGlossary] = useState(false);
  const [mounted, setMounted] = useState(false);
  const entry = METRIC_GLOSSARY[metricKey];
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setShowGlossary(true), OPEN_GLOSSARY_DELAY * 1000);
    return () => window.clearTimeout(id);
  }, [open]);

  const close = useCallback(() => {
    setShowGlossary(false);
    setExitInProgress(true);
    setOpen(false);
  }, []);

  const openFromShell = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    snapRef.current = { top: r.top, left: r.left, width: r.width, height: r.height };
    setShowGlossary(false);
    setExitInProgress(false);
    setOpen(true);
  }, []);

  const shellHidden = open || exitInProgress;

  useEffect(() => {
    if (!shellHidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [shellHidden, close]);

  const src = snapRef.current;
  const dest = src ? expandedFrame(src) : null;

  const outerVariants =
    src && dest
      ? {
          collapsed: {
            top: src.top,
            left: src.left,
            width: src.width,
            height: src.height,
            transition: {
              duration: CLOSE_SHRINK_DURATION,
              delay: CLOSE_SHRINK_DELAY,
              ease: EASE,
            },
          },
          expanded: {
            top: dest.top,
            left: dest.left,
            width: dest.width,
            height: dest.height,
            transition: { duration: OPEN_MOVE_DURATION, ease: EASE },
          },
        }
      : null;

  /** Inline beats `.panel { backdrop-filter }` in the portal (no 3D, but keeps compositing predictable). */
  const portalFrontChromeStyle = {
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  } as const;

  const crossfadeDuration = showGlossary ? OPEN_CROSSFADE_DURATION : CLOSE_CROSSFADE_DURATION;

  /** `animate` can stay stale on exiting trees; `exit` runs on unmount so close always crossfades. */
  const closeCrossfadeEase = { duration: CLOSE_CROSSFADE_DURATION, ease: EASE } as const;

  const overlay =
    mounted && src && dest && outerVariants ? (
      <AnimatePresence
        onExitComplete={() => {
          snapRef.current = null;
          setExitInProgress(false);
          setShowGlossary(false);
        }}
      >
        {open ? (
          <motion.div
            key="metric-flip-layer"
            className="fixed inset-0 z-[600]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            /* Hold presence for the full close window so nested exit crossfades + backdrop + shrink can finish. */
            exit={{
              opacity: [1, 1],
              transition: { duration: CLOSE_MOTION_END_S, ease: EASE, times: [0, 1] },
            }}
          >
            <motion.div
              className="absolute inset-0 z-0 bg-black/75"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: OPEN_OVERLAY_DURATION, ease: EASE },
              }}
              exit={{
                opacity: 0,
                transition: { duration: CLOSE_OVERLAY_DURATION, ease: EASE },
              }}
              onClick={close}
            />
            <motion.div
              className="absolute z-10"
              variants={outerVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-full w-full">
                <div className="absolute inset-0 h-full w-full overflow-hidden rounded-xl bg-card shadow-2xl">
                  <motion.div
                    className={cn(
                      "absolute inset-0 overflow-hidden rounded-[inherit] text-left",
                      showGlossary && "pointer-events-none",
                    )}
                    initial={false}
                    animate={{ opacity: showGlossary ? 0 : 1 }}
                    exit={{ opacity: 1, transition: closeCrossfadeEase }}
                    transition={{ duration: crossfadeDuration, ease: EASE }}
                  >
                    <div
                      className={cn("h-full min-h-0 overflow-hidden rounded-[inherit] text-left", className)}
                      style={portalFrontChromeStyle}
                    >
                      <div className="pointer-events-none h-full min-h-0 select-none">{front}</div>
                    </div>
                  </motion.div>
                  <motion.div
                    className={cn(
                      "absolute inset-0 z-[1] flex flex-col overflow-hidden rounded-[inherit] border border-primary/30 bg-card p-4 text-left sm:p-5",
                      !showGlossary && "pointer-events-none",
                    )}
                    initial={false}
                    animate={{ opacity: showGlossary ? 1 : 0 }}
                    exit={{ opacity: 0, transition: closeCrossfadeEase }}
                    transition={{ duration: crossfadeDuration, ease: EASE }}
                    aria-hidden={!showGlossary}
                    aria-labelledby={titleId}
                  >
                    <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="min-w-0">
                        <h2 id={titleId} className="text-lg font-semibold leading-tight">
                          {entry.title}
                        </h2>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-primary/90">
                          {entry.source}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={close}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close metric details"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-0.5 text-sm leading-relaxed text-foreground/90">
                      {entry.body.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                    <p className="mt-2 shrink-0 text-[10px] text-muted-foreground">Click outside or Esc to close.</p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    ) : null;

  return (
    <>
      <div
        ref={shellRef}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${entry.title}: open metric details`}
        style={shellHidden ? { visibility: "hidden" } : undefined}
        aria-hidden={shellHidden}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFromShell();
          }
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-metric-flip-ignore]")) return;
          openFromShell();
        }}
        className={cn(
          "cursor-pointer text-left outline-none transition-[box-shadow,border-color]",
          "hover:border-primary/40 hover:shadow-[0_0_24px_oklch(0.55_0.12_145_/_0.12)]",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          shellHidden && "pointer-events-none select-none",
          className,
        )}
      >
        {front}
      </div>
      {mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}
