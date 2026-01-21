/**
 * @file: homepage-style-manager.tsx
 * @description: Client-side менеджер стилей для homepage (side effects)
 * @project: SaaS Bonus System
 * @dependencies: React
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { useEffect } from 'react';

/**
 * Управляет стилями body/html для homepage
 * Вынесено в отдельный Client Component для минимизации client-side кода
 */
export function HomepageStyleManager() {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    body.classList.add('homepage-active');
    html.classList.add('homepage-active');

    body.style.setProperty('overflow', 'auto', 'important');
    body.style.setProperty('overscroll-behavior', 'auto', 'important');
    body.style.setProperty('height', 'auto', 'important');
    html.style.setProperty('overflow', 'auto', 'important');
    html.style.setProperty('height', 'auto', 'important');

    return () => {
      body.classList.remove('homepage-active');
      html.classList.remove('homepage-active');
      body.style.removeProperty('overflow');
      body.style.removeProperty('overscroll-behavior');
      body.style.removeProperty('height');
      html.style.removeProperty('overflow');
      html.style.removeProperty('height');
    };
  }, []);

  return null;
}
