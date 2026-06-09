import { ReactNode } from 'react';

type GradientVariant = 'cyan' | 'violet' | 'navy' | 'teal' | 'warning' | 'danger';

function DefaultMetricIcon({ variant }: { variant: GradientVariant }) {
  const toneClass =
    variant === 'warning'
      ? 'text-amber-500 dark:text-amber-300'
      : variant === 'danger'
        ? 'text-rose-500 dark:text-rose-300'
        : variant === 'violet'
          ? 'text-violet-500 dark:text-violet-300'
          : variant === 'navy'
            ? 'text-blue-600 dark:text-cyan-300'
            : variant === 'teal'
              ? 'text-teal-500 dark:text-cyan-300'
              : 'text-sky-500 dark:text-sky-300';

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 opacity-80 ${toneClass}`}
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
  return (
    <section className={`group rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition duration-150 hover:border-primary/15 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] ${compact ? 'p-3.5' : 'p-4'}`}>
      <div className={`flex flex-col justify-between ${compact ? 'min-h-[92px] gap-3' : 'min-h-[112px] gap-4'}`}>
        <div className="flex items-start justify-between gap-3">
          <p className={`pr-3 font-medium leading-5 text-foreground ${compact ? 'text-[14px]' : 'text-[15px]'}`}>
            {title}
          </p>
          <div className="shrink-0 pt-0.5 text-sky-500/75 dark:text-sky-300/75">
            {icon ?? <DefaultMetricIcon variant={variant} />}
          </div>
        </div>

        <div>
          <p className={`break-words font-bold leading-none tracking-[-0.06em] text-foreground ${compact ? 'text-[clamp(1.75rem,2.3vw,2.35rem)]' : 'text-[clamp(2rem,2.7vw,2.8rem)]'}`}>
            {value}
          </p>
          {hint ? (
            <p className={`text-muted-foreground ${compact ? 'mt-1 text-[13px] leading-4.5' : 'mt-1.5 text-sm leading-5'}`}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
