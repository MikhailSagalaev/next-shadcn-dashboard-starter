/**
 * @file: layout.tsx
 * @description: Root layout для Nextra 4 документации
 * @project: SaaS Bonus System - Documentation
 * @dependencies: nextra-theme-docs
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Banner, Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import Image from 'next/image';

export const metadata = {
  title: {
    default: 'Gupil Documentation',
    template: '%s - Gupil Docs'
  },
  description: 'Документация по SaaS платформе бонусных программ Gupil'
};

const navbar = (
  <Navbar
    logo={
      <div className='flex items-center gap-2 font-bold'>
        <Image src='/logo.svg' alt='Gupil Docs' width={32} height={32} />
        <span>Gupil Docs</span>
      </div>
    }
    // @ts-ignore
    searchPlaceholder='Поиск по документации...'
  />
);

const footer = (
  <Footer>© {new Date().getFullYear()} Gupil Documentation</Footer>
);

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='ru' dir='ltr' suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          editLink='Редактировать эту страницу на GitHub'
          docsRepositoryBase='https://github.com/your-org/gupil/tree/main/user-docs'
          sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
          toc={{ title: 'На этой странице' }}
          feedback={{ content: 'Есть вопросы? Напишите нам' }}
          // @ts-ignore
          i18n={[{ locale: 'ru', text: 'Русский' }]}
          pageMap={await getPageMap()}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
