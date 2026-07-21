"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SearchableSelectOption =
  | string
  | {
      value: string;
      label: string;
      searchText?: string;
      disabled?: boolean;
    };

type NormalizedOption = {
  value: string;
  label: string;
  searchText: string;
  disabled: boolean;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableSelectOption[];
  onChange?: (next: string) => void;
  allowCustom?: boolean;
  deselectOnSelectedClick?: boolean;
  placeholder?: string;
  disabled?: boolean;
  dataField?: string;
  required?: boolean;
  className?: string;
  panelMaxHeight?: number;
  searchTextByOption?: Record<string, string>;
  searchThreshold?: number;
};

function normalizeOption(
  option: SearchableSelectOption,
  searchTextByOption?: Record<string, string>
): NormalizedOption | null {
  if (typeof option === "string") {
    const trimmed = option.trim();
    if (!trimmed) return null;
    return {
      value: trimmed,
      label: trimmed,
      searchText: searchTextByOption?.[trimmed] ?? "",
      disabled: false,
    };
  }

  const value = option.value.trim();
  const label = option.label.trim();
  if (!value && !label) return null;

  return {
    value,
    label: label || value,
    searchText: option.searchText ?? searchTextByOption?.[value] ?? searchTextByOption?.[label] ?? "",
    disabled: Boolean(option.disabled),
  };
}

function getFirstEnabledIndex(options: NormalizedOption[]) {
  const index = options.findIndex((option) => !option.disabled);
  return index >= 0 ? index : 0;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  allowCustom = false,
  deselectOnSelectedClick = false,
  placeholder = "Select option",
  disabled = false,
  dataField,
  required = false,
  className,
  panelMaxHeight = 220,
  searchTextByOption,
  searchThreshold = 8,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    const nextOptions: NormalizedOption[] = [];

    for (const option of options) {
      const normalized = normalizeOption(option, searchTextByOption);
      if (!normalized) continue;

      const key = normalized.value.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      nextOptions.push(normalized);
    }

    return nextOptions;
  }, [options, searchTextByOption]);

  const selectedOption = useMemo(
    () => normalizedOptions.find((option) => option.value === value) ?? null,
    [normalizedOptions, value]
  );

  const showSearch = allowCustom || normalizedOptions.length >= searchThreshold;

  const filteredOptions = useMemo(() => {
    if (!showSearch) return normalizedOptions;

    const needle = query.trim().toLowerCase();
    if (!needle) return normalizedOptions;

    return normalizedOptions.filter((option) =>
      `${option.label} ${option.value} ${option.searchText}`.toLowerCase().includes(needle)
    );
  }, [normalizedOptions, query, showSearch]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const selectedIndex = filteredOptions.findIndex((option) => option.value === value && !option.disabled);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex(filteredOptions));
  }, [filteredOptions, open, value]);

  useEffect(() => {
    if (!open) return;

    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (showSearch) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }

    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  function closeMenu({ restoreFocus = false }: { restoreFocus?: boolean } = {}) {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function openMenu() {
    if (disabled) return;
    setOpen(true);
  }

  function selectOption(next: string) {
    if (typeof onChange === "function") {
      onChange(deselectOnSelectedClick && next === value ? "" : next);
    }
    closeMenu({ restoreFocus: true });
  }

  function commitCustomValue() {
    const next = query.trim();
    if (!allowCustom || !next) return;
    selectOption(next);
  }

  function moveHighlight(step: 1 | -1) {
    if (filteredOptions.length === 0) return;

    let nextIndex = highlightedIndex;
    for (let i = 0; i < filteredOptions.length; i += 1) {
      nextIndex = (nextIndex + step + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[nextIndex]?.disabled) {
        setHighlightedIndex(nextIndex);
        return;
      }
    }
  }

  function selectHighlightedOrFirst() {
    const highlighted = filteredOptions[highlightedIndex];
    if (highlighted && !highlighted.disabled) {
      selectOption(highlighted.value);
      return;
    }

    const firstEnabled = filteredOptions.find((option) => !option.disabled);
    if (firstEnabled) {
      selectOption(firstEnabled.value);
      return;
    }

    commitCustomValue();
  }

  const triggerLabel = selectedOption?.label ?? value;
  const showPlaceholder = !triggerLabel;

  return (
    <div
      ref={rootRef}
      className={`intake-searchable-root${className ? ` ${className}` : ""}`}
      style={{ position: "relative", zIndex: open ? 90 : undefined }}
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          if (rootRef.current?.contains(document.activeElement)) return;
          setOpen(false);
        });
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`intake-select-trigger${open ? " intake-select-trigger-open" : ""}${showPlaceholder ? " intake-select-trigger-placeholder" : ""}`}
        onClick={() => {
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={(event) => {
          if (disabled) return;

          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openMenu();
            return;
          }

          if (!open) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveHighlight(1);
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            moveHighlight(-1);
          }

          if (event.key === "Enter") {
            event.preventDefault();
            if (showSearch) {
              searchInputRef.current?.focus();
              return;
            }
            selectHighlightedOrFirst();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            closeMenu({ restoreFocus: true });
          }
        }}
        disabled={disabled}
        data-field={dataField}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="intake-select-trigger-label" title={showPlaceholder ? placeholder : triggerLabel}>
          {showPlaceholder ? placeholder : triggerLabel}
        </span>
        <ChevronDown className={`intake-select-chevron${open ? " intake-select-chevron-open" : ""}`} size={16} />
      </button>
      <input
        tabIndex={-1}
        aria-hidden="true"
        className="intake-select-validation-input"
        value={value}
        onChange={() => undefined}
        required={required}
        disabled={disabled}
      />

      {open ? (
        <div
          className="intake-searchable-panel intake-select-panel"
          style={{ maxHeight: panelMaxHeight }}
          role="listbox"
        >
          {showSearch ? (
            <div className="intake-select-search-shell">
              <input
                ref={searchInputRef}
                className="intake-select-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveHighlight(1);
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveHighlight(-1);
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    selectHighlightedOrFirst();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeMenu({ restoreFocus: true });
                  }
                }}
                placeholder="Search..."
                autoComplete="off"
              />
            </div>
          ) : null}

          <div className="intake-select-options">
            {filteredOptions.length === 0 ? (
              allowCustom && query.trim() ? (
                <button
                  type="button"
                  className="intake-searchable-option intake-searchable-option-highlighted"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commitCustomValue();
                  }}
                  onClick={(event) => event.preventDefault()}
                >
                  <span className="intake-searchable-option-label">Use &quot;{query.trim()}&quot;</span>
                  <span className="intake-searchable-option-check" />
                </button>
              ) : (
                <div className="intake-select-empty">No matching option</div>
              )
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={`${option.value}-${index}`}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    className={[
                      "intake-searchable-option",
                      isHighlighted ? "intake-searchable-option-highlighted" : "",
                      isSelected ? "intake-searchable-option-selected" : "",
                      option.disabled ? "intake-searchable-option-disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      if (!option.disabled) selectOption(option.value);
                    }}
                    onClick={() => {
                      return;
                    }}
                    onMouseEnter={() => {
                      if (!option.disabled) setHighlightedIndex(index);
                    }}
                  >
                    <span className="intake-searchable-option-label" title={option.label}>{option.label}</span>
                    <span className="intake-searchable-option-check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
