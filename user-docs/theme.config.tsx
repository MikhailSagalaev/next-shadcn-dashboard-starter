/**
 * @file: theme.config.tsx
 * @description: Конфигурация темы Nextra 4
 * @project: SaaS Bonus System - Documentation
 * @dependencies: nextra-theme-docs
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import React from 'react';

const config = {
  logo: (
    <div className='flex items-center gap-2 font-bold'>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
        className='h-6 w-6 text-indigo-500'
      >
        <path d='M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z' />
      </svg>
      <span>Gupil Docs</span>
    </div>
  ),
  project: {
    link: 'https://github.com/your-org/gupil'
  },
  chat: {
    link: 'https://t.me/gupil_support'
  },
  docsRepositoryBase: 'https://github.com/your-org/gupil/tree/main/user-docs',
  footer: {
    text: '© 2025 Gupil Documentation. Все права защищены.'
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Gupil Docs'
    };
  },
  head: (
    <>
      <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      <meta property='og:title' content='Gupil Documentation' />
      <meta
        property='og:description'
        content='Документация по SaaS платформе бонусных программ Gupil'
      />
    </>
  ),
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <span className='cursor-default'>{title}</span>;
      }
      return <>{title}</>;
    },
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  search: {
    placeholder: 'Поиск по документации...'
  },
  editLink: {
    text: 'Редактировать эту страницу на GitHub'
  },
  feedback: {
    content: 'Есть вопросы? Напишите нам',
    labels: 'feedback'
  },
  toc: {
    title: 'На этой странице'
  },
  navigation: {
    prev: true,
    next: true
  }
};

export default config;
