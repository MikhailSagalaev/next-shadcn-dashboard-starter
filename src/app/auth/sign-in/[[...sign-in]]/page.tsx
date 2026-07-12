import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'Вход | SaaS Bonus System',
  description: 'Войдите в административную панель.'
};

export default async function Page() {
  return <SignInViewPage />;
}
