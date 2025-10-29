/**
 * @file: src/app/dashboard/projects/[id]/workflow/monitoring/page.tsx
 * @description: Страница мониторинга выполнений workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

import { ExecutionMonitoringDashboard } from '@/features/workflow/components/monitoring/execution-monitoring-dashboard';

interface WorkflowMonitoringPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowMonitoringPage({ params }: WorkflowMonitoringPageProps) {
  const { id: projectId } = await params;
  return <ExecutionMonitoringDashboard projectId={projectId} />;
}

