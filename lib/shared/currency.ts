export type SubmissionCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

const CURRENCY_LABELS: Record<SubmissionCurrency, string> = {
  INR: 'Indian Rupees',
  USD: 'US Dollars',
  EUR: 'Euros',
  GBP: 'British Pounds',
  AED: 'UAE Dirhams',
};

export const CURRENCY_OPTIONS: SubmissionCurrency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

export function normalizeCurrency(value: string | null | undefined): SubmissionCurrency {
  const code = String(value || '').trim().toUpperCase();
  return (CURRENCY_OPTIONS.includes(code as SubmissionCurrency) ? code : 'INR') as SubmissionCurrency;
}

export function getCurrencyLabel(currency: string | null | undefined) {
  return normalizeCurrency(currency);
}

export function getCurrencyTitle(currency: string | null | undefined, amount?: number | null) {
  const code = normalizeCurrency(currency);
  const label = CURRENCY_LABELS[code];
  if (typeof amount !== 'number') return label;
  return `${label} - ${formatNumber(amount)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value || 0);
}

export function formatSubmissionAmount(value: number | null | undefined, currency?: string | null) {
  const code = normalizeCurrency(currency);
  return `${code}- ${formatNumber(Number(value || 0))}`;
}

