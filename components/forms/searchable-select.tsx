"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SearchableSelectProps = {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  dataField?: string;
  required?: boolean;
  className?: string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select option",
  disabled = false,
  dataField,
  required = false,
  className,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    return options
      .map((opt) => opt.trim())
      .filter((opt) => {
        if (!opt) return false;
        const key = opt.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [options]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // When the current selected value is focused again, show full list so users can overwrite directly.
    if (open && needle === value.trim().toLowerCase()) return normalizedOptions;
    if (!needle) return normalizedOptions;
    return normalizedOptions.filter((opt) => opt.toLowerCase().includes(needle));
  }, [normalizedOptions, open, query, value]);

  useEffect(() => {
    if (!open) setQuery(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
        setQuery(value);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [open, value]);

  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) setHighlightedIndex(0);
  }, [filteredOptions.length, highlightedIndex]);

  function selectOption(next: string) {
    onChange(next);
    setQuery(next);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div ref={rootRef} className={`intake-searchable-root${className ? ` ${className}` : ""}`} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className="intake-input intake-searchable-input"
        value={open ? query : value}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery(value);
          setHighlightedIndex(0);
        }}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
        }}
        onChange={(event) => {
          if (disabled) return;
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          setHighlightedIndex(0);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter")) {
            event.preventDefault();
            setOpen(true);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (filteredOptions.length === 0) return;
            setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (filteredOptions.length === 0) return;
            setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (!open) return;
            const selected = filteredOptions[highlightedIndex] ?? filteredOptions[0];
            if (selected) selectOption(selected);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setQuery(value);
          }
        }}
        onBlur={() => {
          // Click-outside handler closes reliably; this guards tab navigation.
          requestAnimationFrame(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              setOpen(false);
              setQuery(value);
            }
          });
        }}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        data-field={dataField}
        required={required}
        style={{
          background: "var(--intake-input-bg)",
          color: "var(--intake-input-fg)",
          borderColor: "var(--intake-input-border)",
          opacity: 1,
        }}
      />
      <span
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: "var(--muted)",
          fontSize: 11,
        }}
      >
        ▼
      </span>

      {open ? (
        <div
          className="intake-searchable-panel"
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--intake-option-bg)",
            border: "1px solid var(--intake-input-border)",
            borderRadius: 10,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 12px 30px rgba(2, 6, 23, 0.25)",
            opacity: 1,
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: "8px 10px", color: "var(--muted)", fontSize: 13 }}>No matching option</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                className="intake-searchable-option"
                key={`${option}-${index}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: 0,
                  background: index === highlightedIndex ? "rgba(56, 189, 248, 0.16)" : "var(--intake-option-bg)",
                  color: "var(--intake-option-fg)",
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {option}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
