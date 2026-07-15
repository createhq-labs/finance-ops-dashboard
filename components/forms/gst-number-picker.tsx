"use client";

import { ChevronDown, Search, X } from "lucide-react";
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
  if (option.city?.trim()) return option.city.trim();
  const address = option.address?.trim() ?? "";
  if (!address) return "";

  const inferred = inferAddressData(address, option.country?.trim().toLowerCase() === "india" ? "Indian" : "Foreign");
  return inferred.city.trim();
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
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkMode(root.classList.contains("dark"));

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

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
          ? isDarkMode
            ? "rgba(245, 112, 11, 0.24)"
            : "rgba(217, 119, 6, 0.14)"
          : isDarkMode
            ? "rgba(7, 245, 35, 0.24)"
            : "rgba(25, 222, 97, 0.14)",
        color: pending ? (isDarkMode ? "#ffb806" : "#fa750f") : isDarkMode ? "#12f565" : "#4ed633",
      }}
    >
      {pending ? "Pending" : "Approved"}
    </span>
  );
}

export function GstNumberPicker({ value, mode, options, onSelect, onStartAddNew, onClear }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

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
      <button
        type="button"
        className={`intake-select-trigger ${open ? "intake-select-trigger-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
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
            <div className="gst-picker-entry-list">
              {filteredOptions.map((option) => {
                const isSelected = normalizeGstInput(option.gstNumber) === normalizedValue && !pendingSelection;
                const displayGst = formatGstForDisplay(option.gstNumber);
                const cityText = deriveCity(option);
                const metaText = [option.entityName, cityText].filter(Boolean).join(" - ");

                return (
                  <button
                    key={`${option.entityType}-${option.entityName}-${option.gstNumber}`}
                    type="button"
                    className={`gst-picker-entry ${isSelected ? "gst-picker-entry-selected" : ""}`}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 12,
                      borderTop: "0.5px solid var(--border)",
                      padding: 12,
                      textAlign: "left",
                      background: isSelected ? "color-mix(in srgb, var(--ring) 10%, transparent)" : "transparent",
                    }}
                    onClick={() => {
                      onSelect(normalizeGstInput(option.gstNumber));
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span
                      className={`gst-picker-radio ${isSelected ? "gst-picker-radio-selected" : ""}`}
                      style={{
                        display: "inline-flex",
                        height: 15,
                        width: 15,
                        flex: "0 0 auto",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 999,
                        border: `1px solid ${isSelected ? "var(--ring)" : "color-mix(in srgb, var(--foreground) 34%, var(--border))"}`,
                        background: isSelected ? "var(--ring)" : "transparent",
                      }}
                    >
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
                      <span className="block truncate font-mono gst-picker-gst-text" style={{ fontSize: 13, fontWeight: 300 }}>
                        {highlightMatch(displayGst, query, true)}
                      </span>
                      <span className="block truncate gst-picker-meta-text" style={{ fontSize: 11, fontWeight: 300, color: "var(--muted-foreground)" }}>
                        {highlightMatch(metaText, query)}
                      </span>
                    </span>

                    <StatusPill pending={false} />
                  </button>
                );
              })}
            </div>
          ) : null}

          {showAddState ? (
            <div className="gst-picker-add-state" style={{ background: "var(--card)", padding: "10px 12px 12px" }}>
              <p className="gst-picker-add-caption" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>No match - add as new GST?</p>
              <div
                className="gst-picker-add-card"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 }}
              >
                <span
                  className="gst-picker-add-preview truncate font-mono text-[13px] text-app"
                  style={{
                    display: "inline-flex",
                    minHeight: 38,
                    minWidth: 0,
                    flex: "1 1 auto",
                    alignItems: "center",
                    borderRadius: 10,
                    border: "0.5px solid var(--border)",
                    background: "var(--card)",
                    padding: "0 14px",
                  }}
                >
                  {formatGstForDisplay(normalizedQuery)}
                </span>
                <button
                  type="button"
                  className={`btn btn-primary gst-picker-add-action ${canAddNew ? "" : "gst-picker-add-disabled"}`}
                  style={{
                    minHeight: 38,
                    borderRadius: 10,
                    paddingInline: 14,
                    background: "linear-gradient(135deg, var(--accent), var(--primary-strong))",
                    backgroundImage: "none",
                    color: "#ffffff",
                    boxShadow: "none",
                    opacity: canAddNew ? 1 : 0.45,
                    pointerEvents: canAddNew ? "auto" : "none",
                  }}
                  disabled={!canAddNew}
                  onClick={handleAddNew}
                >
                  Add GST
                </button>
              </div>
              <p className={`text-[11px] ${canAddNew ? "text-success" : "text-muted"}`} style={{ marginTop: 6 }}>
                {canAddNew
                  ? "Valid GST - press Enter or click Add GST."
                  : `${remainingCharacters} more character${remainingCharacters === 1 ? "" : "s"} needed`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}