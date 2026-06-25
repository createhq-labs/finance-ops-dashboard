"use client";

import type { CSSProperties } from 'react';

type LoaderVariant = 'fullscreen' | 'section' | 'inline';
type LoaderSize = 'sm' | 'md' | 'lg' | 'xl';

type WorkspaceLoaderProps = {
  variant?: LoaderVariant;
  size?: LoaderSize;
  label?: string;
  description?: string;
  className?: string;
};

const DEFAULT_LABELS: Record<LoaderVariant, string> = {
  fullscreen: 'Preparing your workspace',
  section: 'Loading...',
  inline: 'Loading...',
};

const DEFAULT_DESCRIPTIONS: Record<LoaderVariant, string | undefined> = {
  fullscreen: 'Checking session and loading dashboard access...',
  section: undefined,
  inline: undefined,
};

const SIZE_CONFIG: Record<LoaderSize, { size: number; border: number }> = {
  sm:  { size: 32,  border: 3  },
  md:  { size: 68,  border: 7  },
  lg:  { size: 96,  border: 9  },
  xl:  { size: 116, border: 11 },
};

function LoaderGlyph({ sizeName }: { sizeName: LoaderSize }) {
  const { size, border } = SIZE_CONFIG[sizeName];
  return (
    <div
      className="ws-loader-wrap"
      style={{ '--ws-size': `${size}px`, '--ws-border': `${border}px` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="ws-loader" />
    </div>
  );
}

export function WorkspaceLoader({
  variant = 'fullscreen',
  size,
  label,
  description,
  className = '',
}: WorkspaceLoaderProps) {
  const resolvedSize: LoaderSize = size ?? (variant === 'fullscreen' ? 'xl' : variant === 'section' ? 'lg' : 'sm');
  const resolvedLabel = label ?? DEFAULT_LABELS[variant];
  const resolvedDescription = description ?? DEFAULT_DESCRIPTIONS[variant];

  if (variant === 'inline') {
    return (
      <div className={['inline-flex items-center gap-2.5 text-sm text-muted-foreground', className].join(' ')}>
        <LoaderGlyph sizeName={resolvedSize} />
        <span className="font-medium text-foreground/80">{resolvedLabel}</span>
      </div>
    );
  }

  const isFullscreen = variant === 'fullscreen';

  return (
    <div
      role="status"
      aria-label={resolvedLabel}
      className={[
        'flex items-center justify-center bg-app px-6',
        isFullscreen ? 'min-h-screen' : 'min-h-[220px]',
        className,
      ].join(' ')}
    >
      <div className={['flex flex-col items-center gap-5 text-center', isFullscreen ? 'max-w-[300px]' : 'max-w-[260px]'].join(' ')}>
        <LoaderGlyph sizeName={resolvedSize} />

        <div className="grid gap-1.5">
          <p className={['font-semibold tracking-tight text-foreground', isFullscreen ? 'text-lg' : 'text-sm'].join(' ')}>
            {resolvedLabel}
          </p>
          {resolvedDescription ? (
            <p className={['text-muted-foreground', isFullscreen ? 'text-sm' : 'text-xs leading-5'].join(' ')}>
              {resolvedDescription}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const AppLoader = WorkspaceLoader;
