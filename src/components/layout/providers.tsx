'use client';
import React from 'react';
import { ActiveThemeProvider } from '../active-theme';
import { HeroUIProvider } from '@heroui/react';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <HeroUIProvider>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        {children}
      </ActiveThemeProvider>
    </HeroUIProvider>
  );
}
