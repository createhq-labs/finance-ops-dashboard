"use client";

import { AlertCircle, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { inferAddressData } from "../../lib/shared/address-utils";
import type { GstMappingOption } from "./types";

type Props = {
  value: string;
  mode: "existing" | "new";
  options: GstMappingOption[];
  onSelect: (value: string) => void;
  onStartAddNew: () => void;
  onClear: () => void;
};

const GST_PATTERN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function normalizeGstInput(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 15);
}

function formatGstForDisplay(value: string) {
  const normalized = normalizeGstInput(value);
  if (!normalized) return "";

  const groups = [
    normalized.slice(0, 2),
    normalized.slice(2, 12),
    normalized.slice(12, 13),
    normalized.slice(13, 14),
    normalized.slice(14, 15),
  ].filter(Boolean);

  return groups.join(" ");
}

function deriveCity(option: GstMappingOption) {
  const address = option.address?.trim() ?? "";
  if (address) {
    const inferred = inferAddressData(address, option.country?.trim().toLowerCase() === "india" ? "Indian" : "Foreign");
    if (inferred.city.trim()) return inferred.city.trim();
  }

  const fallback = option.city?.trim() ?? "";
  if (/^[0-9]{4,}$/.test(fallback)) return "";
  if (fallback.toLowerCase() == (option.country || "").trim().toLowerCase()) return "";
  return fallback;
}

function highlightMatch(text: string, query: string, stripSpaces = false) {
  const needle = stripSpaces ? query.replace(/\s+/g, "") : query.trim();
  if (!needle) return text;

  const source = stripSpaces ? text.replace(/\s+/g, "") : text;
  const matchIndex = source.toLowerCase().indexOf(needle.toLowerCase());
  if (matchIndex < 0) return text;

  if (!stripSpaces) {
    const before = text.slice(0, matchIndex);
    const match = text.slice(matchIndex, matchIndex + needle.length);
    const after = text.slice(matchIndex + needle.length);
    return (
      <>
        {before}
        <mark className="rounded-sm bg-amber-200/70 px-0.5 text-current dark:bg-amber-300/25">{match}</mark>
        {after}
      </>
    );
  }

  let compactIndex = 0;
  let visualStart = -1;
  let visualEnd = -1;

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === " ") continue;
    if (compactIndex === matchIndex && visualStart === -1) visualStart = i;
    compactIndex += 1;
    if (compactIndex === matchIndex + needle.length) {
      visualEnd = i + 1;
      break;
    }
  }

  if (visualStart < 0 || visualEnd < 0) return text;

  return (
    <>
      {text.slice(0, visualStart)}
      <mark className="rounded-sm bg-amber-200/70 px-0.5 text-current dark:bg-amber-300/25">{text.slice(visualStart, visualEnd)}</mark>
      {text.slice(visualEnd)}
    </>
  );
}

function StatusPill({ pending }: { pending: boolean }) {
  return (
    <span
      className={pending ? "gst-picker-badge gst-picker-badge-warning" : "gst-picker-badge gst-picker-badge-success"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        border: 0,
        outline: 0,
        boxShadow: "none",
        background: pending
          ? "color-mix(in srgb, var(--chart-5) 18%, transparent)"
          : "color-mix(in srgb, var(--success) 18%, transparent)",
        color: pending ? "var(--chart-5)" : "var(--success)",
      }}
    >
      {pending ? "Pending" : "Approved"}
    </span>
  );
}

