"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SubmissionDrawer } from '../../../../components/dashboard/submission-drawer';
import { FilterBar } from '../../../../components/dashboard/filter-bar';
import { SubmissionTable, type SubmissionRow } from '../../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { PAYMENT_RECEIVED_STATUS_OPTIONS } from '../../../../lib/client/finance-status';
import { pickProductReimbursementAttachment, pickReferencePoAttachment } from '../../../../lib/shared/submission-attachments';
import { handleAuthTokenRecoveryMessage } from '../../../../lib/client/auth-recovery';
import { canResubmitSubmission, canSubmitInvoice, getDrawerViewerRole, getSubmissionsLabel } from '../../../../lib/client/dashboard-access';

type SubmissionAttachmentApiRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at?: string | null;
};

type MySubmissionApiRow = {
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
  creator_invoice_status?: string | null;
  payment_received?: string | null;
  payment_received_status?: string | null;
  payment_made?: string | null;
  payment_made_status?: string | null;
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
  submission_attachments?: SubmissionAttachmentApiRow[];
};

type MySubmissionsResponse = {
  success?: boolean;
  submissions?: MySubmissionApiRow[];
  has_more?: boolean;
  next_offset?: number | null;
  error?: string;
};

type EmployeePaymentFilter = 'all' | (typeof PAYMENT_RECEIVED_STATUS_OPTIONS)[number]['value'];

const PAGE_SIZE = 50;

function normalizeStatusValue(value: string | null | undefined) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (normalized === 'not_received') return 'not_received';
  if (normalized === 'not_paid') return 'not_paid';
  if (normalized === 'received') return 'received';
  if (normalized === 'paid') return 'paid';
  if (normalized === 'full') return 'full';
  if (normalized === 'partial') return 'partial';
  if (normalized === 'pending') return 'pending';
  return normalized;
}

function hasStartedLifecycleStatus(value: string | null | undefined) {
  const normalized = normalizeStatusValue(value);
  return Boolean(normalized && normalized !== 'pending');
}

