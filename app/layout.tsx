import type { ReactNode } from 'react';
import './globals.css';
import { ThemeTransitionProvider } from '../components/layout/theme-transition-provider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeTransitionProvider>{children}</ThemeTransitionProvider>
      </body>
    </html>
  );
}
