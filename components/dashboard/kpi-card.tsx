import { ReactNode } from 'react';

type GradientVariant = 'cyan' | 'violet' | 'navy' | 'teal' | 'warning' | 'danger';

const variantStyles: Record<GradientVariant, string> = {
  cyan: 'from-sky-500 via-cyan-400 to-blue-600',
  violet: 'from-indigo-500 via-violet-500 to-fuchsia-500',
  navy: 'from-slate-900 via-blue-950 to-cyan-700',
  teal: 'from-teal-500 via-cyan-500 to-sky-600',
  warning: 'from-amber-400 via-orange-500 to-rose-500',
  danger: 'from-rose-500 via-pink-500 to-orange-400',
};

export function KpiCard({
  title,
  value,
  hint,
  variant = 'cyan',
  icon,
}: {
  title: string;
  value: string;
  hint?: ReactNode;
  variant?: GradientVariant;
  icon?: ReactNode;
}) {
  return (
    <section className="group relative overflow-hidden rounded-2xl p-[2px]">
      <div
        className={[
          'kpi-border-a absolute inset-[-62%] opacity-0 transition duration-500 group-hover:opacity-100',
          'bg-[conic-gradient(from_0deg,transparent_0deg,transparent_76deg,#33ffff_92deg,#00b3b3_104deg,transparent_118deg,transparent_360deg)]'
        ].join(' ')}
      />

      <div
        className={[
          'relative min-h-[150px] overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-sm transition duration-500 group-hover:-translate-y-1.5 group-hover:rotate-[-0.6deg] group-hover:shadow-[0_18px_38px_rgba(8,15,40,0.28)] group-hover:brightness-[1.08] group-hover:bg-[position:62%_50%]',
          variantStyles[variant],
        ].join(' ')}
        style={{ backgroundSize: '140% 140%' }}
      >
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/25 transition duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
        <div className="absolute -bottom-14 left-8 h-40 w-40 rounded-full bg-white/12 transition duration-500 group-hover:-translate-x-1 group-hover:translate-y-1" />

        <div className="relative flex h-full min-h-[102px] flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <p className="pr-2 text-xs font-bold uppercase tracking-[0.22em] text-white/90">
              {title}
            </p>

            {icon ? (
              <div className="shrink-0 rounded-xl bg-white/15 p-2 text-white/95 transition duration-300 group-hover:rotate-[5deg]">
                {icon}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 max-w-full">
            <p
              className="origin-left whitespace-nowrap text-[clamp(1.8rem,2.7vw,3rem)] font-extrabold leading-none tracking-[-0.09em] text-white drop-shadow-sm transition duration-300 group-hover:scale-[1.08] sm:group-hover:scale-110"
              style={{ maxWidth: '100%' }}
            >
              {value}
            </p>

            {hint ? (
              <p className="mt-2 text-sm leading-6 text-white/85">
                {hint}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <style jsx>{`
        .kpi-border-a {
          animation: none;
        }

        .group:hover .kpi-border-a {
          animation: kpiOrbit 1.8s linear infinite;
        }

        @keyframes kpiOrbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </section>
  );
}
