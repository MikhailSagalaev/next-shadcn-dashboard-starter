/**
 * @file: src/app/dashboard/projects/[id]/mailings/[mailingId]/analytics/page.tsx
 * @description: Страница аналитики рассылки
 * @project: SaaS Bonus System
 * @dependencies: Next.js, React
 * @created: 2025-01-30
 * @author: AI Assistant + User
 */

import { MailingAnalyticsView } from '@/features/mailings/components/mailing-analytics-view';

export default function MailingAnalyticsPage({
  params
}: {
  params: Promise<{ id: string; mailingId: string }>;
}) {
  return <MailingAnalyticsView params={params} />;
}
