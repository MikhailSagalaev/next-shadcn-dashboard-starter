/**
 * @file: src/app/dashboard/projects/[id]/workflow/page.tsx
 * @description: Страница конструктора workflow в стиле n8n
 * @project: SaaS Bonus System
 * @dependencies: Next.js, WorkflowConstructor
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import { WorkflowConstructor } from '@/features/workflow/components/workflow-constructor';

interface WorkflowPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  return <WorkflowConstructor projectId={projectId} />;
}
