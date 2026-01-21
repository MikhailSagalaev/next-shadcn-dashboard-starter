import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/font';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';
import './theme.css';

// Активируем глобальный обработчик ошибок для ботов
if (typeof window === 'undefined') {
  const {
    setupGlobalErrorHandler
  } = require('@/lib/telegram/global-error-handler');
  setupGlobalErrorHandler();
}

const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
};

export const metadata: Metadata = {
  title: 'GUPIL.RU - Система лояльности для Tilda | Все в одном за 4 клика',
  description:
    'Первое и единственное полноценное решение для Tilda с интеграцией личного кабинета. Система лояльности, Telegram боты и маркетинг в одной платформе. Подключение за 4 клика.',
  keywords: [
    'система лояльности',
    'Tilda',
    'бонусная программа',
    'Telegram бот',
    'webhook API',
    'лояльность клиентов',
    'GUPIL'
  ],
  openGraph: {
    title: 'GUPIL.RU - Система лояльности для Tilda',
    description:
      'Все в одном за 4 клика. Первое решение для Tilda с интеграцией личного кабинета.',
    type: 'website',
    siteName: 'GUPIL.RU'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GUPIL.RU - Система лояльности для Tilda',
    description:
      'Все в одном за 4 клика. Первое решение для Tilda с интеграцией личного кабинета.'
  }
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get('active_theme')?.value;
  const isScaled = activeThemeValue?.endsWith('-scaled');

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body
        className={cn(
          'bg-background overflow-hidden overscroll-none font-sans antialiased',
          activeThemeValue ? `theme-${activeThemeValue}` : '',
          isScaled ? 'theme-scaled' : '',
          fontVariables
        )}
        suppressHydrationWarning
      >
        <NextTopLoader showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers activeThemeValue={activeThemeValue as string}>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
