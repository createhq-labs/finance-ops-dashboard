export const CURRENCY_METADATA = {
  INR: { label: 'Indian Rupees', search: 'india bharat indian rupee inr' },
  USD: { label: 'US Dollars', search: 'united states usa america american dollar us dollar panama ecuador el salvador zimbabwe' },
  EUR: { label: 'Euros', search: 'euro european union europe germany france italy spain portugal netherlands belgium austria ireland finland greece' },
  GBP: { label: 'British Pounds', search: 'united kingdom uk britain england scotland wales northern ireland pound sterling' },
  AED: { label: 'UAE Dirhams', search: 'uae united arab emirates dubai abu dhabi dirham' },
  SAR: { label: 'Saudi Riyals', search: 'saudi saudi arabia riyal' },
  QAR: { label: 'Qatari Riyals', search: 'qatar doha riyal' },
  KWD: { label: 'Kuwaiti Dinars', search: 'kuwait dinar' },
  BHD: { label: 'Bahraini Dinars', search: 'bahrain dinar' },
  OMR: { label: 'Omani Rials', search: 'oman rial muscat' },
  JOD: { label: 'Jordanian Dinars', search: 'jordan amman dinar' },
  EGP: { label: 'Egyptian Pounds', search: 'egypt cairo pound' },
  ZAR: { label: 'South African Rand', search: 'south africa rand' },
  NGN: { label: 'Nigerian Naira', search: 'nigeria naira lagos abuja' },
  KES: { label: 'Kenyan Shillings', search: 'kenya nairobi shilling' },
  GHS: { label: 'Ghanaian Cedis', search: 'ghana accra cedi' },
  TRY: { label: 'Turkish Lira', search: 'turkey turkiye istanbul ankara lira' },
  ILS: { label: 'Israeli New Shekels', search: 'israel shekel tel aviv jerusalem' },
  CHF: { label: 'Swiss Francs', search: 'switzerland zurich geneva franc' },
  SEK: { label: 'Swedish Kronor', search: 'sweden stockholm krona' },
  NOK: { label: 'Norwegian Kroner', search: 'norway oslo krone' },
  DKK: { label: 'Danish Kroner', search: 'denmark copenhagen krone' },
  PLN: { label: 'Polish Zloty', search: 'poland warsaw zloty' },
  CZK: { label: 'Czech Koruna', search: 'czech republic prague koruna crown' },
  HUF: { label: 'Hungarian Forints', search: 'hungary budapest forint' },
  RON: { label: 'Romanian Leu', search: 'romania bucharest leu' },
  RUB: { label: 'Russian Rubles', search: 'russia moscow ruble' },
  CNY: { label: 'Chinese Yuan', search: 'china chinese yuan renminbi beijing shanghai' },
  JPY: { label: 'Japanese Yen', search: 'japan tokyo yen' },
  KRW: { label: 'South Korean Won', search: 'south korea seoul won' },
  SGD: { label: 'Singapore Dollars', search: 'singapore dollar' },
  HKD: { label: 'Hong Kong Dollars', search: 'hong kong hkd dollar' },
  TWD: { label: 'New Taiwan Dollars', search: 'taiwan taipei twd dollar' },
  THB: { label: 'Thai Baht', search: 'thailand bangkok baht' },
  MYR: { label: 'Malaysian Ringgit', search: 'malaysia kuala lumpur ringgit' },
  IDR: { label: 'Indonesian Rupiah', search: 'indonesia jakarta rupiah' },
  PHP: { label: 'Philippine Pesos', search: 'philippines manila peso' },
  VND: { label: 'Vietnamese Dong', search: 'vietnam hanoi ho chi minh dong' },
  AUD: { label: 'Australian Dollars', search: 'australia sydney melbourne brisbane perth canberra dollar' },
  NZD: { label: 'New Zealand Dollars', search: 'new zealand auckland wellington dollar' },
  CAD: { label: 'Canadian Dollars', search: 'canada toronto vancouver ottawa montreal dollar' },
  MXN: { label: 'Mexican Pesos', search: 'mexico mexico city peso' },
  BRL: { label: 'Brazilian Reais', search: 'brazil sao paulo rio de janeiro real' },
  ARS: { label: 'Argentine Pesos', search: 'argentina buenos aires peso' },
  CLP: { label: 'Chilean Pesos', search: 'chile santiago peso' },
  COP: { label: 'Colombian Pesos', search: 'colombia bogota peso' },
  PEN: { label: 'Peruvian Soles', search: 'peru lima sol' },
  UYU: { label: 'Uruguayan Pesos', search: 'uruguay montevideo peso' },
} as const;

export type SubmissionCurrency = keyof typeof CURRENCY_METADATA;

export const CURRENCY_OPTIONS: SubmissionCurrency[] = Object.keys(CURRENCY_METADATA) as SubmissionCurrency[];

export const CURRENCY_SEARCH_TEXT_BY_OPTION: Record<SubmissionCurrency, string> = Object.entries(CURRENCY_METADATA).reduce(
  (acc, [code, metadata]) => {
    acc[code as SubmissionCurrency] = `${metadata.label} ${metadata.search}`;
    return acc;
  },
  {} as Record<SubmissionCurrency, string>
);

export function normalizeCurrency(value: string | null | undefined): SubmissionCurrency {
  const code = String(value || '').trim().toUpperCase();
  return (CURRENCY_OPTIONS.includes(code as SubmissionCurrency) ? code : 'INR') as SubmissionCurrency;
}

export function getCurrencyLabel(currency: string | null | undefined) {
  const code = normalizeCurrency(currency);
  return CURRENCY_METADATA[code].label;
}

export function getCurrencyTitle(currency: string | null | undefined, amount?: number | null) {
  const code = normalizeCurrency(currency);
  const label = CURRENCY_METADATA[code].label;
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
