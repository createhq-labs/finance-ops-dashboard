"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FilterBar } from '../../../../components/dashboard/filter-bar';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { getDrawerViewerRole } from '../../../../lib/client/dashboard-access';
import { pickProductReimbursementAttachment, pickReferencePoAttachment } from '../../../../lib/shared/submission-attachments';
import { handleAuthTokenRecoveryMessage } from '../../../../lib/client/auth-recovery';
import { TeamMemberManagement } from '../../../../components/settings/team-member-management';

type SubmissionAttachmentApiRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at?: string | null;
};

type TeamSubmissionApiRow = {
  id: string;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  agency_brand_trade_name: string | null;
  email_address: string | null;
  gst_number: string | null;
  address: string | null;
  bill_due: string | null;
  invoice_type: string | null;
  deliverables: string | null;
  creator_creators_name: string | null;
  brand_name: string | null;
  currency?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  commercials: number | string | null;
  additional_agency_commission: number | string | null;
  reimbursement_amount: number | string | null;
  reimbursement_receipts: string | null;
  additional_information: string | null;
  previous_submission_id: string | null;
  previous_submission_pi?: string | null;
  version_status?: 'original' | 'resubmitted' | 'superseded';
  finance_notes?: string | null;
  finance_external_notes?: string | null;
  finance_comment?: string | null;
  invoice_number?: string | null;
  debit_note_number?: string | null;
  creator_invoice_status?: string | null;
  payment_received?: string | null;
  payment_received_status?: string | null;
  payment_made?: string | null;
  payment_made_status?: string | null;
  closure_status?: string | null;
  business_line?: 'TM' | 'IM' | null;
  entry_type?: 'SC' | 'MC' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  intake_line_items: SubmissionRow['intake_line_items'];
  intake_status: SubmissionRow['intake_status'];
  invoice_status: string | null;
  submitted_at: string | null;
  rejection_note: string | null;
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
  submission_attachments?: SubmissionAttachmentApiRow[];
};

type TeamMemberApiRow = {
  employee_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  created_by: string;
};

type TeamMembersResponse = {
  success: boolean;
  members?: TeamMemberApiRow[];
  error?: string;
};

type TeamSubmissionsResponse = {
  success?: boolean;
  submissions?: TeamSubmissionApiRow[];
  has_more?: boolean;
  next_offset?: number | null;
  error?: string;
};

const PAGE_SIZE = 50;

