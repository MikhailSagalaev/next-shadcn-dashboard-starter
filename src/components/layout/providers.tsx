'use client';
import React, { useEffect } from 'react';
import { ActiveThemeProvider } from '../active-theme';
import { HeroUIProvider } from '@heroui/react';
import '@/lib/client-logger'; // Инициализация клиентского логгера

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Логгер инициализируется автоматически при первом импорте
    // Здесь можно добавить дополнительную логику инициализации
  }, []);

  return (
    <HeroUIProvider>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        {children}
      </ActiveThemeProvider>
    </HeroUIProvider>
  );
}
