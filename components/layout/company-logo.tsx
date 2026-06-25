"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';
import logoSrc from '../../assets/create_logo.svg';

type LogoTone = 'light' | 'dark';

type CompanyLogoProps = {
  compact?: boolean;
  tone?: LogoTone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
};

const LOGO_WIDTHS: Record<NonNullable<CompanyLogoProps['size']>, number> = {
  sm: 38,
  md: 56,
  lg: 196,
  xl: 260,
};

export function CompanyLogo({ compact = false, tone = 'light', size = 'md', showText = true }: CompanyLogoProps) {
  const logoWidth = LOGO_WIDTHS[size];
  const logoStyle = {
    filter: tone === 'dark' ? 'brightness(0)' : 'none',
  } as const;

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, y: -6, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Image
        src={logoSrc}
        alt="CREATE"
        width={logoWidth * 2}
        height={logoWidth}
        priority
        className="h-auto shrink-0 object-contain"
        style={{
          width: logoWidth,
          ...logoStyle,
        }}
      />
      {showText && !compact ? (
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-5 text-foreground">Finance Ops</div>
          <div className="truncate text-xs text-muted-foreground">Intake and approval workflow</div>
        </div>
      ) : null}
    </motion.div>
  );
}