export function GstNumberPicker({ value, mode, options, onSelect, onStartAddNew, onClear }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const editRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editingPendingValue, setEditingPendingValue] = useState(false);
  const [showInvalidHint, setShowInvalidHint] = useState(false);

  const normalizedValue = normalizeGstInput(value);
  const selectedEntry = useMemo(
    () => options.find((option) => normalizeGstInput(option.gstNumber) === normalizedValue) ?? null,
    [normalizedValue, options]
  );
  const pendingSelection = Boolean(normalizedValue) && !selectedEntry && mode === "new";
  const normalizedQuery = normalizeGstInput(query);
  const canAddNew = GST_PATTERN.test(normalizedQuery);

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const compact = query.replace(/\s+/g, "").toLowerCase();
    if (!trimmed) return options;

    return options.filter((option) => {
      const gst = normalizeGstInput(option.gstNumber).toLowerCase();
      const meta = [option.entityName, deriveCity(option)].filter(Boolean).join(" ").toLowerCase();
      return gst.includes(compact) || meta.includes(trimmed);
    });
  }, [options, query]);

  const showAddState = normalizedQuery.length > 0 && filteredOptions.length === 0;
  const remainingCharacters = Math.max(15 - normalizedQuery.length, 0);
  const hasCompleteInvalidGst = normalizedQuery.length === 15 && !canAddNew;

  useEffect(() => {
    if (!editingPendingValue) return;
    requestAnimationFrame(() => editRef.current?.focus());
  }, [editingPendingValue]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setShowInvalidHint(false);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!hasCompleteInvalidGst) {
      setShowInvalidHint(false);
    }
  }, [hasCompleteInvalidGst]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function handleAddNew() {
    if (!canAddNew) return;
    onStartAddNew();
    onSelect(normalizedQuery);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      {editingPendingValue ? (
        <input
          ref={editRef}
          className="intake-input font-mono"
          value={formatGstForDisplay(normalizedValue)}
          onChange={(event) => onSelect(normalizeGstInput(event.target.value))}
          onBlur={() => setEditingPendingValue(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              setEditingPendingValue(false);
            }
          }}
          autoComplete="off"
        />
      ) : (
      <button
        type="button"
        className={`intake-select-trigger ${open ? "intake-select-trigger-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        onDoubleClick={(event) => {
          if (!pendingSelection) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setEditingPendingValue(true);
        }}
      >
        <span className="intake-select-trigger-label" style={{ fontSize: 13 }}>
          {selectedEntry ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[13px]">{formatGstForDisplay(selectedEntry.gstNumber)}</span>
              <StatusPill pending={false} />
            </span>
          ) : pendingSelection ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[13px]">{formatGstForDisplay(normalizedValue)}</span>
              <StatusPill pending />
            </span>
          ) : (
            <span className="text-muted text-[12px] font-normal">Select or add GST number</span>
          )}
        </span>

        <span className="ml-2 flex items-center gap-1">
          {normalizedValue ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded p-0.5 text-muted transition hover:text-app"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClear();
                setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onClear();
                  setQuery("");
                }
              }}
            >
              <X className="h-4 w-4" />
            </span>
          ) : null}
          <ChevronDown className={`intake-select-chevron ${open ? "rotate-180" : ""}`} style={{ width: 16, height: 16 }} />
        </span>
      </button>
      )}

      {open ? (
        <div
          className="intake-searchable-panel intake-select-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              return;
            }
            if (event.key === "Enter" && showAddState && canAddNew) {
              event.preventDefault();
              handleAddNew();
            }
          }}
        >
          <div className="gst-picker-search-shell">
            <div className="gst-picker-search-row">
              <Search className="gst-picker-search-icon" />
              <input
                ref={searchRef}
                className="gst-picker-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by GST or entity..."
              />
            </div>
          </div>

          {filteredOptions.length > 0 ? <div className="gst-picker-section-label">Saved entries</div> : null}

          {filteredOptions.length > 0 ? (
            <div className="gst-picker-entry-list" style={{ maxHeight: filteredOptions.length > 3 ? 186 : undefined }}>
              {filteredOptions.map((option) => {
                const isSelected = normalizeGstInput(option.gstNumber) === normalizedValue && !pendingSelection;
                const displayGst = formatGstForDisplay(option.gstNumber);
                const cityText = deriveCity(option);
                const metaText = [option.entityName, cityText].filter(Boolean).join(" • ");
                const optionPending = Boolean((option as GstMappingOption & { pending?: boolean }).pending);

                return (
                  <button
                    key={`${option.entityType}-${option.entityName}-${option.gstNumber}`}
                    type="button"
                    className={`gst-picker-entry ${isSelected ? "gst-picker-entry-selected" : ""}`}
                    onClick={() => {
                      if (isSelected) {
                        onClear();
                        setOpen(false);
                        setQuery("");
                        return;
                      }

                      onSelect(normalizeGstInput(option.gstNumber));
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className={`gst-picker-radio ${isSelected ? "gst-picker-radio-selected" : ""}`}>
                      <span
                        className="gst-picker-radio-dot"
                        style={{
                          height: 5,
                          width: 5,
                          borderRadius: 999,
                          background: "#fff",
                          opacity: isSelected ? 1 : 0,
                        }}
                      />
                    </span>

                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-mono gst-picker-gst-text">
                        {highlightMatch(displayGst, query, true)}
                      </span>
                      <span className="block truncate gst-picker-meta-text">
                        {highlightMatch(metaText, query)}
                      </span>
                    </span>

                    <StatusPill pending={optionPending} />
                  </button>
                );
              })}
            </div>
          ) : null}

          {showAddState ? (
            <div className="gst-picker-add-state">
              <p className="gst-picker-add-caption">No match - add as new GST?</p>
              <div
                className="gst-picker-add-card"
              >
                <span
                  className={"gst-picker-add-preview truncate font-mono text-[13px]" + (hasCompleteInvalidGst ? " gst-picker-add-preview-invalid" : "")}
                >
                  {hasCompleteInvalidGst ? (
                    <span className="gst-picker-invalid-anchor">
                      <button
                        type="button"
                        aria-label="Invalid GST number format"
                        className="gst-picker-invalid-button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setShowInvalidHint((current) => !current);
                        }}
                      >
                        <AlertCircle className="h-4 w-4" />
                      </button>
                      {showInvalidHint ? (
                        <span className="gst-picker-invalid-popover">
                          Invalid GST number format
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <span className="truncate">{formatGstForDisplay(normalizedQuery)}</span>
                </span>
                <button
                  type="button"
                  className={"btn btn-primary gst-picker-add-action" + (canAddNew ? "" : " gst-picker-add-disabled")}
                  disabled={!canAddNew}
                  onClick={handleAddNew}
                >
                  Add GST
                </button>
              </div>
              {!hasCompleteInvalidGst ? (
                <p className={"gst-picker-add-helper text-[11px] " + (canAddNew ? "text-success" : "text-muted")}>
                  {canAddNew
                    ? "Valid GST - press Enter or click Add GST."
                    : remainingCharacters + " more character" + (remainingCharacters === 1 ? "" : "s") + " needed"}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
