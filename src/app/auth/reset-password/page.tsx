/**
 * @file: src/app/auth/reset-password/page.tsx
 * @description: Страница установки нового пароля
 * @project: SaaS Bonus System
 * @dependencies: Next.js, React
 * @created: 2025-10-02
 * @author: AI Assistant + User
 */

import { Metadata } from 'next';
import ResetPasswordView from '@/features/auth/components/reset-password-view';

export const metadata: Metadata = {
  title: 'Установка нового пароля | SaaS Bonus System',
  description: 'Установите новый пароль для вашего аккаунта.'
};

export default function Page() {
  return <ResetPasswordView />;
}
