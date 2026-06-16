"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TeamMember = {
  employee_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  created_by: string;
};

type TeamCandidate = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  team_lead_names: string[];
  is_current_team_member: boolean;
};

type ApiResponse = {
  success: boolean;
  members?: TeamMember[];
  candidates?: TeamCandidate[];
  member?: TeamMember;
  error?: string;
};

type TeamMemberManagementProps = {
  onChanged?: () => void;
};

export function TeamMemberManagement({ onChanged }: TeamMemberManagementProps) {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [candidates, setCandidates] = useState<TeamCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingCandidate, setPendingCandidate] = useState<TeamCandidate | null>(null);

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

  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;

    return candidates.filter((candidate) => {
      const haystack = [candidate.full_name, candidate.email, ...(candidate.team_lead_names || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [candidates, search]);

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
          <div className="mb-3 flex flex-col gap-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Available Employees</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">Browse the full employee list or narrow it with search.</p>
            </div>
            <label className="grid gap-1">
              <span className="settings-field-label">Search employees</span>
              <input
                className="settings-form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or email"
              />
            </label>
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

                return (
                  <div
                    key={candidate.id}
                    className="rounded-xl border border-border/60 bg-card px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{candidate.full_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{candidate.email}</div>
                      </div>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => {
                          if (alreadyCurrent) return;
                          if (inOtherTeam) {
                            setPendingCandidate(candidate);
                            return;
                          }
                          void addMember(candidate.id);
                        }}
                        disabled={savingId === candidate.id || alreadyCurrent}
                      >
                        {savingId === candidate.id ? "Adding..." : alreadyCurrent ? "Added" : "Add"}
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {alreadyCurrent ? (
                        <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-300/30 dark:text-emerald-200">
                          Current Team
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

                      {inOtherTeam ? (
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
