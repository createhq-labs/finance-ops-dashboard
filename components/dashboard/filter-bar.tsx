"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SearchableSelect } from "../forms/searchable-select";

type FilterOption = {
  label: string;
  value: string;
};

type BaseFilter = {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
};

type PrimaryFilter = BaseFilter & {
  options: FilterOption[];
  searchTextByOption?: Record<string, string>;
};

type AdvancedFilter = BaseFilter & {
  type: "select" | "date" | "text";
  options?: FilterOption[];
  searchTextByOption?: Record<string, string>;
};

type FilterBarProps = {
  searchPlaceholder: string;
  searchValue?: string;
  primaryFilters: PrimaryFilter[];
  advancedFilters: AdvancedFilter[];
  onSearch: (value: string) => void;
  onPrimaryChange: (key: string, value: string) => void;
  onAdvancedChange: (filters: Record<string, string>) => void;
  onReset?: () => void;
};

function isAppliedValue(value: string | undefined) {
  const normalized = String(value || "").trim();
  return Boolean(normalized && normalized !== "all");
}

function getAdvancedValueMap(filters: AdvancedFilter[]) {
  return Object.fromEntries(filters.map((filter) => [filter.key, String(filter.value || "")]));
}

function getDisplayValue(filter: AdvancedFilter, value: string) {
  if (filter.type === "select") {
    return filter.options?.find((option) => option.value === value)?.label || value;
  }
  return value;
}

