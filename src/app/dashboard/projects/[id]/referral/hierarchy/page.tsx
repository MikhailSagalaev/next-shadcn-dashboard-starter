/**
 * @file: page.tsx
 * @description: Дерево партнёров теперь живёт как вкладка «Иерархия» на
 *   странице реферальной программы (см. HierarchyTabPanel) — редиректим
 *   старые ссылки/закладки/уведомления туда, сохраняя period/search/
 *   organizationId, чтобы фильтрованные ссылки (например, из карточки
 *   организации) продолжали работать.
 * @project: SaaS Bonus System
 * @created: 2026-05-24
 */

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    period?: string;
    search?: string;
    organizationId?: string;
  }>;
}

export default async function HierarchyPage({
  params,
  searchParams
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const query = new URLSearchParams({ tab: 'hierarchy' });
  if (sp.period) query.set('period', sp.period);
  if (sp.search) query.set('search', sp.search);
  if (sp.organizationId) query.set('organizationId', sp.organizationId);

  redirect(`/dashboard/projects/${id}/referral?${query.toString()}`);
}