function mapSubmissionRow(item: MySubmissionApiRow, userName?: string | null, userEmail?: string | null): SubmissionRow {
  return {
    id: String(item.id),
    pi: item.proforma_invoice ?? '',
    entity: item.agency_brand_name || '-',
    amount: Number(item.commercials ?? 0),
    currency: item.currency || 'INR',
    owner_name: userName || undefined,
    submitter_email: item.email_address || userEmail || undefined,
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
    creator_invoice_received: normalizeStatusValue(item.creator_invoice_status) || undefined,
    payment_received: normalizeStatusValue(item.payment_received_status || item.payment_received) || undefined,
    payment_made: normalizeStatusValue(item.payment_made_status || item.payment_made) || undefined,
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

export default function EmployeeSubmissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useDashboardSession();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const [query, setQuery] = useState('');
  const [intakeStatusFilter, setIntakeStatusFilter] = useState<'all' | SubmissionRow['intake_status']>('all');
  const [versionStatusFilter, setVersionStatusFilter] = useState<'all' | NonNullable<SubmissionRow['version_status']>>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<EmployeePaymentFilter>('all');
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [rowsError, setRowsError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [highlightedSubmissionId, setHighlightedSubmissionId] = useState<string | null>(null);
  const [deepLinkNotice, setDeepLinkNotice] = useState('');
  const handledSubmissionIdRef = useRef<string | null>(null);
  const loadingSubmissionIdRef = useRef<string | null>(null);

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
        if (intakeStatusFilter !== 'all') params.set('intake_status', intakeStatusFilter);
        if (versionStatusFilter !== 'all') params.set('version_status', versionStatusFilter);
        if (paymentStatusFilter !== 'all') params.set('payment_status', paymentStatusFilter);

        const res = await fetch('/api/submissions/my?' + params.toString(), { method: 'GET', cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as MySubmissionsResponse;
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load submissions.');
        }

        const mapped = ((json.submissions ?? []) as MySubmissionApiRow[]).map((item) =>
          mapSubmissionRow(item, user.full_name, user.email)
        );

        setRows((current) => (append ? mergeRows(current, mapped) : mapped));
        setHasMore(Boolean(json.has_more));
        setNextOffset(typeof json.next_offset === 'number' ? json.next_offset : null);
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : 'Failed to load submissions.';
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
    [intakeStatusFilter, paymentStatusFilter, query, user, versionStatusFilter]
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
    void loadRows(0, false);
  }, [loadRows, user]);

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
        const res = await fetch('/api/submissions/my?' + params.toString(), { method: 'GET', cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as MySubmissionsResponse;
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to locate submission.');
        }

        const item = json.submissions?.[0];
        if (!item) {
          if (!cancelled) setDeepLinkNotice('Submission not found in current view.');
          return;
        }

        const mapped = mapSubmissionRow(item, user.full_name, user.email);
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

  if (loading || !user) return null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title={getSubmissionsLabel(user.role)}
        description="Review your intake records, status updates, resubmission notes, and resubmission actions."
        className="border-b-0 pb-4"
        actions={canSubmitInvoice(user.role) ? (
          <Link className="btn btn-primary" href="/dashboard/submissions/new">
            New Submission
          </Link>
        ) : null}
      />

      <SectionCard padding={16}>
        <FilterBar
          searchPlaceholder="Search PI, entity, creator, or brand"
          searchValue={query}
          primaryFilters={[
            {
              key: 'status',
              label: 'Status',
              value: intakeStatusFilter,
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
              key: 'versionStatus',
              label: 'Version Status',
              type: 'select',
              value: versionStatusFilter,
              options: [
                { value: 'all', label: 'All' },
                { value: 'original', label: 'Original' },
                { value: 'resubmitted', label: 'Resubmitted' },
                { value: 'superseded', label: 'Superseded' },
              ],
            },
            {
              key: 'paymentStatus',
              label: 'Payment Status',
              type: 'select',
              value: paymentStatusFilter,
              options: [{ value: 'all', label: 'All' }, ...PAYMENT_RECEIVED_STATUS_OPTIONS],
            },
          ]}
          onSearch={setQuery}
          onPrimaryChange={(key, value) => {
            if (key === 'status') setIntakeStatusFilter((value || 'all') as 'all' | SubmissionRow['intake_status']);
          }}
          onAdvancedChange={(filters) => {
            setVersionStatusFilter((filters.versionStatus || 'all') as 'all' | NonNullable<SubmissionRow['version_status']>);
            setPaymentStatusFilter((filters.paymentStatus || 'all') as EmployeePaymentFilter);
          }}
          onReset={() => {
            setVersionStatusFilter('all');
            setPaymentStatusFilter('all');
          }}
        />
      </SectionCard>

      {rowsLoading ? <WorkspaceLoader variant="section" label="Loading submissions..." /> : null}
      {rowsError ? <StatePanel tone="danger" padding={12}>{rowsError}</StatePanel> : null}
      {deepLinkNotice ? <p className="text-xs text-muted-foreground">{deepLinkNotice}</p> : null}
      {!rowsLoading && !rowsError ? (
        <div className="grid gap-3">
          <SubmissionTable
            rows={rows}
            onOpen={(id, selectedRow) => {
              if (selectedRow && canResubmitSubmission(user.role, selectedRow)) {
                router.push('/dashboard/submissions/new?resubmit_id=' + id);
                return;
              }
              setOpenId(id);
            }}
            columns={['pi', 'entity', 'amount', 'intake_status', 'invoice_status', 'submitted_at', 'rejection_note', 'actions']}
            emptyLabel="No submissions found yet."
            getActionLabel={(currentRow) => canResubmitSubmission(user.role, currentRow) ? 'Resubmit' : 'View'}
            viewer={user.role}
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
                    <p className="px-3 py-3 text-center text-xs text-muted-foreground">You&apos;ve reached the latest submissions.</p>
                  )
                ) : null}
              </div>
            )}
          />
        </div>
      ) : null}

      <SubmissionDrawer
        open={Boolean(row)}
        onClose={() => setOpenId(null)}
        row={row}
        viewer={getDrawerViewerRole(user.role)}
        onResubmit={(id) => {
          router.push('/dashboard/submissions/new?resubmit_id=' + id);
        }}
      />
    </div>
  );
}
