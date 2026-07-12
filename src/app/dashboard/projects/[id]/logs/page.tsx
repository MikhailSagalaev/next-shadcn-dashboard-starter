/**
 * @file: logs/page.tsx
 * @description: Страница логов интеграции (webhook логи)
 * @project: SaaS Bonus System
 */

// Перенесено: логи доступны во вкладке "Логи" на странице интеграции
import { redirect } from 'next/navigation';

export default async function ProjectLogsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Query-параметр, а не #hash — вкладка внутри tilda-integration-view.tsx
  // читает его через useSearchParams(), hash клиентский Tabs-компонент не видит
  redirect(`/dashboard/projects/${id}/integration?tab=logs`);
}
