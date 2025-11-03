import { Metadata } from 'next';
import VerifyEmailViewPage from '@/features/auth/components/verify-email-view';

export const metadata: Metadata = {
  title: 'Подтверждение email | SaaS Bonus System',
  description: 'Подтвердите ваш email адрес.'
};

export default function Page() {
  return <VerifyEmailViewPage />;
}

