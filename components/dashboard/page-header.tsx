import { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  secondaryDescription,
  actions,
  eyebrow,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  secondaryDescription?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={[
        'flex flex-col gap-5 border-b border-border/70 pb-6',
        'lg:flex-row lg:items-end lg:justify-between',
        className,
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-accent">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="max-w-4xl text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}

        {secondaryDescription ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground/80">
            {secondaryDescription}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-3 lg:pb-1">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
