import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard : Profile'
};

export default async function Page() {
  redirect('/dashboard/settings?tab=profile');
}
