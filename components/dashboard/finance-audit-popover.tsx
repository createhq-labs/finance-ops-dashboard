"use client";

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// Mirrors the Finance User audit popover style (UserAuditPopover in
// app/(dashboard)/dashboard/users/page.tsx): same shell, header, optional
// toggle button, and close button. Content is supplied by the caller so this
// stays generic instead of duplicating that page-local component.
//
// Positioning reuses the measure-then-place technique already used by the
// change-summary popover in submission-table.tsx (updateChangeSummaryPosition):
// render once off-screen, measure the real rendered size via refs, then flip
// above the trigger / shift left as needed so the popover always stays fully
// inside the viewport, with no hardcoded screen sizes.
const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 10;
const HORIZONTAL_ANCHOR_OFFSET = 120;

export function FinanceAuditPopover({
  rect,
  title,
  subtitle,
  onClose,
  toggle,
  children,
}: {
  rect: DOMRect;
  title: string;
  subtitle: string;
  onClose: () => void;
  toggle?: {
    icon: ReactNode;
    active: boolean;
    onClick: () => void;
    ariaLabel: string;
  };
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function updatePosition() {
      const node = ref.current;
      if (!node || typeof window === 'undefined') return;

      const popoverWidth = node.offsetWidth;
      const popoverHeight = node.offsetHeight;

      // Prefer opening below the trigger; flip above it only when the
      // preferred bottom placement would overflow the viewport.
      let top = rect.bottom + TRIGGER_GAP;
      if (top + popoverHeight > window.innerHeight - VIEWPORT_MARGIN) {
        top = rect.top - popoverHeight - TRIGGER_GAP;
      }
      top = Math.min(
        Math.max(VIEWPORT_MARGIN, top),
        Math.max(VIEWPORT_MARGIN, window.innerHeight - popoverHeight - VIEWPORT_MARGIN)
      );

      // Shift left whenever the right edge would overflow, so the full width
      // stays visible.
      let left = rect.left - HORIZONTAL_ANCHOR_OFFSET;
      if (left + popoverWidth > window.innerWidth - VIEWPORT_MARGIN) {
        left = window.innerWidth - popoverWidth - VIEWPORT_MARGIN;
      }
      left = Math.max(VIEWPORT_MARGIN, left);

      setPosition((current) => (current && current.top === top && current.left === left ? current : { top, left }));
    }

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [rect, children]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-finance-audit-popover="true"]')) return;
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (typeof window === 'undefined') return null;

  return (
    <div
      ref={ref}
      data-finance-audit-popover="true"
      className="fixed z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card p-4 shadow-2xl"
      style={{
        // Off-screen until the first measurement lands, avoiding a flash at
        // the wrong position (same technique as updateChangeSummaryPosition).
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {toggle ? (
            <button
              type="button"
              onClick={toggle.onClick}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                toggle.active
                  ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/12 dark:text-sky-200'
                  : 'border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              aria-label={toggle.ariaLabel}
            >
              {toggle.icon}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close audit details"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">{children}</div>
    </div>
  );
}

export function FinanceAuditCard({
  label,
  value,
  lines,
}: {
  label: string;
  value: string;
  lines?: string[];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground dark:text-sky-300">{label}</div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
      {lines?.map((line) => (
        <div key={line} className="mt-1 text-xs text-muted-foreground">
          {line}
        </div>
      ))}
    </div>
  );
}
