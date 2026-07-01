import { type ReactNode } from 'react';

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

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function AnalyticsPanel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-border/65 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.24)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AnalyticsMetricCard({ title, value, hint, trend, tone = 'cyan', sparkline }: { title: string; value: string; hint?: string; trend?: string | null; tone?: MetricTone; sparkline?: number[] }) {
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
    <div className="relative overflow-hidden rounded-[22px] border border-border/70 bg-card px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.24)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${tone === 'navy' ? 'bg-blue-500' : tone === 'cyan' ? 'bg-cyan-500' : tone === 'teal' ? 'bg-teal-500' : tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'rose' ? 'bg-rose-500' : tone === 'violet' ? 'bg-violet-500' : 'bg-slate-400'}`} />
      <div className="flex min-h-[116px] flex-col justify-between pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.95rem] font-medium text-muted-foreground">{title}</p>
          {trend ? (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${token.bg} ${token.text}`}>
              {trend}
            </span>
          ) : null}
        </div>
        <div>
          <div className="text-[clamp(1.9rem,2.4vw,2.6rem)] font-bold leading-none tracking-tight text-foreground">{value}</div>
          {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {sparkPath ? (
          <svg viewBox="0 0 84 30" className="mt-2 h-7 w-24 overflow-visible">
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

export function LineAreaChart({ points, series, height = 280, valueFormatter = defaultTickFormatter, emptyLabel = 'No chart data available yet.' }: { points: ChartPoint[]; series: ChartSeries[]; height?: number; valueFormatter?: (value: number) => string; emptyLabel?: string }) {
  if (!points.length || !series.length) return <EmptyChartState label={emptyLabel} />;

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
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full overflow-visible">
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

export function GroupedBarChart({ points, series, emptyLabel = 'No comparison data available yet.' }: { points: ChartPoint[]; series: ChartSeries[]; emptyLabel?: string }) {
  if (!points.length || !series.length) return <EmptyChartState label={emptyLabel} />;
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
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full overflow-visible">
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

export function StackedBarChart({ points, series, emptyLabel = 'No stacked breakdown available yet.' }: { points: ChartPoint[]; series: ChartSeries[]; emptyLabel?: string }) {
  if (!points.length || !series.length) return <EmptyChartState label={emptyLabel} />;
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
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full overflow-visible">
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

export function DonutChart({ segments, centerLabel, centerValue, emptyLabel = 'No split available yet.' }: { segments: Array<{ label: string; value: number; color: string; note?: string }>; centerLabel: string; centerValue: string; emptyLabel?: string }) {
  const visible = segments.filter((entry) => entry.value > 0);
  const total = visible.reduce((sum, entry) => sum + entry.value, 0);
  if (!visible.length || total <= 0) return <EmptyChartState label={emptyLabel} />;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let running = 0;

  return (
    <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
      <div className="relative mx-auto h-[200px] w-[200px]">
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
            <div className="text-[2rem] font-bold leading-none tracking-tight text-foreground">{centerValue}</div>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{centerLabel}</div>
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

export function RankedProgressList({ items, emptyLabel = 'No ranked data available yet.' }: { items: ProgressItem[]; emptyLabel?: string }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={item.label} className="grid grid-cols-[24px_minmax(0,1fr)_88px] items-center gap-3">
          <div className="text-lg font-semibold text-muted-foreground/70">{index + 1}</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-medium text-foreground">{item.label}</div>
                {item.sublabel ? <div className="truncate text-xs text-muted-foreground">{item.sublabel}</div> : null}
              </div>
              <div className="shrink-0 text-sm font-semibold text-muted-foreground">{item.displayValue ?? item.value.toLocaleString('en-IN')}</div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted/50">
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

export function GaugeGrid({ items }: { items: GaugeItem[] }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">No team lead insight available yet.</div>;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => {
        const tone = toneTokens[item.tone ?? 'cyan'];
        const circumference = 2 * Math.PI * 42;
        const arc = circumference * Math.max(0, Math.min(1, item.value));
        return (
          <div key={item.label} className="rounded-[22px] border border-border/60 px-4 py-5 text-center">
            <div className="text-[1.05rem] font-semibold text-foreground">{item.label}</div>
            {item.subtitle ? <div className="mt-1 text-sm text-muted-foreground">{item.subtitle}</div> : null}
            <div className="relative mx-auto mt-5 h-[132px] w-[132px]">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="10" />
                <circle cx="60" cy="60" r="42" fill="none" stroke={tone.dot} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} ${circumference - arc}`} />
              </svg>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-[2rem] font-bold leading-none tracking-tight text-foreground">{Math.round(item.value * 100)}%</div>
                  <div className="mt-1 text-sm text-muted-foreground">complete</div>
                </div>
              </div>
            </div>
            {item.detail ? <div className="mt-4 text-sm font-medium text-muted-foreground">{item.detail}</div> : null}
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

export function WorkflowBars({ rows }: { rows: Array<{ label: string; value: number; tone?: MetricTone; note?: string }> }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground">No workflow data available yet.</div>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="grid gap-4">
      {rows.map((row) => {
        const tone = toneTokens[row.tone ?? 'navy'];
        return (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="text-[1.05rem] font-medium text-foreground">{row.label}</div>
              <div className="text-[1.05rem] font-semibold text-muted-foreground">{row.value}</div>
            </div>
            <div className="h-10 overflow-hidden rounded-2xl bg-muted/30">
              <div className="flex h-full items-center rounded-2xl px-4 text-base font-semibold text-white" style={{ width: `${clampPercent((row.value / max) * 100)}%`, backgroundColor: tone.dot }}>
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
