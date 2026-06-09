import { ReactNode } from 'react';

export function SectionCard({
  title,
  description,
  children,
  padding = 16,
  actions,
  className = '',
  contentClassName = '',
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  padding?: number;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={[
        'overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm',
        'dark:border-border/80',
        className,
      ].join(' ')}
    >
      {(title || description || actions) ? (
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 className="text-base font-semibold tracking-[-0.015em] text-foreground">
                {title}
              </h2>
            ) : null}

            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={contentClassName} style={{ padding }}>
        {children}
      </div>
    </section>
  );
}
