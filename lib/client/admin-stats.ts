type AdminSubmissionRow = {
  amount?: number | string | null;
  commercials?: number | string | null;
  invoice_type?: string | null;
  business_line?: string | null;
  submitted_at?: string | null;
  closed_status?: string | null;
};

export type RevenueSeriesPoint = {
  key: string;
  label: string;
  pi: number;
  ti: number;
  imPi: number;
  tmPi: number;
  imTi: number;
  tmTi: number;
  submitted: number;
  closed: number;
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
      imPi: 0,
      tmPi: 0,
      imTi: 0,
      tmTi: 0,
      submitted: 0,
      closed: 0,
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

    bucket.submitted += 1;
    if (normalizeText(row.closed_status) === 'closed') bucket.closed += 1;

    const amount = getRevenueAmount(row);
    const isPi = isPiInvoiceType(row.invoice_type);
    const isTi = isTiInvoiceType(row.invoice_type);
    if (isPi) bucket.pi += amount;
    if (isTi) bucket.ti += amount;
    if (row.business_line === 'IM') {
      if (isPi) bucket.imPi += amount;
      if (isTi) bucket.imTi += amount;
    } else if (row.business_line === 'TM') {
      if (isPi) bucket.tmPi += amount;
      if (isTi) bucket.tmTi += amount;
    }
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
