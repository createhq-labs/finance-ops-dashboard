type AdminSubmissionRow = {
  amount?: number | string | null;
  commercials?: number | string | null;
  invoice_type?: string | null;
  business_line?: string | null;
  submitted_at?: string | null;
};

export type RevenueSeriesPoint = {
  key: string;
  label: string;
  pi: number;
  ti: number;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function toMoney(value: number | string | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

export function isPiInvoiceType(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized.includes('proforma');
}

export function isTiInvoiceType(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized.includes('tax_invoice') || normalized.includes('with_gst') || normalized.includes('tax');
}

export function getRevenueAmount(row: AdminSubmissionRow) {
  return toMoney(typeof row.amount !== 'undefined' ? row.amount : row.commercials);
}

export function getRevenueSeries(rows: AdminSubmissionRow[], months = 6) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);

  const buckets = new Map<string, RevenueSeriesPoint>();
  for (let offset = 0; offset < months; offset += 1) {
    const cursor = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, {
      key,
      label: cursor.toLocaleDateString('en-IN', { month: 'short' }),
      pi: 0,
      ti: 0,
    });
  }

  for (const row of rows) {
    if (!row.submitted_at) continue;
    const date = new Date(row.submitted_at);
    if (Number.isNaN(date.getTime())) continue;
    if (date < start) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = getRevenueAmount(row);
    if (isPiInvoiceType(row.invoice_type)) bucket.pi += amount;
    if (isTiInvoiceType(row.invoice_type)) bucket.ti += amount;
  }

  return Array.from(buckets.values());
}

export function getLineRevenue(rows: AdminSubmissionRow[], line: 'IM' | 'TM' | null, kind: 'pi' | 'ti') {
  return rows.reduce((total, row) => {
    if (line && row.business_line !== line) return total;
    const match = kind === 'pi' ? isPiInvoiceType(row.invoice_type) : isTiInvoiceType(row.invoice_type);
    return match ? total + getRevenueAmount(row) : total;
  }, 0);
}
