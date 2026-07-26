"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cloud, Lock, ShieldCheck } from 'lucide-react';
import { CompanyLogo } from '../layout/company-logo';

const EASE = [0.16, 1, 0.3, 1] as const;

const CHART_VALUES = [
 4, 9, 19, 32, 21, 31, 60, 57, 77,
  68, 77, 94, 81, 96, 101, 120, 144, 159,
];

const LINE_VALUES = [
  9, 17, 31, 47, 33, 51, 75, 66, 90,
  80, 91, 106, 94, 108, 113, 132, 157, 176,
];
const CHART_WIDTH = 900;
const CHART_HEIGHT = 450;
const BAR_WIDTH = 33;
const BASELINE_Y = CHART_HEIGHT;
const AXIS_Y = BASELINE_Y + 7;
const CHART_MAX = 242;

const BAR_GAP = 18;
const GRAPH_WIDTH = CHART_VALUES.length * BAR_WIDTH + (CHART_VALUES.length - 1) * BAR_GAP;
const GRAPH_LEFT = (CHART_WIDTH - GRAPH_WIDTH) / 2;

const LINE_OFFSET = 4;
const CHART_DRAW_HEIGHT = CHART_HEIGHT - LINE_OFFSET - 12;

const BARS = CHART_VALUES.map((value, index) => {
  const height = (value / CHART_MAX) * CHART_DRAW_HEIGHT;
  const lineHeight = (LINE_VALUES[index] / CHART_MAX) * CHART_DRAW_HEIGHT;
  const x = GRAPH_LEFT + index * (BAR_WIDTH + BAR_GAP);
  const y = BASELINE_Y - height;
  return { x, y, width: BAR_WIDTH, height, cx: x + BAR_WIDTH / 2, lineY: BASELINE_Y - lineHeight - LINE_OFFSET };
});

const LAST_BAR = BARS[BARS.length - 1];
const PREVIOUS_BAR = BARS[BARS.length - 2];
const ARROW_TIP_X = LAST_BAR.cx;
const ARROW_TIP_Y = LAST_BAR.lineY;
const ARROW_ANGLE =
  (Math.atan2(LAST_BAR.lineY - PREVIOUS_BAR.lineY, LAST_BAR.cx - PREVIOUS_BAR.cx) * 180) / Math.PI;

const MAIN_LINE_POINTS = BARS.map((bar) => `${bar.cx},${bar.lineY}`).join(' ');
const getPointDistance = (from: { cx: number; lineY: number }, to: { cx: number; lineY: number }) =>
  Math.hypot(to.cx - from.cx, to.lineY - from.lineY);
const CHART_POINT_LENGTHS = BARS.reduce<number[]>((lengths, bar, index) => {
  if (index === 0) {
    return [0];
  }

  return [...lengths, lengths[index - 1] + getPointDistance(BARS[index - 1], bar)];
}, []);
const CHART_TOTAL_LINE_LENGTH = CHART_POINT_LENGTHS[CHART_POINT_LENGTHS.length - 1] || 1;
const CHART_CONTAINER_FADE_DURATION_MS = 200;
const CHART_CONTAINER_FADE_DELAY_MS = 550;
const CHART_LINE_DASH_LENGTH = Math.ceil(CHART_TOTAL_LINE_LENGTH) + 2;
const CHART_LINE_DURATION_MS = 1200;
const CHART_BAR_GROW_DURATION_MS = 380;
const CHART_CAP_REVEAL_DURATION_MS = 200;
const CHART_DOT_POP_DURATION_MS = 200;
const CHART_ARROW_HEAD_DURATION_MS = CHART_DOT_POP_DURATION_MS;
const CHART_PULSE_DURATION_MS = 2000;
const CHART_SPARK_DURATION_MS = 2600;
const CHART_LINE_START_DELAY_MS = CHART_CONTAINER_FADE_DELAY_MS + CHART_CONTAINER_FADE_DURATION_MS;
const CHART_LINE_END_DELAY_MS = CHART_LINE_START_DELAY_MS + CHART_LINE_DURATION_MS;
const CHART_ARROW_HEAD_DELAY_MS = CHART_LINE_END_DELAY_MS;
const CHART_PULSE_START_DELAY_MS = CHART_ARROW_HEAD_DELAY_MS + CHART_ARROW_HEAD_DURATION_MS;
const CHART_SPARK_DELAY_MS = CHART_PULSE_START_DELAY_MS + 350;
const getChartDotDelay = (index: number) =>
  CHART_LINE_START_DELAY_MS +
  ((CHART_POINT_LENGTHS[index] ?? CHART_TOTAL_LINE_LENGTH) / CHART_TOTAL_LINE_LENGTH) * CHART_LINE_DURATION_MS;
