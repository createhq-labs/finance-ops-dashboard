type PiLineItemLike = {
  deliverable_name?: string | null;
};

type PiDisplayInput = {
  pi?: string | null;
  submittedAt?: string | null;
  invoiceType?: string | null;
  lineItems?: PiLineItemLike[] | null;
};

function normalizeComparison(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isPiNotRequiredSubmission(input: Pick<PiDisplayInput, 'invoiceType' | 'lineItems'>) {
  if (normalizeComparison(input.invoiceType) !== normalizeComparison('Reimbursement Invoice (Without GST)')) {
    return false;
  }

  const lineItems = input.lineItems ?? [];
  if (lineItems.length !== 1) return false;

  return normalizeComparison(lineItems[0]?.deliverable_name) === normalizeComparison('Product Reimbursement');
}

function formatStoredPi(pi: string, submittedAt?: string | null) {
  const value = pi.trim();
  const match = value.match(/(\d+)/);
  if (!match || !submittedAt) return value;

  const date = new Date(submittedAt);
  if (Number.isNaN(date.getTime())) return value;

  const month = date.getMonth();
  const year = date.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  const sequence = match[1].padStart(6, '0');

  return `PI/${startYear}-${endYearShort}/${sequence}`;
}

export function getPiDisplayMeta(input: PiDisplayInput) {
  const pi = String(input.pi || '').trim();

  if (pi) {
    const label = formatStoredPi(pi, input.submittedAt);
    return {
      label,
      title: label,
      description: '',
      isPiNotRequired: false,
    };
  }

  if (isPiNotRequiredSubmission(input)) {
    return {
      label: 'PI Not Required',
      title: 'Product reimbursement without GST',
      description: 'Product reimbursement without GST',
      isPiNotRequired: true,
    };
  }

  return {
    label: 'PI pending approval',
    title: 'PI pending approval',
    description: 'PI will be allocated after finance acceptance',
    isPiNotRequired: false,
  };
}
