import { ReactNode } from 'react';

export function StatePanel({
  children,
  tone = 'muted',
  padding = 16,
  title,
  description,
  icon,
  action,
  variant = 'default',
  className = '',
}: {
  children?: ReactNode;
  tone?: 'muted' | 'danger';
  padding?: number;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: 'default' | 'empty' | 'loading' | 'error';
  className?: string;
}) {
  const isDanger = tone === 'danger' || variant === 'error';

  return (
    <div
      className={[
        'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm',
        'flex flex-col items-center justify-center text-center',
        isDanger ? 'border-destructive/30 bg-destructive/5' : '',
        className,
      ].join(' ')}
      style={{ padding }}
    >
      {icon ? (
        <div
          className={[
            'mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border',
            isDanger
              ? 'border-destructive/25 bg-destructive/10 text-destructive'
              : 'border-border bg-muted/60 text-muted-foreground',
          ].join(' ')}
        >
          {icon}
        </div>
      ) : null}

      {title ? (
        <h3 className="text-base font-semibold tracking-[-0.015em] text-foreground">
          {title}
        </h3>
      ) : null}

      {description ? (
        <p
          className={[
            'mt-2 max-w-md text-sm leading-6',
            isDanger ? 'text-destructive' : 'text-muted-foreground',
          ].join(' ')}
        >
          {description}
        </p>
      ) : null}

      {children ? (
        <div className={title || description || icon ? 'mt-4 text-sm text-muted-foreground' : ''}>
          {children}
        </div>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
