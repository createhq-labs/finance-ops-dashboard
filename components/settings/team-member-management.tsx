"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDashboardSession } from "../layout/dashboard-session";

type TeamMember = {
  employee_id: string;
  full_name: string;
  email: string;
  status: string;
  business_line: "IM" | "TM" | null;
  created_at: string;
  created_by: string;
};

type TeamCandidate = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  business_line: "IM" | "TM" | null;
  team_lead_names: string[];
  is_current_team_member: boolean;
  disabled_reason: string | null;
};

type ApiResponse = {
  success: boolean;
  members?: TeamMember[];
  candidates?: TeamCandidate[];
  member?: TeamMember;
  error?: string;
};

type CandidateFilter = "my_line" | "unassigned" | "other_lines";

type TeamMemberManagementProps = {
  onChanged?: () => void;
};

export function TeamMemberManagement({ onChanged }: TeamMemberManagementProps) {
  const { user } = useDashboardSession();
  const [search, setSearch] = useState("");
  const [candidateFilters, setCandidateFilters] = useState<CandidateFilter[]>(["my_line", "unassigned"]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [candidates, setCandidates] = useState<TeamCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingCandidate, setPendingCandidate] = useState<TeamCandidate | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const teamLine = user?.business_line ?? null;
  const teamLineLabel = teamLine ?? "Unassigned";

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/team/members", { method: "GET", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load team members.");
      }

      setMembers(Array.isArray(json.members) ? json.members : []);
      setCandidates(Array.isArray(json.candidates) ? json.candidates : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load team members.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setCandidateFilters(teamLine ? ["my_line", "unassigned"] : ["unassigned"]);
    setFiltersOpen(false);
  }, [teamLine]);

  useEffect(() => {
    if (!filtersOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (filterMenuRef.current && target instanceof Node && !filterMenuRef.current.contains(target)) {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [filtersOpen]);

  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const line = teamLine;

    const matchesSearch = (candidate: TeamCandidate) => {
      if (!query) return true;
      const haystack = [candidate.full_name, candidate.email, candidate.business_line || "", ...(candidate.team_lead_names || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    };

    const matchesFilter = (candidate: TeamCandidate) => {
      if (query) return true;
      if (candidateFilters.length === 0) return true;
      const isMyLine = Boolean(line && candidate.business_line === line);
      const isUnassigned = !candidate.business_line;
      const isOtherLine = Boolean(line && candidate.business_line && candidate.business_line !== line);

      return (
        (candidateFilters.includes("my_line") && isMyLine) ||
        (candidateFilters.includes("unassigned") && isUnassigned) ||
        (candidateFilters.includes("other_lines") && isOtherLine)
      );
    };

    return candidates
      .filter(matchesSearch)
      .filter(matchesFilter)
      .sort((left, right) => {
        if (query) {
          const leftPriority = left.business_line === line ? 0 : !left.business_line ? 1 : 2;
          const rightPriority = right.business_line === line ? 0 : !right.business_line ? 1 : 2;
          if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        }
        return left.full_name.localeCompare(right.full_name);
      });
  }, [candidateFilters, candidates, search, teamLine]);

  const teamLineCount = useMemo(
    () => candidates.filter((candidate) => candidate.business_line === teamLine).length,
    [candidates, teamLine]
  );
  const unassignedCount = useMemo(
    () => candidates.filter((candidate) => !candidate.business_line).length,
    [candidates]
  );
  const otherLineCount = useMemo(
    () =>
      candidates.filter(
        (candidate) => Boolean(teamLine) && Boolean(candidate.business_line) && candidate.business_line !== teamLine
      ).length,
    [candidates, teamLine]
  );

  function toggleCandidateFilter(filter: CandidateFilter) {
    setCandidateFilters((current) => {
      const next = current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter];
      return next.length > 0 ? next : current;
    });
  }

  function resetCandidateFilters() {
    setCandidateFilters(teamLine ? ["my_line", "unassigned"] : ["unassigned"]);
  }

  const currentMemberIds = useMemo(
    () => new Set(members.map((member) => member.employee_id)),
    [members]
  );

  async function addMember(employeeId: string) {
    setSavingId(employeeId);
    setError("");

    try {
      const res = await fetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to add team member.");
      }

      const addedMember = json.member ?? json.members?.[0] ?? null;
      if (addedMember) {
        setMembers((current) => {
          if (current.some((member) => member.employee_id === addedMember.employee_id)) return current;
          return [addedMember, ...current];
        });
      }

      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id === employeeId ? { ...candidate, is_current_team_member: true } : candidate
        )
      );
      setPendingCandidate(null);
      onChanged?.();
      void loadData(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to add team member.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeMember(employeeId: string) {
    setSavingId(employeeId);
    setError("");

    try {
      const res = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to remove team member.");
      }

      setMembers((current) => current.filter((member) => member.employee_id !== employeeId));
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id === employeeId ? { ...candidate, is_current_team_member: false } : candidate
        )
      );
      onChanged?.();
      void loadData(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to remove team member.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
          Add existing employees to your team view.
        </p>
        {user?.role === "team_lead" ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
            Your business line: <span className="font-semibold text-foreground">{teamLineLabel}</span>
          </p>
        ) : null}
        {user?.role === "team_lead" && !teamLine ? (
          <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-300/20 dark:text-amber-200">
            Assign business line first.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-app/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current Members</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{members.length}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-app/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Available Employees</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{candidates.length}</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <section className="surface p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Current Team Members</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">Employees already mapped to you.</p>
            </div>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              {members.length}
            </span>
          </div>

          <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card px-3 py-3 text-sm text-muted-foreground">
                Loading team members...
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card px-3 py-3 text-sm text-muted-foreground">
                No team members yet. Add employees from the list.
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.employee_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{member.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                    <div className="mt-1">
                      <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {member.business_line || "Unassigned"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-300/30 dark:text-emerald-200">
                      Current Team
                    </span>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void removeMember(member.employee_id)}
                      disabled={savingId === member.employee_id}
                    >
                      {savingId === member.employee_id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="surface p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">Available Employees</h4>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                  aria-label="Help"
                  title="Help"
                >
                  ?
                </button>
              </div>
              
            </div>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              {visibleCandidates.length}
            </span>
          </div>

          <div className="mb-3 grid gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="grid min-w-0 gap-1 flex-1">
                <span className="settings-field-label">Search employees</span>
                <input
                  className="settings-form-input w-full sm:max-w-[220px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email, or line"
                />
              </label>
              <div ref={filterMenuRef} className="relative w-fit">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((current) => !current)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-all ${
                    filtersOpen
                      ? "border-primary/25 bg-primary/10 text-foreground shadow-sm shadow-primary/10"
                      : "border-border bg-card text-foreground hover:border-primary/20 hover:bg-muted/20"
                  }`}
                >
                  <span>Add Filters</span>
                  <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {candidateFilters.length}
                  </span>
                  <span className={`text-[10px] leading-none text-muted-foreground transition-transform ${filtersOpen ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>

                {filtersOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-[270px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/70 bg-app p-2 shadow-xl shadow-slate-950/10 dark:shadow-black/30">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Filter by line
                      </p>
                      <button
                        type="button"
                        onClick={resetCandidateFilters}
                        className="text-xs font-semibold text-primary transition-colors hover:underline"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="grid gap-1.5">
                      {[
                        { key: "my_line" as const, label: `${teamLineLabel} employees`, count: teamLineCount },
                        { key: "unassigned" as const, label: "Unassigned", count: unassignedCount },
                        { key: "other_lines" as const, label: "Other lines", count: otherLineCount },
                      ].map((item) => {
                        const active = candidateFilters.includes(item.key);
                        return (
                          <label
                            key={item.key}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${
                              active
                                ? "border-primary/25 bg-primary/10 text-foreground shadow-sm shadow-primary/5"
                                : "border-border bg-card text-muted-foreground hover:border-primary/15 hover:bg-muted/20"
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggleCandidateFilter(item.key)}
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                              />
                              <span className="truncate">{item.label}</span>
                            </span>
                            <span className="rounded-full border border-border/60 bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                              {item.count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {error ? (
              <p className="text-danger" style={{ margin: 0, fontSize: 13 }}>
                {error}
              </p>
            ) : null}

            {loading ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card px-3 py-3 text-sm text-muted-foreground">
                Loading employees...
              </div>
            ) : candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card px-3 py-3 text-sm text-muted-foreground">
                No employees available.
              </div>
            ) : visibleCandidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card px-3 py-3 text-sm text-muted-foreground">
                No matches.
              </div>
            ) : (
              visibleCandidates.map((candidate) => {
                const sharedTeams = candidate.team_lead_names || [];
                const inOtherTeam = sharedTeams.length > 0;
                const alreadyCurrent = currentMemberIds.has(candidate.id) || candidate.is_current_team_member;
                const disabledByBusinessLine = Boolean(candidate.disabled_reason);
                const canAdd = !alreadyCurrent && !disabledByBusinessLine;

                return (
                  <div
                    key={candidate.id}
                    className="rounded-xl border border-border/60 bg-card px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{candidate.full_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{candidate.email}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:border-cyan-300/30 dark:text-cyan-200">
                            {candidate.business_line || "Unassigned"}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => {
                          if (!canAdd) return;
                          if (inOtherTeam) {
                            setPendingCandidate(candidate);
                            return;
                          }
                          void addMember(candidate.id);
                        }}
                        disabled={savingId === candidate.id || !canAdd}
                      >
                        {savingId === candidate.id ? "Adding..." : alreadyCurrent ? "Added" : disabledByBusinessLine ? "Locked" : "Add"}
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {alreadyCurrent ? (
                        <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-300/30 dark:text-emerald-200">
                          Current Team
                        </span>
                      ) : disabledByBusinessLine ? (
                        <span className="rounded-full border border-rose-300/50 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-300/30 dark:text-rose-200">
                          Different business line
                        </span>
                      ) : inOtherTeam ? (
                        <span className="rounded-full border border-amber-300/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-300/30 dark:text-amber-200">
                          In other team
                        </span>
                      ) : (
                        <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Available
                        </span>
                      )}

                      {inOtherTeam && !disabledByBusinessLine ? (
                        <span className="text-xs text-muted-foreground">
                          Team lead: {sharedTeams.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
        Employees only. Team membership can be shared.
      </p>

      {helpOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/40 p-4 backdrop-blur-[1px]"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="mx-auto mt-24 w-full max-w-sm rounded-2xl border border-border bg-app p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Help</h3>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Close
              </button>
            </div>
            <p className="text-sm leading-6 text-foreground">
              Browse your line first, then unassigned employees. Search still finds other line members, but you cannot add them.
            </p>
          </div>
        </div>
      ) : null}

      {pendingCandidate ? (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/50 p-4 backdrop-blur-[1px]"
          onClick={() => setPendingCandidate(null)}
        >
          <div
            className="mx-auto mt-24 w-full max-w-lg rounded-2xl border border-border bg-app p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-foreground">Add employee to your team?</h3>
            <p className="text-muted mb-3 text-sm">
              This employee is already part of another team. Add anyway?
            </p>
            <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-500/8 px-3 py-2 text-sm text-foreground dark:border-amber-300/20 dark:bg-amber-500/10">
              {pendingCandidate.team_lead_names.length > 0 ? (
                <ul className="grid gap-1">
                  {pendingCandidate.team_lead_names.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn" type="button" onClick={() => setPendingCandidate(null)} disabled={savingId !== null}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void addMember(pendingCandidate.id)}
                disabled={savingId === pendingCandidate.id}
              >
                Add Anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
