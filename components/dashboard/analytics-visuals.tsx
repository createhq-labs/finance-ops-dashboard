import { Fragment, type ReactNode } from 'react';

type MetricTone = 'navy' | 'cyan' | 'teal' | 'green' | 'amber' | 'rose' | 'violet' | 'slate';

type ChartSeries = {
  key: string;
  label: string;
  color: string;
  fill?: string;
};

type ChartPoint = {
  label: string;
  values: Record<string, number>;
};

type ProgressItem = {
  label: string;
  value: number;
  displayValue?: string;
  sublabel?: string;
  color?: string;
  accent?: string;
};

type TimelineItem = {
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: MetricTone;
  action?: ReactNode;
};

type GaugeItem = {
  label: string;
  value: number;
  subtitle?: string;
  detail?: string;
  tone?: MetricTone;
};

const toneTokens: Record<MetricTone, { border: string; bg: string; text: string; muted: string; dot: string }> = {
  navy: {
    border: 'border-blue-200/80 dark:border-blue-500/35',
    bg: 'bg-blue-50/80 dark:bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-300',
    muted: 'text-blue-600/80 dark:text-blue-200/80',
    dot: '#4f46e5',
  },
  cyan: {
    border: 'border-sky-200/80 dark:border-sky-500/35',
    bg: 'bg-sky-50/80 dark:bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    muted: 'text-sky-600/80 dark:text-sky-200/80',
    dot: '#06b6d4',
  },
  teal: {
    border: 'border-teal-200/80 dark:border-teal-500/35',
    bg: 'bg-teal-50/80 dark:bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-300',
    muted: 'text-teal-600/80 dark:text-teal-200/80',
    dot: '#14b8a6',
  },
  green: {
    border: 'border-emerald-200/80 dark:border-emerald-500/35',
    bg: 'bg-emerald-50/80 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    muted: 'text-emerald-600/80 dark:text-emerald-200/80',
    dot: '#10b981',
  },
  amber: {
    border: 'border-amber-200/80 dark:border-amber-500/35',
    bg: 'bg-amber-50/80 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    muted: 'text-amber-600/80 dark:text-amber-200/80',
    dot: '#f59e0b',
  },
  rose: {
    border: 'border-rose-200/80 dark:border-rose-500/35',
    bg: 'bg-rose-50/80 dark:bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-300',
    muted: 'text-rose-600/80 dark:text-rose-200/80',
    dot: '#ef4444',
  },
  violet: {
    border: 'border-violet-200/80 dark:border-violet-500/35',
    bg: 'bg-violet-50/80 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    muted: 'text-violet-600/80 dark:text-violet-200/80',
    dot: '#8b5cf6',
  },
  slate: {
    border: 'border-slate-200/80 dark:border-slate-500/35',
    bg: 'bg-slate-50/80 dark:bg-slate-500/10',
    text: 'text-slate-700 dark:text-slate-200',
    muted: 'text-slate-500 dark:text-slate-300/80',
    dot: '#64748b',
  },
};

function clampPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 100) return 100;
  return value;
}

function chartMax(points: ChartPoint[], keys: string[], stacked = false) {
  if (points.length === 0) return 1;
  const values = points.map((point) => (
    stacked
      ? keys.reduce((sum, key) => sum + (Number(point.values[key] ?? 0) || 0), 0)
      : Math.max(...keys.map((key) => Number(point.values[key] ?? 0) || 0))
  ));
  return Math.max(1, ...values);
}

function defaultTickFormatter(value: number) {
  return `${Math.round(value)}`;
}

type AnalyticsDensity = 'default' | 'compact';

function EmptyChartState({ label, density = 'default' }: { label: string; density?: AnalyticsDensity }) {
  return (
    <div className={`flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground ${density === 'compact' ? 'h-[210px]' : 'h-[260px]'}`}>
      {label}
    </div>
  );
}

