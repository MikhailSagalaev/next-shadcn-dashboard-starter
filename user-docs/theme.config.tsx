/**
 * @file: theme.config.tsx
 * @description: Конфигурация темы Nextra 4
 * @project: SaaS Bonus System - Documentation
 * @dependencies: nextra-theme-docs
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import React from 'react'
import type { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span>Gupil Documentation</span>,
  project: {
    link: 'https://github.com/your-org/gupil',
  },
  chat: {
    link: 'https://t.me/gupil_support',
  },
  docsRepositoryBase: 'https://github.com/your-org/gupil/tree/main/user-docs',
  footer: {
    text: '© 2025 Gupil Documentation. Все права защищены.',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Gupil Docs'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Gupil Documentation" />
      <meta property="og:description" content="Документация по SaaS платформе бонусных программ Gupil" />
    </>
  ),
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <span className="cursor-default">{title}</span>
      }
      return <>{title}</>
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
}

export default config