function normalizeStatus(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function hasStartedLifecycleStatus(value: string | null | undefined) {
  const normalized = normalizeStatus(value);
  return Boolean(normalized && normalized !== 'pending');
}

function mapTeamSubmissionRow(item: TeamSubmissionApiRow): SubmissionRow {
  return {
    id: String(item.id),
    pi: item.proforma_invoice ?? '',
    entity: item.agency_brand_name || '-',
    amount: Number(item.commercials ?? 0),
    currency: item.currency || 'INR',
    owner_name:
      [item.submitted_by_name, item.submitted_by_email]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join('\n') || '-',
    submitter_email: item.submitted_by_email || item.email_address || undefined,
    intake_status: item.intake_status,
    invoice_status: item.invoice_status || '-',
    sync_status: 'pending_sheet_sync',
    submitted_at: item.submitted_at || new Date().toISOString(),
    rejection_note: item.rejection_note || null,
    trade_name: item.agency_brand_trade_name || null,
    gst_number: item.gst_number || null,
    address: item.address || null,
    bill_due: item.bill_due || null,
    invoice_type: item.invoice_type || null,
    creator_creators_name: item.creator_creators_name || null,
    brand_name: item.brand_name || null,
    invoice_number: item.invoice_number || null,
    debit_note_number: item.debit_note_number || null,
    campaign_code: item.campaign_code || null,
    campaign_name: item.campaign_name || null,
    campaign_brand: item.campaign_brand || null,
    campaign_notes: item.campaign_notes || null,
    deliverables: item.deliverables || null,
    additional_agency_commission: Number(item.additional_agency_commission ?? 0),
    reimbursement_amount: Number(item.reimbursement_amount ?? 0),
    reimbursement_receipts: item.reimbursement_receipts || null,
    additional_information: item.additional_information || null,
    previous_submission_id: item.previous_submission_id || null,
    previous_submission_pi: item.previous_submission_pi || null,
    version_status: item.version_status || 'original',
    finance_notes: item.finance_notes || null,
    finance_external_notes: item.finance_external_notes || null,
    finance_comment: item.finance_comment || undefined,
    invoice_status_started: Boolean(String(item.invoice_status || '').trim() && String(item.invoice_status || '') !== '-'),
    creator_invoice_received_started: hasStartedLifecycleStatus(item.creator_invoice_status),
    payment_received_started: hasStartedLifecycleStatus(item.payment_received_status || item.payment_received),
    payment_made_started: hasStartedLifecycleStatus(item.payment_made_status || item.payment_made),
    creator_invoice_received: normalizeStatus(item.creator_invoice_status) || undefined,
    payment_received: normalizeStatus(item.payment_received_status || item.payment_received) || undefined,
    payment_made: normalizeStatus(item.payment_made_status || item.payment_made) || undefined,
    closed_status: normalizeStatus(item.closure_status) || undefined,
    business_line: item.business_line || null,
    entry_type: item.entry_type || null,
    entity_type: item.entity_type || null,
    client_type: item.client_type || null,
    agency_name: item.agency_name || null,
    agency_trade_name: item.agency_trade_name || null,
    brand_trade_name: item.brand_trade_name || null,
    intake_line_items: item.intake_line_items || [],
    product_reimbursement_attachment: pickProductReimbursementAttachment(item.submission_attachments),
    reference_po_attachment: pickReferencePoAttachment(item.submission_attachments),
  };
}

function mergeRows(current: SubmissionRow[], incoming: SubmissionRow[]) {
  const merged = new Map<string, SubmissionRow>();
  for (const row of current) merged.set(row.id, row);
  for (const row of incoming) merged.set(row.id, row);
  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = new Date(left.submitted_at || '').getTime();
    const rightTime = new Date(right.submitted_at || '').getTime();
    return rightTime - leftTime;
  });
}

function resetTeamFilters(
  setQuery: (value: string) => void,
  setStatusFilter: (value: 'all' | SubmissionRow['intake_status']) => void,
  setMemberQuery: (value: string) => void,
) {
  setQuery('');
  setStatusFilter('all');
  setMemberQuery('');
}

