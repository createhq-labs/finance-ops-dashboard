import { ReactNode } from 'react';

type GradientVariant = 'cyan' | 'violet' | 'navy' | 'teal' | 'warning' | 'danger';

// ─── Variant Tokens ───────────────────────────────────────────────────────────

const variantTokens: Record<
  GradientVariant,
  {
    accent: string;
    iconBg: string;
    iconRing: string;
    iconColor: string;
  }
> = {
  cyan: {
    accent:    'bg-sky-400 dark:bg-sky-500',
    iconBg:    'bg-sky-50 dark:bg-sky-500/[0.12]',
    iconRing:  'group-hover:ring-sky-200 dark:group-hover:ring-sky-500/30',
    iconColor: 'text-sky-500 dark:text-sky-400',
  },
  violet: {
    accent:    'bg-violet-400 dark:bg-violet-500',
    iconBg:    'bg-violet-50 dark:bg-violet-500/[0.12]',
    iconRing:  'group-hover:ring-violet-200 dark:group-hover:ring-violet-500/30',
    iconColor: 'text-violet-500 dark:text-violet-400',
  },
  navy: {
    accent:    'bg-blue-500 dark:bg-blue-400',
    iconBg:    'bg-blue-50 dark:bg-blue-500/[0.12]',
    iconRing:  'group-hover:ring-blue-200 dark:group-hover:ring-blue-500/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  teal: {
    accent:    'bg-teal-400 dark:bg-teal-500',
    iconBg:    'bg-teal-50 dark:bg-teal-500/[0.12]',
    iconRing:  'group-hover:ring-teal-200 dark:group-hover:ring-teal-500/30',
    iconColor: 'text-teal-500 dark:text-teal-400',
  },
  warning: {
    accent:    'bg-amber-400 dark:bg-amber-400',
    iconBg:    'bg-amber-50 dark:bg-amber-500/[0.12]',
    iconRing:  'group-hover:ring-amber-200 dark:group-hover:ring-amber-500/30',
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
  danger: {
    accent:    'bg-rose-400 dark:bg-rose-500',
    iconBg:    'bg-rose-50 dark:bg-rose-500/[0.12]',
    iconRing:  'group-hover:ring-rose-200 dark:group-hover:ring-rose-500/30',
    iconColor: 'text-rose-500 dark:text-rose-400',
  },
};

// ─── Default Icon ─────────────────────────────────────────────────────────────

function DefaultMetricIcon({ variant }: { variant: GradientVariant }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-[18px] w-[18px] ${variantTokens[variant].iconColor}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-3" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export function KpiCard({
  title,
  value,
  hint,
  variant = 'cyan',
  icon,
  compact = false,
}: {
  title: string;
  value: string;
  hint?: ReactNode;
  variant?: GradientVariant;
  icon?: ReactNode;
  compact?: boolean;
}) {
  const tokens = variantTokens[variant];

  return (
    <section
      className={[
        'group relative overflow-hidden rounded-xl',
        'bg-card border border-border/60',
        'shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)]',
        'dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-0.5',
        'hover:shadow-[0_8px_20px_rgba(15,23,42,0.09),0_2px_6px_rgba(15,23,42,0.05)]',
        'dark:hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)]',
        'hover:border-border/90',
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3',
      ].join(' ')}
    >
      {/* Left accent bar */}
      <div
        aria-hidden="true"
        className={[
          'absolute inset-y-0 left-0 w-[3px]',
          tokens.accent,
          'opacity-70 group-hover:opacity-100',
          'transition-opacity duration-200',
        ].join(' ')}
      />

      {/* Content */}
      <div className={`flex flex-col pl-2 ${compact ? 'gap-2' : 'gap-2.5'}`}>

        {/* Title + Icon row */}
        <div className="flex items-start justify-between gap-3">
          <p
            className={[
              'font-medium leading-snug text-muted-foreground',
              compact ? 'text-[13px]' : 'text-[13.5px]',
            ].join(' ')}
          >
            {title}
          </p>

          {/* Premium icon container */}
          <div
            aria-hidden="true"
            className={[
              'shrink-0 flex items-center justify-center rounded-lg',
              tokens.iconBg,
              'ring-1 ring-inset ring-transparent',
              'transition-all duration-200',
              tokens.iconRing,
              compact ? 'h-7 w-7' : 'h-8 w-8',
            ].join(' ')}
          >
            <span className="transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-px flex items-center justify-center">
              {icon ?? <DefaultMetricIcon variant={variant} />}
            </span>
          </div>
        </div>

        {/* Value + hint */}
        <div>
          <p
            className={[
              'tabular-nums font-bold leading-none tracking-tight text-foreground',
              'transition-colors duration-200',
              compact
                ? 'text-[clamp(1.65rem,2.1vw,2.15rem)]'
                : 'text-[clamp(1.9rem,2.5vw,2.55rem)]',
            ].join(' ')}
          >
            {value}
          </p>

          {hint ? (
            <p
              className={[
                'text-muted-foreground/75 leading-snug',
                compact ? 'mt-0.5 text-[11.5px]' : 'mt-1 text-[12.5px]',
              ].join(' ')}
            >
              {hint}
            </p>
          ) : null}
        </div>

      </div>
    </section>
  );
}