export function FilterBar({
  searchPlaceholder,
  searchValue = "",
  primaryFilters,
  advancedFilters,
  onSearch,
  onPrimaryChange,
  onAdvancedChange,
  onReset,
}: FilterBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<Record<string, string>>(
    getAdvancedValueMap(advancedFilters)
  );

  useEffect(() => {
    if (open) return;
    setDraftAdvancedFilters(getAdvancedValueMap(advancedFilters));
  }, [advancedFilters, open]);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
        setDraftAdvancedFilters(getAdvancedValueMap(advancedFilters));
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [advancedFilters, open]);

  const appliedPrimaryEntries = useMemo(
    () =>
      primaryFilters
        .map((filter) => ({
          filter,
          value: String(filter.value || ""),
        }))
        .filter(({ value }) => isAppliedValue(value)),
    [primaryFilters]
  );

  const appliedAdvancedEntries = useMemo(
    () =>
      advancedFilters
        .map((filter) => ({
          filter,
          value: String(filter.value || ""),
        }))
        .filter(({ value }) => isAppliedValue(value)),
    [advancedFilters]
  );

  const appliedSearchValue = String(searchValue || "").trim();
  const activeAdvancedCount = appliedAdvancedEntries.length;

  function updateDraftValue(key: string, value: string) {
    setDraftAdvancedFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleApply() {
    onAdvancedChange(draftAdvancedFilters);
    setOpen(false);
  }

  function handleCancel() {
    setDraftAdvancedFilters(getAdvancedValueMap(advancedFilters));
    setOpen(false);
  }

  function handleReset() {
    const cleared = Object.fromEntries(advancedFilters.map((filter) => [filter.key, ""]));
    setDraftAdvancedFilters(cleared);
    setOpen(false);
    onSearch("");
    for (const filter of primaryFilters) {
      onPrimaryChange(filter.key, filter.options[0]?.value ?? "");
    }
    onAdvancedChange(cleared);
    onReset?.();
  }

  function handleDismissSearch() {
    onSearch("");
  }

  function handleDismissPrimaryFilter(key: string) {
    const filter = primaryFilters.find((entry) => entry.key === key);
    onPrimaryChange(key, filter?.options[0]?.value ?? "");
  }

  function handleDismissAppliedFilter(key: string) {
    const next = Object.fromEntries(
      advancedFilters.map((filter) => [filter.key, filter.key === key ? "" : String(filter.value || "")])
    );
    onAdvancedChange(next);
  }

  return (
    <div className="grid gap-3" ref={rootRef}>
      <div className="rounded-xl border border-border/60 bg-card/90 p-3 dark:bg-card/70">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[240px] flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>

          <div className="hidden h-6 w-px bg-border/60 lg:block" />

          <div className="flex flex-wrap items-center gap-2">
            {primaryFilters.map((filter) => (
              <div key={filter.key} className="min-w-[148px]">
                <SearchableSelect
                  value={String(filter.value || "")}
                  options={filter.options}
                  onChange={(next) => onPrimaryChange(filter.key, next)}
                  placeholder={filter.placeholder || filter.label}
                  searchTextByOption={filter.searchTextByOption}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          <div className="hidden h-6 w-px bg-border/60 lg:block" />

          <div className="ml-auto flex items-center gap-2">
            {advancedFilters.length > 0 ? (
              <div className="relative">
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setOpen((current) => !current)}
                  className={[
                    "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-[border-color,background-color,box-shadow,color] duration-150",
                    open
                      ? "border-sky-400 bg-sky-50/90 text-foreground shadow-[0_0_0_2px_rgba(56,189,248,0.18)] dark:border-cyan-300 dark:bg-cyan-400/10 dark:shadow-[0_0_0_2px_rgba(34,211,238,0.2)]"
                      : "border-[color:var(--intake-input-border)] bg-[color:var(--intake-input-bg)] text-foreground hover:border-sky-400 hover:bg-sky-50/90 dark:hover:border-cyan-300 dark:hover:bg-cyan-400/10",
                  ].join(" ")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeAdvancedCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-blue-900/10 bg-[color:var(--primary-strong)] px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground dark:border-sky-200/10 dark:bg-sky-200/85 dark:text-slate-950">
                      {activeAdvancedCount}
                    </span>
                  ) : null}
                </button>

                {open ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-[min(42rem,calc(100vw-2rem))] rounded-xl border border-border/60 bg-card/95 p-4 shadow-2xl dark:bg-card/90">
                    <div className="grid gap-4">
                      <div className="text-sm font-semibold text-foreground">Advanced filters</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {advancedFilters.map((filter) => {
                          const currentValue = String(draftAdvancedFilters[filter.key] || "");

                          if (filter.type === "select") {
                            return (
                              <label key={filter.key} className="grid gap-1">
                                <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  {filter.label}
                                </span>
                                <SearchableSelect
                                  value={currentValue || "all"}
                                  options={filter.options || []}
                                  onChange={(next) => updateDraftValue(filter.key, next === "all" ? "" : next)}
                                  placeholder={filter.placeholder || filter.label}
                                  searchTextByOption={filter.searchTextByOption}
                                />
                              </label>
                            );
                          }

                          return (
                            <label key={filter.key} className="grid gap-1">
                              <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                {filter.label}
                              </span>
                              <input
                                type={filter.type === "date" ? "date" : "text"}
                                className="intake-input border-border/70 bg-card text-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:border-cyan-300 dark:focus:ring-cyan-400/20"
                                value={currentValue}
                                placeholder={filter.placeholder || filter.label}
                                onChange={(event) => updateDraftValue(filter.key, event.target.value)}
                              />
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn" onClick={handleCancel}>
                          Cancel
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleApply}>
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-10 items-center rounded-full border border-[color:var(--intake-input-border)] bg-[color:var(--intake-input-bg)] px-3 text-sm font-medium text-muted-foreground transition-[border-color,background-color,box-shadow,color] duration-150 hover:border-sky-400 hover:bg-sky-50/90 hover:text-destructive dark:hover:border-cyan-300 dark:hover:bg-cyan-400/10"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {appliedSearchValue || appliedPrimaryEntries.length > 0 || appliedAdvancedEntries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {appliedSearchValue ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/70 bg-sky-100/95 px-3 py-1 text-xs font-medium text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/16 dark:text-sky-50">
              <span>Search: {appliedSearchValue}</span>
              <button
                type="button"
                onClick={handleDismissSearch}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-current transition-colors duration-150 hover:bg-sky-200/80 dark:hover:bg-sky-400/18"
                aria-label="Remove search"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}

          {appliedPrimaryEntries.map(({ filter, value }) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-2 rounded-full border border-sky-300/70 bg-sky-100/95 px-3 py-1 text-xs font-medium text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/16 dark:text-sky-50"
            >
              <span>{filter.label}: {filter.options.find((option) => option.value === value)?.label || value}</span>
              <button
                type="button"
                onClick={() => handleDismissPrimaryFilter(filter.key)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-current transition-colors duration-150 hover:bg-sky-200/80 dark:hover:bg-sky-400/18"
                aria-label={"Remove " + filter.label}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {appliedAdvancedEntries.map(({ filter, value }) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-2 rounded-full border border-sky-300/70 bg-sky-100/95 px-3 py-1 text-xs font-medium text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/16 dark:text-sky-50"
            >
              <span>
                {filter.label}: {getDisplayValue(filter, value)}
              </span>
              <button
                type="button"
                onClick={() => handleDismissAppliedFilter(filter.key)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-current transition-colors duration-150 hover:bg-sky-200/80 dark:hover:bg-sky-400/18"
                aria-label={"Remove " + filter.label}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