export default function TeamSubmissionsPage() {
  const searchParams = useSearchParams();
  const { user, loading } = useDashboardSession();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberApiRow[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionRow['intake_status']>('all');
  const [memberQuery, setMemberQuery] = useState('');
  const [rowsLoading, setRowsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rowsError, setRowsError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [highlightedSubmissionId, setHighlightedSubmissionId] = useState<string | null>(null);
  const [deepLinkNotice, setDeepLinkNotice] = useState('');
  const handledSubmissionIdRef = useRef<string | null>(null);
  const loadingSubmissionIdRef = useRef<string | null>(null);

  const loadMembers = useCallback(async () => {
    const membersRes = await fetch('/api/team/members', { method: 'GET', cache: 'no-store' });
    const membersJson = (await membersRes.json().catch(() => ({}))) as TeamMembersResponse;
    if (!membersRes.ok || !membersJson.success) {
      throw new Error(membersJson.error || 'Failed to load team members.');
    }
    setTeamMembers(Array.isArray(membersJson.members) ? membersJson.members : []);
  }, []);

  const loadRows = useCallback(
    async (offset: number, append: boolean) => {
      if (!user) return;

      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setRowsLoading(true);
        setRowsError('');
      }

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (query.trim()) params.set('query', query.trim());
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (memberQuery.trim()) params.set('member_query', memberQuery.trim());

        const submissionsRes = await fetch('/api/submissions/team?' + params.toString(), { method: 'GET', cache: 'no-store' });
        const submissionsJson = (await submissionsRes.json().catch(() => ({}))) as TeamSubmissionsResponse;

        if (!submissionsRes.ok || !submissionsJson.success) {
          throw new Error(submissionsJson.error || 'Failed to load team submissions.');
        }

        const mapped = (submissionsJson.submissions ?? []).map(mapTeamSubmissionRow);
        setRows((current) => (append ? mergeRows(current, mapped) : mapped));
        setHasMore(Boolean(submissionsJson.has_more));
        setNextOffset(typeof submissionsJson.next_offset === 'number' ? submissionsJson.next_offset : null);
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : 'Failed to load team data.';
        if (handleAuthTokenRecoveryMessage(nextMessage)) return;
        setRowsError(nextMessage);
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setRowsLoading(false);
        }
      }
    },
    [memberQuery, query, statusFilter, user]
  );

  const loadAll = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (silent) setRefreshing(true);
      try {
        await Promise.all([loadMembers(), loadRows(0, false)]);
      } finally {
        if (silent) setRefreshing(false);
      }
    },
    [loadMembers, loadRows, user]
  );

  const loadMore = useCallback(() => {
    if (rowsLoading || loadingMore || !hasMore || nextOffset === null) return;
    void loadRows(nextOffset, true);
  }, [hasMore, loadRows, loadingMore, nextOffset, rowsLoading]);

  useEffect(() => {
    if (!user) return;
    setRows([]);
    setHasMore(false);
    setNextOffset(null);
    void loadAll(false);
  }, [loadAll, user]);

  useEffect(() => {
    if (!hasMore || loadingMore || loadingMoreRef.current) return undefined;
    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMoreRef.current) {
          observer.disconnect();
          loadMore();
        }
      },
      { rootMargin: '180px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore]);

  const row = useMemo(() => rows.find((entry) => entry.id === openId) || null, [rows, openId]);

  useEffect(() => {
    if (!highlightedSubmissionId) return undefined;
    const timer = window.setTimeout(() => {
      setHighlightedSubmissionId((current) => (current === highlightedSubmissionId ? null : current));
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [highlightedSubmissionId]);

  useEffect(() => {
    const submissionId = searchParams.get('submission_id')?.trim();
    if (!submissionId) {
      handledSubmissionIdRef.current = null;
      loadingSubmissionIdRef.current = null;
      setDeepLinkNotice('');
      return;
    }

    if (rows.some((entry) => entry.id === submissionId)) {
      if (handledSubmissionIdRef.current !== submissionId) {
        handledSubmissionIdRef.current = submissionId;
        setDeepLinkNotice('');
        setHighlightedSubmissionId(submissionId);
      }
      return;
    }

    if (!user || handledSubmissionIdRef.current === submissionId || loadingSubmissionIdRef.current === submissionId) {
      return;
    }

    loadingSubmissionIdRef.current = submissionId;
    let cancelled = false;

    void (async () => {
      try {
        const params = new URLSearchParams({ submission_id: submissionId, limit: '1', offset: '0' });
        const res = await fetch('/api/submissions/team?' + params.toString(), { method: 'GET', cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as TeamSubmissionsResponse;
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to locate submission.');
        }

        const item = json.submissions?.[0];
        if (!item) {
          if (!cancelled) setDeepLinkNotice('Submission not found in current view.');
          return;
        }

        const mapped = mapTeamSubmissionRow(item);
        if (!cancelled) {
          setRows((current) => mergeRows(current, [mapped]));
          setDeepLinkNotice('');
          setHighlightedSubmissionId(submissionId);
          handledSubmissionIdRef.current = submissionId;
        }
      } catch {
        if (!cancelled) setDeepLinkNotice('Submission not found in current view.');
      } finally {
        if (!cancelled) {
          handledSubmissionIdRef.current = submissionId;
          loadingSubmissionIdRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, searchParams, user]);
  const teamMembersCount = teamMembers.length;
  const submissionCount = rows.length;
  const pendingOrReviewCount = rows.filter((entry) => {
    const intakeStatus = normalizeStatus(entry.intake_status);
    const closedStatus = normalizeStatus(entry.closed_status);
    return intakeStatus === 'submitted' || (intakeStatus === 'accepted' && closedStatus !== 'closed');
  }).length;
  const resubmissionCount = rows.filter((entry) => normalizeStatus(entry.intake_status) === 'rejected').length;
  const closedCount = rows.filter((entry) => normalizeStatus(entry.closed_status) === 'closed').length;

  if (loading || !user) return null;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <PageHeader
        title="Team Submissions"
        description="Read-only submissions from mapped employees."
        className="border-b-0 pb-2"
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setShowTeamMembers(true)}>
            Manage Team Members
          </button>
        }
      />

      {rowsLoading ? <WorkspaceLoader variant="section" label="Loading team submissions..." /> : null}
      {rowsError ? <StatePanel tone="danger" padding={12}>{rowsError}</StatePanel> : null}
      {deepLinkNotice ? <p className="text-xs text-muted-foreground">{deepLinkNotice}</p> : null}
      {refreshing ? <p className="text-muted m-0 text-sm">Refreshing team data...</p> : null}

      {!rowsLoading && !rowsError ? (
        teamMembersCount === 0 ? (
          <StatePanel padding={12}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-1 font-semibold">No team members yet.</p>
                <p className="text-muted mb-0 text-sm">Add employees to see submissions.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setShowTeamMembers(true)}>
                Manage Team Members
              </button>
            </div>
          </StatePanel>
        ) : (
          <>
            <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <KpiCard title="Team Members" value={String(teamMembersCount)} hint="Mapped employees" compact />
              <KpiCard title="Team Submissions" value={String(submissionCount)} hint="Loaded records" compact />
              <KpiCard title="Pending / Review" value={String(pendingOrReviewCount)} hint="Waiting on finance" compact />
              <KpiCard title="Resubmissions" value={String(resubmissionCount)} hint="Needs fixes" compact />
              <KpiCard title="Closed" value={String(closedCount)} hint="Completed" compact />
            </section>

            <SectionCard padding={12}>
              <FilterBar
                searchPlaceholder="Search PI, entity, creator, or brand"
                searchValue={query}
                primaryFilters={[
                  {
                    key: 'status',
                    label: 'Status',
                    value: statusFilter,
                    options: [
                      { value: 'all', label: 'All' },
                      { value: 'submitted', label: 'Submitted' },
                      { value: 'accepted', label: 'Accepted' },
                      { value: 'rejected', label: 'Rejected' },
                    ],
                  },
                ]}
                advancedFilters={[
                  {
                    key: 'teamMember',
                    label: 'Team Member',
                    value: memberQuery,
                    type: 'text',
                    placeholder: 'Search member name or email',
                  },
                ]}
                onSearch={setQuery}
                onPrimaryChange={(key, value) => {
                  if (key === 'status') {
                    setStatusFilter((value || 'all') as 'all' | SubmissionRow['intake_status']);
                  }
                }}
                onAdvancedChange={(filters) => {
                  setMemberQuery(filters.teamMember || '');
                }}
                onReset={() => resetTeamFilters(setQuery, setStatusFilter, setMemberQuery)}
              />
            </SectionCard>

            <SectionCard padding={0}>
              <div className="grid gap-3 p-0">
                <SubmissionTable
                  rows={rows}
                  onOpen={(id) => setOpenId(id)}
                  emptyLabel="No mapped employee submissions found yet."
                  getActionLabel={() => 'View'}
                  viewer="team_lead"
                  viewerBusinessLine={user.business_line}
                  highlightedRowId={highlightedSubmissionId}
                  paginationFooter={(
                    <div>
                      <div className="border-b border-border/50 px-4 py-2 text-center text-xs text-muted-foreground">
                        PI numbering now continues from 466. Older submissions will be migrated shortly.
                      </div>
                      {rows.length > 0 ? (
                        hasMore ? (
                          <div className="flex flex-col items-center gap-3 px-3 py-3">
                            <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
                            <button className="btn" type="button" onClick={loadMore} disabled={loadingMore}>
                              {loadingMore ? 'Loading more...' : 'Load More'}
                            </button>
                          </div>
                        ) : (
                          <p className="px-3 py-3 text-center text-xs text-muted-foreground">You&apos;ve reached the latest team submissions.</p>
                        )
                      ) : null}
                    </div>
                  )}
                />
              </div>
            </SectionCard>
          </>
        )
      ) : null}

      <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />

      {showTeamMembers ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-[1px]" onClick={() => setShowTeamMembers(false)}>
          <div
            className="mx-auto mt-10 max-h-[calc(100vh-5rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-app p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-lg font-semibold">Manage Team Members</h2>
              </div>
              <button className="btn" type="button" onClick={() => setShowTeamMembers(false)}>
                Close
              </button>
            </div>
            <TeamMemberManagement onChanged={() => void loadAll(true)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