export function AnalyticsPanel({ title, subtitle, children, action, density = 'default', dense = false }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; density?: AnalyticsDensity; dense?: boolean }) {
  return (
    <section className={`${dense ? 'rounded-xl px-3 py-2.5' : density === 'compact' ? 'rounded-xl p-4' : 'rounded-[24px] p-5'} border border-border/65 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.24)]`}>
      <div className={`${dense ? 'mb-2' : density === 'compact' ? 'mb-3' : 'mb-4'} flex items-start justify-between gap-3`}>
        <div>
          <h3 className={`${density === 'compact' ? 'text-[13.5px]' : 'text-[1.05rem]'} font-semibold tracking-tight text-foreground`}>{title}</h3>
          {subtitle ? <p className={`${density === 'compact' ? 'mt-0.5 text-xs leading-5' : 'mt-1 text-sm'} text-muted-foreground`}>{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AnalyticsMetricCard({ title, value, hint, trend, tone = 'cyan', sparkline, density = 'default' }: { title: string; value: string; hint?: string; trend?: string | null; tone?: MetricTone; sparkline?: number[]; density?: AnalyticsDensity }) {
  const token = toneTokens[tone];
  const maxSpark = sparkline && sparkline.length ? Math.max(...sparkline, 1) : 1;
  const sparkPath = sparkline && sparkline.length > 1
    ? sparkline
        .map((entry, index) => {
          const x = (index / (sparkline.length - 1)) * 84;
          const y = 28 - ((entry || 0) / maxSpark) * 20;
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ')
    : '';

  return (
    <div className={`relative overflow-hidden border border-border/70 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.24)] ${density === 'compact' ? 'rounded-xl px-3.5 py-3' : 'rounded-[22px] px-5 py-4'}`}>
      <div className={`absolute inset-y-0 left-0 ${density === 'compact' ? 'w-[3px]' : 'w-1'} ${tone === 'navy' ? 'bg-blue-500' : tone === 'cyan' ? 'bg-cyan-500' : tone === 'teal' ? 'bg-teal-500' : tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'rose' ? 'bg-rose-500' : tone === 'violet' ? 'bg-violet-500' : 'bg-slate-400'}`} />
      <div className={`flex flex-col justify-between pl-2.5 ${density === 'compact' ? 'min-h-[88px]' : 'min-h-[116px]'}`}>
        <div className="flex items-start justify-between gap-3">
          <p className={`${density === 'compact' ? 'text-[13px]' : 'text-[0.95rem]'} font-medium text-muted-foreground`}>{title}</p>
          {trend ? (
            <span className={`inline-flex rounded-full ${density === 'compact' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} font-semibold ${token.bg} ${token.text}`}>
              {trend}
            </span>
          ) : null}
        </div>
        <div>
          <div className={`${density === 'compact' ? 'text-[clamp(1.45rem,1.8vw,1.9rem)]' : 'text-[clamp(1.9rem,2.4vw,2.6rem)]'} font-bold leading-none tracking-tight text-foreground`}>{value}</div>
          {hint ? <p className={`${density === 'compact' ? 'mt-1 text-xs' : 'mt-2 text-sm'} text-muted-foreground`}>{hint}</p> : null}
        </div>
        {sparkPath ? (
          <svg viewBox="0 0 84 30" className={`${density === 'compact' ? 'mt-1 h-5 w-20' : 'mt-2 h-7 w-24'} overflow-visible`}>
            <path d={sparkPath} fill="none" stroke={token.dot} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
    </div>
  );
}

export function AnalyticsChip({ label, tone = 'slate' }: { label: string; tone?: MetricTone }) {
  const token = toneTokens[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${token.border} ${token.bg} ${token.text}`}>{label}</span>;
}

export function LineAreaChart({ points, series, height = 280, valueFormatter = defaultTickFormatter, emptyLabel = 'No chart data available yet.', density = 'default' }: { points: ChartPoint[]; series: ChartSeries[]; height?: number; valueFormatter?: (value: number) => string; emptyLabel?: string; density?: AnalyticsDensity }) {
  if (!points.length || !series.length) return <EmptyChartState label={emptyLabel} density={density} />;

  const width = 880;
  const padLeft = 54;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;
  const innerWidth = width - padLeft - padRight;
  const maxValue = chartMax(points, series.map((item) => item.key));
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const pointX = (index: number) => padLeft + (innerWidth * index) / Math.max(points.length - 1, 1);
  const pointY = (value: number) => padTop + ((height - padTop - padBottom) * (1 - value / maxValue));

  return (
    <div className="grid gap-3">
      <svg viewBox={`0 0 ${width} ${height}`} className={`${density === 'compact' ? 'h-[220px]' : 'h-[280px]'} w-full overflow-visible`}>
        {ticks.map((ratio) => {
          const y = pointY(maxValue * ratio);
          return (
            <g key={ratio}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 7" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {valueFormatter(maxValue * ratio)}
              </text>
            </g>
          );
        })}
        {series.map((entry) => {
          const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${pointX(index)} ${pointY(Number(point.values[entry.key] ?? 0))}`).join(' ');
          const area = `${path} L ${pointX(points.length - 1)} ${height - padBottom} L ${pointX(0)} ${height - padBottom} Z`;
          return (
            <g key={entry.key}>
              {entry.fill ? <path d={area} fill={entry.fill} opacity="0.18" /> : null}
              <path d={path} fill="none" stroke={entry.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <circle key={`${entry.key}-${point.label}`} cx={pointX(index)} cy={pointY(Number(point.values[entry.key] ?? 0))} r="4.75" fill={entry.color} stroke="white" strokeWidth="2" />
              ))}
            </g>
          );
        })}
        {points.map((point, index) => (
          <text key={point.label} x={pointX(index)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {point.label}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {series.map((entry) => (
          <span key={entry.key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function GroupedBarChart({ points, series, emptyLabel = 'No comparison data available yet.', density = 'default' }: { points: ChartPoint[]; series: ChartSeries[]; emptyLabel?: string; density?: AnalyticsDensity }) {
  if (!points.length || !series.length) return <EmptyChartState label={emptyLabel} density={density} />;
  const width = 760;
  const height = 260;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 38;
  const maxValue = chartMax(points, series.map((entry) => entry.key));
  const innerWidth = width - padLeft - padRight;
  const bandWidth = innerWidth / Math.max(points.length, 1);
  const barGroupWidth = Math.min(56, bandWidth * 0.72);
  const barWidth = Math.max(10, barGroupWidth / Math.max(series.length, 1) - 8);

  return (
    <div className="grid gap-3">
      <svg viewBox={`0 0 ${width} ${height}`} className={`${density === 'compact' ? 'h-[215px]' : 'h-[260px]'} w-full overflow-visible`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padTop + (height - padTop - padBottom) * (1 - ratio);
          return <line key={ratio} x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 7" />;
        })}
        {points.map((point, index) => {
          const startX = padLeft + bandWidth * index + (bandWidth - barGroupWidth) / 2;
          return (
            <g key={`${point.label}-${index}`}>
              {series.map((entry, seriesIndex) => {
                const value = Number(point.values[entry.key] ?? 0);
                const barHeight = ((height - padTop - padBottom) * value) / maxValue;
                const x = startX + seriesIndex * (barWidth + 8);
                return (
                  <rect
                    key={entry.key}
                    x={x}
                    y={height - padBottom - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx="8"
                    fill={entry.color}
                    opacity="0.95"
                  />
                );
              })}
              <text x={startX + barGroupWidth / 2} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {series.map((entry) => (
          <span key={entry.key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StackedBarChart({ points, series, emptyLabel = 'No stacked breakdown available yet.', density = 'default' }: { points: ChartPoint[]; series: ChartSeries[]; emptyLabel?: string; density?: AnalyticsDensity }) {
  if (!points.length || !series.length) return <EmptyChartState label={emptyLabel} density={density} />;
  const width = 820;
  const height = 280;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 38;
  const keys = series.map((entry) => entry.key);
  const maxValue = chartMax(points, keys, true);
  const innerWidth = width - padLeft - padRight;
  const bandWidth = innerWidth / Math.max(points.length, 1);
  const barWidth = Math.min(54, bandWidth * 0.58);

  return (
    <div className="grid gap-3">
      <svg viewBox={`0 0 ${width} ${height}`} className={`${density === 'compact' ? 'h-[220px]' : 'h-[280px]'} w-full overflow-visible`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padTop + (height - padTop - padBottom) * (1 - ratio);
          return <line key={ratio} x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 7" />;
        })}
        {points.map((point, index) => {
          const x = padLeft + bandWidth * index + (bandWidth - barWidth) / 2;
          let currentTop = height - padBottom;
          return (
            <g key={`${point.label}-${index}`}>
              {series.map((entry) => {
                const value = Number(point.values[entry.key] ?? 0);
                const barHeight = ((height - padTop - padBottom) * value) / maxValue;
                currentTop -= barHeight;
                return <rect key={entry.key} x={x} y={currentTop} width={barWidth} height={barHeight} rx="8" fill={entry.color} opacity="0.95" />;
              })}
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {series.map((entry) => (
          <span key={entry.key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ segments, centerLabel, centerValue, emptyLabel = 'No split available yet.', density = 'default' }: { segments: Array<{ label: string; value: number; color: string; note?: string }>; centerLabel: string; centerValue: string; emptyLabel?: string; density?: AnalyticsDensity }) {
  const visible = segments.filter((entry) => entry.value > 0);
  const total = visible.reduce((sum, entry) => sum + entry.value, 0);
  if (!visible.length || total <= 0) return <EmptyChartState label={emptyLabel} density={density} />;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let running = 0;

  return (
    <div className={`grid md:items-center ${density === 'compact' ? 'gap-4 md:grid-cols-[170px_minmax(0,1fr)]' : 'gap-5 md:grid-cols-[220px_minmax(0,1fr)]'}`}>
      <div className={`relative mx-auto ${density === 'compact' ? 'h-[160px] w-[160px]' : 'h-[200px] w-[200px]'}`}>
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="16" />
          {visible.map((entry) => {
            const length = (entry.value / total) * circumference;
            const offset = -running;
            running += length;
            return (
              <circle
                key={entry.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={entry.color}
                strokeWidth="16"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className={`${density === 'compact' ? 'text-[1.45rem]' : 'text-[2rem]'} font-bold leading-none tracking-tight text-foreground`}>{centerValue}</div>
            <div className={`${density === 'compact' ? 'mt-1 text-[10px]' : 'mt-2 text-[11px]'} font-semibold uppercase tracking-[0.18em] text-muted-foreground`}>{centerLabel}</div>
          </div>
        </div>
      </div>
      <div className="grid gap-3">
        {visible.map((entry) => {
          const percent = Math.round((entry.value / total) * 100);
          return (
            <div key={entry.label} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 px-3.5 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <div>
                  <div className="text-sm font-semibold text-foreground">{entry.label}</div>
                  {entry.note ? <div className="text-xs text-muted-foreground">{entry.note}</div> : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">{percent}%</div>
                <div className="text-xs text-muted-foreground">{entry.value.toLocaleString('en-IN')}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RankedProgressList({ items, emptyLabel = 'No ranked data available yet.', density = 'default' }: { items: ProgressItem[]; emptyLabel?: string; density?: AnalyticsDensity }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className={`grid ${density === 'compact' ? 'gap-2.5' : 'gap-3'}`}>
      {items.map((item, index) => (
        <div key={item.label} className="grid grid-cols-[24px_minmax(0,1fr)_88px] items-center gap-3">
          <div className={`${density === 'compact' ? 'text-base' : 'text-lg'} font-semibold text-muted-foreground/70`}>{index + 1}</div>
          <div className={density === 'compact' ? 'space-y-1' : 'space-y-1.5'}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className={`${density === 'compact' ? 'text-sm' : 'text-base'} truncate font-medium text-foreground`}>{item.label}</div>
                {item.sublabel ? <div className="truncate text-xs text-muted-foreground">{item.sublabel}</div> : null}
              </div>
              <div className="shrink-0 text-sm font-semibold text-muted-foreground">{item.displayValue ?? item.value.toLocaleString('en-IN')}</div>
            </div>
            <div className={`${density === 'compact' ? 'h-2' : 'h-3'} overflow-hidden rounded-full bg-muted/50`}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${clampPercent((item.value / max) * 100)}%`,
                  background: item.color || 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                }}
              />
            </div>
          </div>
          <div className="text-right text-sm font-semibold text-foreground">{item.accent ?? ''}</div>
        </div>
      ))}
    </div>
  );
}

export function GaugeGrid({ items, density = 'default' }: { items: GaugeItem[]; density?: AnalyticsDensity }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">No team lead insight available yet.</div>;
  return (
    <div className={`grid md:grid-cols-3 ${density === 'compact' ? 'gap-3' : 'gap-4'}`}>
      {items.map((item) => {
        const tone = toneTokens[item.tone ?? 'cyan'];
        const circumference = 2 * Math.PI * 42;
        const arc = circumference * Math.max(0, Math.min(1, item.value));
        return (
          <div key={item.label} className={`${density === 'compact' ? 'rounded-xl px-3 py-4' : 'rounded-[22px] px-4 py-5'} border border-border/60 text-center`}>
            <div className={`${density === 'compact' ? 'text-sm' : 'text-[1.05rem]'} font-semibold text-foreground`}>{item.label}</div>
            {item.subtitle ? <div className={`${density === 'compact' ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} text-muted-foreground`}>{item.subtitle}</div> : null}
            <div className={`relative mx-auto ${density === 'compact' ? 'mt-3 h-[104px] w-[104px]' : 'mt-5 h-[132px] w-[132px]'}`}>
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="10" />
                <circle cx="60" cy="60" r="42" fill="none" stroke={tone.dot} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} ${circumference - arc}`} />
              </svg>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className={`${density === 'compact' ? 'text-[1.45rem]' : 'text-[2rem]'} font-bold leading-none tracking-tight text-foreground`}>{Math.round(item.value * 100)}%</div>
                  <div className={`${density === 'compact' ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} text-muted-foreground`}>complete</div>
                </div>
              </div>
            </div>
            {item.detail ? <div className={`${density === 'compact' ? 'mt-3 text-xs' : 'mt-4 text-sm'} font-medium text-muted-foreground`}>{item.detail}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export function TimelineList({ items, emptyLabel = 'No recent activity yet.' }: { items: TimelineItem[]; emptyLabel?: string }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/80" />
      <div className="grid gap-4">
        {items.map((item) => {
          const tone = toneTokens[item.tone ?? 'cyan'];
          return (
            <div key={`${item.title}-${item.meta ?? ''}`} className="relative flex items-start justify-between gap-4">
              <span className="absolute -left-[18px] top-2 h-3.5 w-3.5 rounded-full border-2 border-background" style={{ backgroundColor: tone.dot }} />
              <div className="min-w-0">
                <div className="text-[0.98rem] font-semibold text-foreground">{item.title}</div>
                {item.subtitle ? <div className="mt-1 text-sm text-muted-foreground">{item.subtitle}</div> : null}
              </div>
              <div className="shrink-0 text-right">
                {item.action ? <div className="mb-2">{item.action}</div> : null}
                {item.meta ? <div className="text-sm text-muted-foreground">{item.meta}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StackedWorkloadRows({ rows, segments }: { rows: Array<{ label: string; totalLabel?: string; values: Record<string, number> }>; segments: ChartSeries[] }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground">No workload data available yet.</div>;
  const max = Math.max(1, ...rows.map((row) => segments.reduce((sum, segment) => sum + Number(row.values[segment.key] ?? 0), 0)));
  return (
    <div className="grid gap-4">
      {rows.map((row) => {
        const total = segments.reduce((sum, segment) => sum + Number(row.values[segment.key] ?? 0), 0);
        return (
          <div key={row.label} className="grid grid-cols-[120px_minmax(0,1fr)_54px] items-center gap-4">
            <div className="text-base font-medium text-foreground">{row.label}</div>
            <div className="flex h-11 overflow-hidden rounded-2xl bg-muted/30">
              {segments.map((segment) => {
                const value = Number(row.values[segment.key] ?? 0);
                const width = total > 0 ? (value / total) * 100 : 0;
                if (value <= 0) return null;
                return (
                  <div key={segment.key} className="flex items-center justify-center text-sm font-semibold text-white" style={{ width: `${width}%`, backgroundColor: segment.color }}>
                    {value}
                  </div>
                );
              })}
            </div>
            <div className="text-right text-lg font-semibold text-muted-foreground">{row.totalLabel ?? total}</div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {segments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgingBuckets({ buckets }: { buckets: Array<{ label: string; value: number; note: string; tone: MetricTone }> }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        {buckets.map((bucket) => {
          const tone = toneTokens[bucket.tone];
          return (
            <div key={bucket.label} className={`rounded-[22px] border px-5 py-4 text-center ${tone.border} ${tone.bg}`}>
              <div className={`text-[2.4rem] font-bold leading-none tracking-tight ${tone.text}`}>{bucket.value}</div>
              <div className={`mt-2 text-[1.05rem] font-semibold ${tone.text}`}>{bucket.label}</div>
              <div className={`mt-1 text-sm ${tone.muted}`}>{bucket.note}</div>
            </div>
          );
        })}
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/35">
        {buckets.map((bucket) => (
          <div key={bucket.label} style={{ width: `${total > 0 ? (bucket.value / total) * 100 : 0}%`, backgroundColor: toneTokens[bucket.tone].dot }} />
        ))}
      </div>
    </div>
  );
}

export function WorkflowBars({ rows, density = 'default' }: { rows: Array<{ label: string; value: number; tone?: MetricTone; note?: string }>; density?: AnalyticsDensity }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground">No workflow data available yet.</div>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className={`grid ${density === 'compact' ? 'gap-3' : 'gap-4'}`}>
      {rows.map((row) => {
        const tone = toneTokens[row.tone ?? 'navy'];
        return (
          <div key={row.label}>
            <div className={`${density === 'compact' ? 'mb-1.5' : 'mb-2'} flex items-center justify-between gap-4`}>
              <div className={`${density === 'compact' ? 'text-sm' : 'text-[1.05rem]'} font-medium text-foreground`}>{row.label}</div>
              <div className={`${density === 'compact' ? 'text-sm' : 'text-[1.05rem]'} font-semibold text-muted-foreground`}>{row.value}</div>
            </div>
            <div className={`${density === 'compact' ? 'h-7 rounded-xl' : 'h-10 rounded-2xl'} overflow-hidden bg-muted/30`}>
              <div className={`${density === 'compact' ? 'rounded-xl px-3 text-xs' : 'rounded-2xl px-4 text-base'} flex h-full items-center font-semibold text-white`} style={{ width: `${clampPercent((row.value / max) * 100)}%`, backgroundColor: tone.dot }}>
                {row.value}
              </div>
            </div>
            {row.note ? <div className={`mt-2 text-sm ${tone.text}`}>{row.note}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

type IconComponent = (props: { size?: number; strokeWidth?: number; className?: string }) => ReactNode;

export function OverviewKpiCard({
  title,
  value,
  icon: Icon,
  iconTone = 'cyan',
  hint,
  trend,
  sparkline,
}: {
  title: string;
  value: string;
  icon: IconComponent;
  iconTone?: MetricTone;
  hint?: string;
  trend?: string | null;
  sparkline?: number[];
}) {
  const token = toneTokens[iconTone];
  const hasSpark = Boolean(sparkline && sparkline.length > 1);
  const maxSpark = sparkline && sparkline.length ? Math.max(...sparkline, 1) : 1;
  const sparkPath = hasSpark
    ? sparkline!
        .map((entry, index) => {
          const x = (index / (sparkline!.length - 1)) * 100;
          const y = 24 - ((entry || 0) / maxSpark) * 20;
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ')
    : '';
  const trendPositive = typeof trend === 'string' && trend.trim().startsWith('+');
  const trendNegative = typeof trend === 'string' && trend.trim().startsWith('-');
  const trendDisplay = trend ? trend.replace(/^[+-]/, '').replace(/\s*MoM$/i, '').trim() : '—';

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border/90 hover:shadow-[0_8px_20px_rgba(15,23,42,0.09),0_2px_6px_rgba(15,23,42,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.24)] dark:hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl" style={{ backgroundColor: token.dot }} />
      <div className="py-2 pl-3.5 pr-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12.5px] font-medium leading-snug text-muted-foreground">{title}</p>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${token.bg} ${token.text}`}>
            <Icon size={16} strokeWidth={2.2} />
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="text-[clamp(1.4rem,1.9vw,1.7rem)] font-bold leading-none tracking-tight text-foreground">{value}</div>
          {hasSpark ? (
            <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-20 shrink-0 overflow-visible">
              <path d={sparkPath} fill="none" stroke={token.dot} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
            </svg>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/50 pt-0.5">
          <span className="text-[11px] text-muted-foreground">{hint ?? 'vs last month'}</span>
          <span className={`text-[11px] font-bold ${trendPositive ? 'text-emerald-600 dark:text-emerald-400' : trendNegative ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
            {trendPositive ? '↑ ' : trendNegative ? '↓ ' : ''}{trendDisplay}
          </span>
        </div>
      </div>
    </div>
  );
}

export function WorkflowStageCards({
  stages,
}: {
  stages: Array<{ label: string; count: number; percent: number; icon: ReactNode; tone?: MetricTone }>;
}) {
  if (!stages.length) return <div className="text-sm text-muted-foreground">No workflow data available yet.</div>;
  return (
    <div className="mt-6 flex items-stretch gap-2">
      {stages.map((stage, index) => {
        const tone = toneTokens[stage.tone ?? 'navy'];
        return (
          <Fragment key={stage.label}>
            <div className="relative flex h-[167px] min-w-0 flex-1 basis-0 flex-col items-center justify-between overflow-hidden rounded-lg border border-border/60 bg-card px-2 pb-4 pt-4 text-center shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
              <div className={`flex items-center justify-center ${tone.text}`}>{stage.icon}</div>
              <div className="text-[11.5px] font-bold leading-tight text-foreground">{stage.label}</div>
              <div className="text-[22px] font-bold leading-none tracking-tight text-foreground">{stage.count}</div>
              <div className="text-[12px] font-medium text-muted-foreground">{clampPercent(stage.percent)}%</div>
              <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: tone.dot }} />
            </div>
            {index < stages.length - 1 ? (
              <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] shrink-0 self-center text-muted-foreground/60" fill="currentColor" aria-hidden="true">
                <path d="M3 10.2h10V6.5l8 5.5-8 5.5v-3.7H3z" />
              </svg>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export function BusinessLineSplit({
  blocks,
}: {
  blocks: Array<{ label: string; value: number; displayValue: string; percent: number; tone: MetricTone }>;
}) {
  if (!blocks.length) return <div className="text-sm text-muted-foreground">No split available yet.</div>;
  return (
    <div className="mt-8 grid grid-cols-2 divide-x divide-border/60 overflow-hidden rounded-lg border border-border/60 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
      {blocks.map((block) => {
        const tone = toneTokens[block.tone];
        return (
          <div key={block.label} className="px-3 py-5">
            <div className={`text-[13px] font-semibold ${tone.text}`}>{block.label}</div>
            <div className="mt-2 text-2xl font-bold leading-none tracking-tight text-foreground">{block.displayValue}</div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted/40">
              <div className="h-full rounded-full" style={{ width: `${clampPercent(block.percent)}%`, backgroundColor: tone.dot }} />
            </div>
            <div className="mt-2.5 text-xl font-bold leading-none tracking-tight text-foreground">{block.percent}%</div>
          </div>
        );
      })}
    </div>
  );
}

const workloadStatusTokens: Record<'High' | 'Medium' | 'Low', string> = {
  High: 'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200',
  Medium: 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200',
  Low: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200',
};

export function PendingWorkloadTable({
  rows,
}: {
  rows: Array<{ label: string; count: number; status: 'High' | 'Medium' | 'Low'; icon: ReactNode }>;
}) {
  if (!rows.length) return <div className="text-sm text-muted-foreground">No pending workload right now.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-2 font-semibold">Queue</th>
            <th className="pb-2 px-2 font-semibold">Count</th>
            <th className="pb-2 pl-2 font-semibold text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/40 last:border-b-0">
              <td className="py-2.5 pr-2">
                <span className="inline-flex items-center gap-2 font-medium text-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">{row.icon}</span>
                  {row.label}
                </span>
              </td>
              <td className="py-2.5 px-2 font-semibold text-foreground">{row.count}</td>
              <td className="py-2.5 pl-2 text-right">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${workloadStatusTokens[row.status]}`}>{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompanyHealthCards({
  items,
}: {
  items: Array<{ title: string; subtitle: string; icon: ReactNode; status: 'Healthy' | 'Attention'; footer: string }>;
}) {
  if (!items.length) return <div className="text-sm text-muted-foreground">No company health data available yet.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const healthy = item.status === 'Healthy';
        return (
          <div key={item.title} className="rounded-xl border border-border/60 bg-card px-3.5 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">{item.icon}</span>
              <span className="text-sm font-semibold text-foreground">{item.title}</span>
            </div>
            <div className={`mt-2.5 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${healthy ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>
              {healthy ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z" /></svg>
              )}
              {item.status}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{item.subtitle}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/80">{item.footer}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ActivityFeed({
  items,
  emptyLabel = 'No recent activity yet.',
  viewAllHref,
}: {
  items: Array<{ title: string; subtitle?: string; meta?: string; tone?: MetricTone; action?: ReactNode }>;
  emptyLabel?: string;
  viewAllHref?: string;
}) {
  if (!items.length) return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  return (
    <div>
      <div className="divide-y divide-border/50">
        {items.map((item) => {
          const tone = toneTokens[item.tone ?? 'cyan'];
          return (
            <div key={`${item.title}-${item.meta ?? ''}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tone.dot }} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {item.meta ? <span className="text-xs text-muted-foreground">{item.meta}</span> : null}
                    <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
                  </div>
                  {item.subtitle ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</div> : null}
                </div>
              </div>
              {item.action ? <div className="shrink-0">{item.action}</div> : null}
            </div>
          );
        })}
      </div>
      {viewAllHref ? (
        <a href={viewAllHref} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
          View all activity →
        </a>
      ) : null}
    </div>
  );
}

export function DotStatusList({ rows }: { rows: Array<{ label: string; overdue: number; dueSoon: number; onTime: number; totalLabel?: string }> }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground">No follow-up distribution available yet.</div>;
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_120px_28px] items-center gap-3">
          <div className="truncate text-[1.05rem] font-medium text-foreground">{row.label}</div>
          <div className="flex items-center gap-2">
            {Array.from({ length: row.overdue }).map((_, index) => <span key={`overdue-${index}`} className="h-4 w-4 rounded bg-rose-500" />)}
            {Array.from({ length: row.dueSoon }).map((_, index) => <span key={`due-${index}`} className="h-4 w-4 rounded bg-amber-500" />)}
            {Array.from({ length: row.onTime }).map((_, index) => <span key={`time-${index}`} className="h-4 w-4 rounded bg-emerald-500" />)}
          </div>
          <div className="text-right text-[1.05rem] font-semibold text-muted-foreground">{row.totalLabel ?? row.overdue + row.dueSoon + row.onTime}</div>
        </div>
      ))}
      <div className="flex flex-wrap gap-5 pt-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded bg-rose-500" />Overdue</span>
        <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded bg-amber-500" />Due soon</span>
        <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded bg-emerald-500" />On time</span>
      </div>
    </div>
  );
}
