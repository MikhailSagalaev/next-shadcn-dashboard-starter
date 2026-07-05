/**
 * @file: page.tsx
 * @description: Список организаций теперь живёт как вкладка «Организации»
 *   на странице реферальной программы (единая точка входа вместо отдельного
 *   вложенного маршрута) — редиректим старые ссылки/закладки туда.
 * @project: SaaS Bonus System
 * @created: 2026-06-06
 */

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationsPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/projects/${id}/referral?tab=organizations`);
}