const getChartBarDelay = (index: number) =>
  Math.max(CHART_LINE_START_DELAY_MS, getChartDotDelay(index) - CHART_BAR_GROW_DURATION_MS);

const BADGES = [
  { icon: ShieldCheck, label: 'Authentication Ready', sublabel: 'Verified & Secure' },
  { icon: Lock, label: 'Enterprise Security', sublabel: 'Protected Workspace' },
  { icon: Cloud, label: 'Production Environment', sublabel: 'Systems Operational' },
];

export function LoginExperience({ children }: { children: ReactNode }) {
  const [splashPhase, setSplashPhase] = useState<'intro' | 'fly' | 'done'>('intro');
  const [splashTarget, setSplashTarget] = useState({ x: 0, y: 0, scale: 1 });
  const loginLogoRef = useRef<HTMLDivElement>(null);
  const splashLogoRef = useRef<HTMLDivElement>(null);
  const splashDone = splashPhase === 'done';

  useEffect(() => {
    let frameId = 0;

    const updateSplashTarget = () => {
      const targetRect = loginLogoRef.current?.getBoundingClientRect();
      const splashRect = splashLogoRef.current?.getBoundingClientRect();

      if (!targetRect) {
        return;
      }

      setSplashTarget({
        x: targetRect.left + targetRect.width / 2 - window.innerWidth / 2,
        y: targetRect.top + targetRect.height / 2 - window.innerHeight / 2,
        scale: splashRect?.width ? targetRect.width / splashRect.width : 1,
      });
    };

    const scheduleSplashTargetUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateSplashTarget);
    };

    scheduleSplashTargetUpdate();
    window.addEventListener('resize', scheduleSplashTargetUpdate);

    const flyTimer = window.setTimeout(() => {
      updateSplashTarget();
      setSplashPhase('fly');
    }, 900);
    const doneTimer = window.setTimeout(() => setSplashPhase('done'), 1850);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(flyTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener('resize', scheduleSplashTargetUpdate);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {!splashDone ? (
          <motion.div
            key="login-splash"
            className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              background: '#000000',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
          >
            <motion.div
              ref={splashLogoRef}
              initial={{ opacity: 0, scale: 0.86, y: 8 }}
              animate={
                splashPhase === 'fly'
                  ? {
                      opacity: 1,
                      scale: splashTarget.scale,
                      x: splashTarget.x,
                      y: splashTarget.y,
                      rotate: -360,
                    }
                  : { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }
              }
              transition={
                splashPhase === 'fly'
                  ? { duration: 0.9, ease: EASE }
                  : { duration: 0.65, ease: EASE }
              }
            >
              <CompanyLogo tone="light" size="xl" showText={false} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

        <main
          className={`login-root ${splashDone ? 'is-ready' : 'is-preparing'}`}
          style={{
            position: 'relative',
            display: 'flex',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            background: '#000000',
            opacity: splashDone ? 1 : 0,
          }}
        >
          <div className="login-left">
            <div className="login-left-glow" />

            <div className="login-left-content">
              <div ref={loginLogoRef} className="login-anim login-logo">
                <CompanyLogo tone="light" size="xl" showText={false} />
              </div>

              <div className="login-title-block">
                <h1 className="login-anim login-title">
                  <span className="login-title-word login-title-white">Finance</span>
                  <span className="login-title-word login-title-gradient">Dashboard</span>
                </h1>
                <div className="login-anim login-divider-wrap">
                  <span className="login-divider-diamond">&#9670;</span>
                  <div className="login-divider-line" />
                </div>
              </div>

              <div className="login-anim login-chart-container">
                <p className="login-tagline">Internal Financial Command Center</p>
                <svg
                  className="login-chart-svg"
                  viewBox={`-52 154 ${CHART_WIDTH + 82} ${CHART_HEIGHT - 130}`}
                  width="100%"
                  height="280"
                  preserveAspectRatio="xMidYMax meet"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0059ff" stopOpacity="0.52" />
                      <stop offset="34%" stopColor="#0056b3" stopOpacity="0.42" />
                      <stop offset="70%" stopColor="#1212a3" stopOpacity="0.26" />
                      <stop offset="100%" stopColor="#081239" stopOpacity="0.06" />
                    </linearGradient>
                    <linearGradient id="barGlassEdge" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.16" />
                      <stop offset="18%" stopColor="#06ddf9" stopOpacity="0.34" />
                      <stop offset="46%" stopColor="#38bdf8" stopOpacity="0.08" />
                      <stop offset="78%" stopColor="#0bacfd" stopOpacity="0.03" />
                      <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="axisGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0918ed" stopOpacity="0" />
                      <stop offset="18%" stopColor="#0835f9" stopOpacity="0.18" />
                      <stop offset="50%" stopColor="#1e0afc" stopOpacity="0.72" />
                      <stop offset="82%" stopColor="#0606f6" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#020009" stopOpacity="0" />
                    </linearGradient>
                    <filter
                      id="lineGlow"
                      x="-20%"
                      y="-30%"
                      width="140%"
                      height="160%"
                      colorInterpolationFilters="sRGB"
                    >
                      <feGaussianBlur stdDeviation="2.4" result="blur" />
                      <feFlood floodColor="#22d3ee" floodOpacity="0.48" result="color" />
                      <feComposite in="color" in2="blur" operator="in" result="glow" />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter
                      id="dotGlow"
                      x="-180%"
                      y="-180%"
                      width="460%"
                      height="460%"
                      colorInterpolationFilters="sRGB"
                    >
                      <feGaussianBlur stdDeviation="2.6" result="blur" />
                      <feFlood floodColor="#22d3ee" floodOpacity="0.68" result="color" />
                      <feComposite in="color" in2="blur" operator="in" result="glow" />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter
                      id="barGlow"
                      x="-60%"
                      y="-20%"
                      width="220%"
                      height="140%"
                      colorInterpolationFilters="sRGB"
                    >
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feFlood floodColor="#0891b2" floodOpacity="0.24" result="color" />
                      <feComposite in="color" in2="blur" operator="in" result="glow" />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <line
                    x1={BARS[0].x - 90}
                    y1={BASELINE_Y}
                    x2={LAST_BAR.x + BAR_WIDTH + 90}
                    y2={BASELINE_Y}
                    stroke="url(#axisGradient)"
                    strokeWidth={1.3}
                    strokeLinecap="round"
                  />
                  <line
                    x1={CHART_WIDTH / 2 - 470}
                    y1={BASELINE_Y}
                    x2={CHART_WIDTH / 2 + 470}
                    y2={BASELINE_Y}
                    stroke="#38bdf8"
                    strokeOpacity={0.72}
                    strokeWidth={1.55}
                    strokeLinecap="round"
                  />

                  {BARS.map((bar, index) => (
                    <g
                      key={`bar-${index}`}
                      className="login-chart-bar-hover"
                      style={{
                        transformBox: 'view-box',
                        transformOrigin: `${bar.cx}px ${BASELINE_Y}px`,
                      } as CSSProperties}
                    >
                      <g
                        className={`login-chart-bar login-chart-bar-${index}`}
                        filter="url(#barGlow)"
                        style={{
                          '--chart-point-delay': `${getChartBarDelay(index)}ms`,
                          opacity: 0,
                          transform: 'scaleY(0)',
                          transformBox: 'view-box',
                          transformOrigin: `${bar.cx}px ${BASELINE_Y}px`,
                        } as CSSProperties}
                      >
                        <rect
                          className="login-chart-bar-fill login-chart-bar-rect"
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          rx={1}
                          fill="url(#barGradient)"
                        />
                        <line
                          x1={bar.x}
                          y1={bar.y + 1}
                          x2={bar.x}
                          y2={BASELINE_Y}
                          stroke="#1fcbf7"
                          strokeOpacity={0.98}
                          strokeWidth={1.5}
                        />
                        <line
                          x1={bar.x + bar.width}
                          y1={bar.y + 1}
                          x2={bar.x + bar.width}
                          y2={BASELINE_Y}
                          stroke="#1fcbf7"
                          strokeOpacity={0.98}
                          strokeWidth={1.5}
                        />
                        <rect
                          x={bar.x + 1}
                          y={bar.y + 1}
                          width={Math.max(bar.width * 0.28, 1)}
                          height={Math.max(bar.height - 2, 0)}
                          rx={0.5}
                          fill="url(#barGlassEdge)"
                        />
                        <line
                          className={`login-chart-bar-cap login-chart-bar-cap-${index}`}
                          x1={bar.x}
                          y1={bar.y + 0.75}
                          x2={bar.x + bar.width}
                          y2={bar.y + 0.75}
                          stroke="#67e8f9"
                          strokeOpacity={0.78}
                          strokeWidth={1.5}
                          style={{
                            '--chart-point-delay': `${getChartDotDelay(index)}ms`,
                          } as CSSProperties}
                        />
                      </g>
                    </g>
                  ))}

                  <polyline
                    className="login-chart-line"
                    points={MAIN_LINE_POINTS}
                    fill="none"
                    stroke="#0f42fa"
                    strokeOpacity={0.98}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: CHART_LINE_DASH_LENGTH,
                      strokeDashoffset: CHART_LINE_DASH_LENGTH,
                    }}
                  />
                  <polyline
                    className="login-chart-line"
                    points={MAIN_LINE_POINTS}
                    fill="none"
                    stroke="#22d3ee"
                    strokeOpacity={0.98}
                    strokeWidth={1.55}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: CHART_LINE_DASH_LENGTH,
                      strokeDashoffset: CHART_LINE_DASH_LENGTH,
                    }}
                  />
                  <polyline
                    className="login-chart-line-spark"
                    points={MAIN_LINE_POINTS}
                    fill="none"
                    stroke="#e0faff"
                    strokeOpacity={0}
                    strokeWidth={3.2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter="url(#lineGlow)"
                    style={{
                      strokeDasharray: `42 ${CHART_LINE_DASH_LENGTH}`,
                      strokeDashoffset: CHART_LINE_DASH_LENGTH,
                    }}
                  />

                  <g
                    className="login-chart-arrow-head"
                    transform={`translate(${ARROW_TIP_X},${ARROW_TIP_Y}) rotate(${ARROW_ANGLE})`}
                    style={{ opacity: 0 }}
                  >
                    <path
                      d="M 0 0 L -14 -8 L -14 8 Z"
                      fill="#67e8f9"
                      stroke="#67e8f9"
                      strokeWidth={1}
                      strokeLinejoin="round"
                    />
                  </g>

                  {BARS.slice(0, -1).map((bar, index) => (
                    <g
                      key={`dot-${index}`}
                      className={`login-chart-dot login-chart-dot-${index}`}
                      style={{
                        '--chart-point-delay': `${getChartDotDelay(index)}ms`,
                        '--chart-pulse-delay': `${CHART_PULSE_START_DELAY_MS}ms`,
                        opacity: 0,
                        transform: 'scale(0)',
                        transformBox: 'view-box',
                        transformOrigin: `${bar.cx}px ${bar.lineY}px`,
                      } as CSSProperties}
                    >
                      <circle cx={bar.cx} cy={bar.lineY} r={5} fill="#22d3ee" />
                      <circle cx={bar.cx} cy={bar.lineY} r={2} fill="#cffafe" />
                    </g>
                  ))}
                </svg>
              </div>

              <div className="login-badges">
                {BADGES.map(({ icon: Icon, label, sublabel }, index) => (
                  <div key={label} className={`login-anim login-badge login-badge-${index}`}>
                    <Icon className="login-badge-icon" color="#06b6d4" strokeWidth={2} />
                    <div className="login-badge-copy">
                      <span className="login-badge-label">{label}</span>
                      <span className="login-badge-sublabel">{sublabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="login-right">
            <div className="login-anim login-card">
              <div className="login-card-lock">
                <svg
                  className="login-card-hex"
                  width="80"
                  height="88"
                  viewBox="0 0 88 96"
                  fill="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="login-hex-hover-gradient"
                      gradientUnits="userSpaceOnUse"
                      x1="8"
                      y1="5"
                      x2="80"
                      y2="88"
                    >
                      <stop offset="0%" stopColor="#bae6fd" />
                      <stop offset="22%" stopColor="#67e8f9" />
                      <stop offset="44%" stopColor="#38bdf8" />
                      <stop offset="66%" stopColor="#6366f1" />
                      <stop offset="84%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#bae6fd" />
                      <animateTransform
                        attributeName="gradientTransform"
                        type="rotate"
                        from="0 44 48"
                        to="360 44 48"
                        dur="3000ms"
                        repeatCount="indefinite"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    className="login-hex-fill"
                    d="M44 5 Q48 5 52 8 L76 22 Q80 25 80 30 L80 66 Q80 71 76 74 L52 88 Q44 93 36 88 L12 74 Q8 71 8 66 L8 30 Q8 25 12 22 L36 8 Q40 5 44 5 Z"
                    fill="rgba(34,211,238,0.06)"
                    stroke="none"
                  />
                  <path
                    id="login-hex-path"
                    className="login-hex-stroke"
                    d="M44 5 Q48 5 52 8 L76 22 Q80 25 80 30 L80 66 Q80 71 76 74 L52 88 Q44 93 36 88 L12 74 Q8 71 8 66 L8 30 Q8 25 12 22 L36 8 Q40 5 44 5 Z"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  <path
                    d="M32 43 V36 C32 29 37 24 44 24 C51 24 56 29 56 36 V43"
                    stroke="#22d3ee"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <rect
                    x="29"
                    y="42"
                    width="30"
                    height="25"
                    rx="4"
                    fill="rgba(34,211,238,0.06)"
                    stroke="#22d3ee"
                    strokeWidth={2.6}
                  />
                  <circle cx="44" cy="53" r="2.5" fill="#22d3ee" />
                  <path d="M44 55 V61" stroke="#22d3ee" strokeWidth={1.8} strokeLinecap="round" />
                </svg>
              </div>

              <p className="login-card-eyebrow">Secure sign in</p>
              <h2 className="login-card-title">Welcome back</h2>
              <p className="login-card-subtitle">
                Use your provisioned{' '}
                <span className="login-card-subtitle-accent">@create.wtf</span>{' '}
                account to continue.
              </p>

              {children}

              <p className="login-card-footer">No public signup. Contact admin to provision access.</p>
            </div>
          </div>

          <div className="login-copyright">&copy; 2026 CREATE. All rights reserved.</div>

          <style jsx>{`
            @property --login-border-angle {
              syntax: '<angle>';
              inherits: false;
              initial-value: 100deg;
            }

            .login-root {
              position: relative;
              display: flex;
              width: 100vw;
              height: 100vh;
              overflow: hidden;
              background: #000000;
            }

            .login-root.is-preparing .login-logo,
            .login-root.is-preparing .login-title-block,
            .login-root.is-preparing .login-chart-container,
            .login-root.is-preparing .login-badges,
            .login-root.is-preparing .login-right,
            .login-root.is-preparing .login-copyright {
              opacity: 0;
            }

            .login-root.is-ready .login-logo,
            .login-root.is-ready .login-title-block,
            .login-root.is-ready .login-chart-container,
            .login-root.is-ready .login-badges,
            .login-root.is-ready .login-right,
            .login-root.is-ready .login-copyright {
              opacity: 1;
              transition: opacity 220ms ease-out;
            }

            .login-left {
              position: relative;
              flex: 0 0 55%;
              overflow: hidden;
            }

            .login-left-glow {
              position: absolute;
              inset: 0;
              background: radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.06) 0%, transparent 70%);
              pointer-events: none;
            }

            .login-left-content {
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              padding: clamp(24px, 3.2vh, 44px) clamp(18px, 2vw, 36px) 24px clamp(82px, 6vw, 128px);
              box-sizing: border-box;
              transform: translateX(1cm);
            }

            .login-logo {
              margin-bottom: 4px;
            }

            .login-title-block {
              display: flex;
              flex-direction: column;
              gap: 6px;
              margin-bottom: 0;
              width: 100%;
              max-width: 760px;
              text-align: center;
            }

            .login-title {
              margin: 0;
              font-family: var(--font-sans), ui-sans-serif, system-ui, -apple-system,
                'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              align-items: baseline;
              justify-content: center;
              gap: 0.24em;
              font-size: clamp(40px, 4vw, 56px);
              font-weight: 700;
              line-height: 1.02;
              white-space: nowrap;
              letter-spacing: 0;
              text-align: center;
            }

            .login-title-white {
              color: #ffffff;
            }

            .login-title-word {
              display: inline-block;
              white-space: nowrap;
            }

            .login-title-gradient {
              background: linear-gradient(135deg, #06b6d4 0%, #818cf8 50%, #a855f7 100%);
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
            }

            .login-divider-wrap {
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              width: calc(100% - 4cm);
              height: 12px;
              margin: 6px auto;
            }

            .login-divider-diamond {
              position: relative;
              z-index: 1;
              font-size: 11px;
              line-height: 1;
              color: #22d3ee;
              background: #000000;
              padding: 0 10px;
            }

            .login-divider-line {
              position: absolute;
              left: 0;
              right: 0;
              top: 50%;
              width: 100%;
              height: 1.5px;
              border-radius: 2px;
              transform: translateY(-50%);
              background: linear-gradient(
                90deg,
                transparent 0%,
                rgba(6, 182, 212, 0.9) 22%,
                rgba(129, 140, 248, 0.9) 50%,
                rgba(168, 85, 247, 0.9) 78%,
                transparent 100%
              );
            }

            .login-tagline {
              margin: 18px 0 0;
              width: 100%;
              text-align: center;
              font-size: 17px;
              font-weight: 300;
              letter-spacing: 0.04em;
              color: rgba(255, 255, 255, 0.7);
            }

            .login-chart-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              width: 100%;
              max-width: 790px;
              height: 330px;
              margin-top: -18px;
              margin-bottom: -2px;
            }

            .login-chart-container svg {
              display: block;
              flex: 0 0 auto;
              margin-top: -8px;
            }

            .login-chart-svg,
            .login-chart-bar-hover,
            .login-chart-bar,
            .login-chart-bar-fill,
            .login-chart-bar-rect {
              pointer-events: all;
            }

            .login-chart-bar-rect {
              cursor: default;
            }

            .login-chart-bar-hover {
              transition:
                transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
                filter 180ms ease;
            }

            .login-chart-bar-hover:hover {
              transform: scaleX(1.08) scaleY(1.04);
              filter:
                brightness(1.35)
                drop-shadow(0 0 7px rgba(34, 211, 238, 0.6));
            }

            .login-badges {
              display: flex;
              align-items: stretch;
              width: 100%;
              max-width: 790px;
              gap: 0;
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 14px;
              background: rgba(255, 255, 255, 0.02);
              overflow: hidden;
            }

            .login-badge {
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: center;
              gap: 12px;
              flex: 1 1 0;
              min-width: 0;
              padding: 15px 18px;
              text-align: left;
            }

            .login-badge + .login-badge {
              border-left: 1px solid rgba(255, 255, 255, 0.1);
            }

            .login-badge-copy {
              display: flex;
              flex-direction: column;
              gap: 4px;
              min-width: 0;
            }

            .login-badge-label {
              display: inline-flex;
              align-items: center;
              min-width: 0;
              font-size: 13px;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: rgba(255, 255, 255, 0.92);
            }

            .login-badge-label::before {
              content: none;
            }

            .login-badge :global(.login-badge-icon) {
              flex-shrink: 0;
              width: 34px;
              height: 34px;
            }

            .login-badge-sublabel {
              font-size: 12px;
              color: rgba(255, 255, 255, 0.58);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .login-right {
              flex: 0 0 45%;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              padding-left: 0;
              transform: translateX(1cm);
            }

            .login-card {
              --login-border-angle: 100deg;
              width: 100%;
              max-width: 440px;
              padding: 40px;
              border-radius: 28px;
              border: 3px solid transparent;
              background:
                linear-gradient(160deg, #0a0e14 0%, #05070b 100%) padding-box,
                linear-gradient(
                  var(--login-border-angle),
                  #22d3ee 0%,
                  #67e8f9 18%,
                  #38bdf8 34%,
                  #6366f1 58%,
                  #8b5cf6 78%,
                  #d946ef 100%
                ) border-box;
              transition: box-shadow 200ms ease;
            }

            .login-card:hover {
              animation: rotateBorder 3000ms linear infinite;
              box-shadow:
                0 0 38px rgba(34, 211, 238, 0.22),
                0 0 78px rgba(168, 85, 247, 0.18);
            }

            .login-card-lock {
              position: relative;
              width: 80px;
              height: 88px;
              margin: 0 auto 22px;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .login-card-hex {
              position: absolute;
              inset: 0;
            }

            .login-hex-fill {
              opacity: 1;
            }

            .login-hex-stroke {
              stroke-dasharray: 254.74;
              stroke-dashoffset: 0;
              transition: stroke 200ms ease;
            }

            .login-card:hover .login-hex-stroke {
              stroke: url(#login-hex-hover-gradient);
              filter: none;
            }

            .login-card-eyebrow {
              margin: 0 0 12px;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: #22d3ee;
              text-align: center;
            }

            .login-card-title {
              margin: 0 0 10px;
              font-size: 38px;
              font-weight: 700;
              color: #ffffff;
              text-align: center;
            }

            .login-card-subtitle {
              margin: 0 0 32px;
              font-size: 14px;
              color: rgba(255, 255, 255, 0.92);
              text-align: center;
              white-space: nowrap;
            }

            .login-card-subtitle-accent {
              color: #22d3ee;
              font-weight: 600;
            }

            .login-card-footer {
              margin: 22px 0 0;
              font-size: 12px;
              color: rgba(255, 255, 255, 0.85);
              text-align: center;
            }

            .login-copyright {
              position: fixed;
              bottom: 16px;
              left: 24px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.5);
            }

            @media (max-width: 900px) {
              .login-root {
                flex-direction: column;
                height: auto;
                min-height: 100vh;
                overflow: auto;
              }
              .login-left,
              .login-right {
                flex: none;
                width: 100%;
              }
              .login-left {
                padding: 48px 0;
              }
              .login-left-content {
                height: auto;
                padding: 0 32px;
                transform: none;
              }
              .login-right {
                padding: 32px 0 64px;
                transform: none;
              }
              .login-card-subtitle {
                white-space: normal;
              }
              .login-badges {
                flex-direction: column;
              }
              .login-badge + .login-badge {
                border-left: none;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
              }
            }

            @media (prefers-reduced-motion: no-preference) {
              .login-root.is-ready .login-logo {
                animation: fadeSlideUp 200ms ease-out both;
                animation-delay: 200ms;
              }
              .login-root.is-ready .login-title {
                animation: fadeSlideUp 250ms ease-out both;
                animation-delay: 350ms;
              }
              .login-root.is-ready .login-divider-wrap,
              .login-root.is-ready .login-tagline {
                animation: fadeSlideUp 200ms ease-out both;
                animation-delay: 450ms;
              }
              .login-root.is-ready .login-chart-container {
                animation: fadeSlideUp ${CHART_CONTAINER_FADE_DURATION_MS}ms ease-out both;
                animation-delay: ${CHART_CONTAINER_FADE_DELAY_MS}ms;
              }
              .login-root.is-ready .login-badge-0 {
                animation: fadeSlideUp 200ms ease-out both;
                animation-delay: 900ms;
              }
              .login-root.is-ready .login-badge-1 {
                animation: fadeSlideUp 200ms ease-out both;
                animation-delay: 1000ms;
              }
              .login-root.is-ready .login-badge-2 {
                animation: fadeSlideUp 200ms ease-out both;
                animation-delay: 1100ms;
              }
              .login-root.is-ready .login-card {
                animation: fadeSlideLeft 400ms ease-out both;
                animation-delay: 100ms;
              }

              .login-root.is-ready .login-hex-fill {
                opacity: 0;
                animation: fadeInDot 300ms ease-out both;
                animation-delay: 1500ms;
              }

              .login-root.is-ready .login-hex-stroke {
                stroke-dasharray: 254.74;
                stroke-dashoffset: 254.74;
                animation: drawLine 1000ms ease-out both;
                animation-delay: 300ms;
              }

              .login-card:hover .login-hex-stroke {
                stroke-dashoffset: 0;
              }

              .login-root.is-ready .login-chart-bar {
                opacity: 0;
                transform: scaleY(0);
                transform-box: view-box;
                animation: growBar ${CHART_BAR_GROW_DURATION_MS}ms ease-out both;
                animation-delay: var(--chart-point-delay);
              }

              .login-root.is-ready .login-chart-bar-cap {
                opacity: 0;
                animation: fadeInDot ${CHART_CAP_REVEAL_DURATION_MS}ms ease-out both;
                animation-delay: var(--chart-point-delay);
              }

              .login-root.is-ready .login-chart-line {
                stroke-dasharray: ${CHART_LINE_DASH_LENGTH};
                stroke-dashoffset: ${CHART_LINE_DASH_LENGTH};
                animation: drawLine ${CHART_LINE_DURATION_MS}ms ease-in-out both;
                animation-delay: ${CHART_LINE_START_DELAY_MS}ms;
              }

              .login-root.is-ready .login-chart-line-spark {
                animation: travelChartSpark ${CHART_SPARK_DURATION_MS}ms ease-in-out infinite;
                animation-delay: ${CHART_SPARK_DELAY_MS}ms;
              }

              .login-root.is-ready .login-chart-arrow-head {
                opacity: 0;
                animation: fadeInDot ${CHART_ARROW_HEAD_DURATION_MS}ms ease-out both;
                animation-delay: ${CHART_ARROW_HEAD_DELAY_MS}ms;
              }

              .login-root.is-ready .login-chart-dot {
                opacity: 0;
                transform: scale(0);
                transform-origin: center center;
                animation: popInDot ${CHART_DOT_POP_DURATION_MS}ms ease-out forwards, pulseDot ${CHART_PULSE_DURATION_MS}ms ease-in-out infinite alternate;
                animation-delay: var(--chart-point-delay), var(--chart-pulse-delay);
              }
            }

            @keyframes fadeSlideUp {
              from {
                opacity: 0;
                transform: translateY(16px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes fadeSlideLeft {
              from {
                opacity: 0;
                transform: translateX(20px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }

            @keyframes rotateBorder {
              from {
                --login-border-angle: 0deg;
              }
              to {
                --login-border-angle: 360deg;
              }
            }

            @keyframes growBar {
              from {
                opacity: 0;
                transform: scaleY(0);
              }
              to {
                opacity: 1;
                transform: scaleY(1);
              }
            }

            @keyframes drawLine {
              to {
                stroke-dashoffset: 0;
              }
            }

            @keyframes travelChartSpark {
              0%,
              18% {
                opacity: 0;
                stroke-dashoffset: ${CHART_LINE_DASH_LENGTH};
              }
              28% {
                opacity: 0.95;
              }
              72% {
                opacity: 0.95;
              }
              88%,
              100% {
                opacity: 0;
                stroke-dashoffset: -42;
              }
            }

            @keyframes fadeInDot {
              to {
                opacity: 1;
              }
            }

            @keyframes popInDot {
              from {
                opacity: 0;
                transform: scale(0);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }

            @keyframes pulseDot {
              from {
                opacity: 0.7;
              }
              to {
                opacity: 1;
              }
            }
          `}</style>
        </main>
    </>
  );
}
