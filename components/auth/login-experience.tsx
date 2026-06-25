"use client";

import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BriefcaseBusiness, FilePlus, ListChecks } from 'lucide-react';
import Lightfall from '../brand/lightfall';
import { CompanyLogo } from '../layout/company-logo';

const EASE = [0.16, 1, 0.3, 1] as const;

const FEATURES = [
  { icon: FilePlus,          label: 'Invoice Intake',    bg: 'bg-sky-400/15',     border: 'border-sky-400/35',     text: 'text-sky-200',     iconCls: 'text-sky-400'     },
  { icon: BriefcaseBusiness, label: 'Finance Review',    bg: 'bg-violet-400/15',  border: 'border-violet-400/35',  text: 'text-violet-200',  iconCls: 'text-violet-400'  },
  { icon: ListChecks,        label: 'Approval Tracking', bg: 'bg-emerald-400/15', border: 'border-emerald-400/35', text: 'text-emerald-200', iconCls: 'text-emerald-400' },
];

export function LoginExperience({ children }: { children: ReactNode }) {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashDone(true), 1080);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <Lightfall
          colors={['#60C8FF', '#3B6FFF', '#5EE7FF', '#A78BFA']}
          backgroundColor="#050e24"
          speed={0.38}
          streakCount={4}
          streakWidth={1.1}
          streakLength={1.5}
          glow={0.85}
          density={0.32}
          twinkle={0.8}
          zoom={2.8}
          backgroundGlow={0.32}
          opacity={0.4}
          mouseInteraction={false}
        />
      </div>

      <AnimatePresence>
        {!splashDone ? (
          <motion.div
            key="login-splash"
            className="absolute inset-0 z-50 grid place-items-center bg-slate-950"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.86, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.95, ease: EASE }}
            >
              <CompanyLogo tone="light" size="xl" showText={false} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {splashDone ? (
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10 sm:px-8 lg:px-16">
          <div className="grid w-full max-w-[1000px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">

            <motion.section
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
            >
              <CompanyLogo tone="light" size="lg" showText={false} />

              <div className="mt-7 flex flex-col items-center gap-5">
                <h1
                  style={{
                    color: '#ffffff',
                    fontSize: 'clamp(2.1rem, 4vw, 3rem)',
                    fontWeight: 800,
                    lineHeight: 1.06,
                    letterSpacing: '-0.023em',
                    textShadow: '0 2px 24px rgba(96,165,250,0.18)',
                  }}
                >
                  Finance Operations
                </h1>
                <p className="max-w-sm text-base leading-7 text-white/75 sm:text-lg">
                  Unified workspace for invoice intake, finance review, approvals, and team workflows.
                </p>

                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  {FEATURES.map(({ icon: Icon, label, bg, border, text, iconCls }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm ${bg} ${border} ${text}`}
                    >
                      <Icon size={11} className={`shrink-0 ${iconCls}`} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              className="w-full"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.16 }}
            >
              <div
                className="login-card relative w-full overflow-hidden rounded-[28px] border border-white/[0.18] p-7 backdrop-blur-2xl sm:p-8"
                style={{
                  background: 'linear-gradient(145deg, rgba(124,48,228,0.32) 0%, rgba(67,44,190,0.22) 42%, rgba(10,18,76,0.42) 100%)',
                  boxShadow: '0 32px 80px -20px rgba(4,10,40,0.85), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 40px rgba(120,80,255,0.06)',
                }}
              >
                {/* Glass top-rim light catch */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                {/* Glass surface sheen — diagonal reflection */}
                <div className="pointer-events-none absolute -left-8 -top-8 h-48 w-48 rounded-full bg-white/[0.04] blur-2xl" />

                <div className="relative mb-6">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
                    Secure sign in
                  </p>
                  <h2
                    style={{
                      color: '#ffffff',
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      lineHeight: 1.2,
                      letterSpacing: '-0.02em',
                      marginTop: '0.5rem',
                    }}
                  >
                    Welcome back
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/65">
                    Use your provisioned <strong>@create.wtf</strong> account to continue.
                  </p>
                </div>

                <div className="relative">
                  {children}
                </div>

                <p className="relative mt-5 text-center text-xs leading-5 text-white/50">
                  No public signup. Contact admin to provision access.
                </p>
              </div>
            </motion.section>

          </div>
        </div>
      ) : null}
    </main>
  );
}
