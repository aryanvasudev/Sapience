"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * The study panel's width on wide screens, set by dragging its left edge. Stored per browser; with
 * nothing stored, the layout's default column width applies. Exposed to CSS as `--panel-w`.
 */
const STORAGE_KEY = "sapience:study-panel-width";
const MIN_PX = 320;
const MAX_PX = 820;
/** The video column keeps at least this share of the layout. */
const MIN_VIDEO_SHARE = 0.4;
/** Half the layout's column gap (gap-8): the handle sits in the middle of it. */
const HALF_GAP_PX = 16;
const KEY_STEP_PX = 24;

function clampWidth(px: number, layoutWidth: number): number {
  const max = Math.min(MAX_PX, layoutWidth * (1 - MIN_VIDEO_SHARE));
  return Math.round(Math.min(Math.max(px, MIN_PX), Math.max(MIN_PX, max)));
}

export function useStudyPanelWidth(layout: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount
      if (stored > 0) setWidth(stored);
    } catch {
      // Storage blocked: keep the default width.
    }
  }, []);

  const save = useCallback((px: number | null) => {
    setWidth(px);
    try {
      if (px === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(px));
    } catch {
      // Storage blocked: the width still applies for this visit.
    }
  }, []);

  const resizeTo = useCallback(
    (px: number) => {
      const box = layout.current?.getBoundingClientRect();
      if (box) save(clampWidth(px, box.width));
    },
    [layout, save],
  );

  const current = useCallback(() => {
    const panel = layout.current?.lastElementChild;
    return panel instanceof HTMLElement ? panel.getBoundingClientRect().width : (width ?? MIN_PX);
  }, [layout, width]);

  return { width, resizeTo, reset: () => save(null), current };
}

export function PanelResizer({
  layout,
  panel,
}: {
  layout: RefObject<HTMLElement | null>;
  panel: ReturnType<typeof useStudyPanelWidth>;
}) {
  const dragging = useRef(false);
  const [active, setActive] = useState(false);

  const widthAt = (clientX: number) => {
    const box = layout.current?.getBoundingClientRect();
    return box ? box.right - clientX - HALF_GAP_PX : null;
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the study panel"
      aria-valuenow={panel.width ?? undefined}
      aria-valuemin={MIN_PX}
      aria-valuemax={MAX_PX}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        setActive(true);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const px = widthAt(event.clientX);
        if (px !== null) panel.resizeTo(px);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        setActive(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setActive(false);
      }}
      onDoubleClick={panel.reset}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          panel.resizeTo(panel.current() + (event.key === "ArrowLeft" ? KEY_STEP_PX : -KEY_STEP_PX));
        }
      }}
      data-active={active || undefined}
      className="group absolute inset-y-0 -left-5 z-10 hidden w-2 cursor-col-resize touch-none justify-center outline-none lg:flex"
    >
      <span
        aria-hidden
        className="h-full w-px rounded-full bg-transparent transition-colors duration-150 ease-(--ease-out) group-hover:bg-border group-focus-visible:bg-ring group-data-active:bg-ring"
      />
    </div>
  );
}
