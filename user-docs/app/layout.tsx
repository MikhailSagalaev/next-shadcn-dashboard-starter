/**
 * @file: layout.tsx
 * @description: Root layout для Nextra 4 документации
 * @project: SaaS Bonus System - Documentation
 * @dependencies: nextra-theme-docs
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import type { ReactNode } from 'react';

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
        <img src='/logo.svg' alt='Gupil Docs' width={32} height={32} />
      </div>
    }
  />
);

const footer = (
  <Footer>© {new Date().getFullYear()} Gupil Documentation</Footer>
);

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang='ru' dir='ltr' suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          editLink='Редактировать эту страницу на GitHub'
          docsRepositoryBase='https://github.com/MikhailSagalaev/next-shadcn-dashboard-starter/tree/main/user-docs'
          sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
          toc={{ title: 'На этой странице' }}
          feedback={{ content: 'Есть вопросы? Напишите нам' }}
          search={{
            placeholder: 'Поиск по документации...',
            emptyResult: 'Ничего не найдено',
            error: 'Ошибка поиска',
            loading: 'Загрузка...'
          }}
          pageMap={await getPageMap()}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
