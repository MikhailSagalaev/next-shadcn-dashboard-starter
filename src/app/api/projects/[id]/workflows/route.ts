/**
 * @file: src/app/api/projects/[id]/workflows/route.ts
 * @description: API endpoints для управления workflow проекта
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, Workflow types
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import type { CreateWorkflowRequest, UpdateWorkflowRequest } from '@/types/workflow';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';

// GET /api/projects/[id]/workflows - Получить все workflow проекта
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Проект не найден' },
        { status: 404 }
      );
    }

    // Получаем все workflow проекта
    const workflows = await db.workflow.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Ошибка получения workflow' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/workflows - Создать новый workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const data: CreateWorkflowRequest = await request.json();

    console.log('Creating workflow:', { projectId, data });

    // Проверяем аутентификацию
    const admin = await getCurrentAdmin();
    if (!admin?.sub) {
      console.error('Unauthorized workflow creation attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем существование проекта
    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      console.error('Project not found:', projectId);
      return NextResponse.json(
        { error: 'Проект не найден' },
        { status: 404 }
      );
    }

    // Определяем entry node (первый trigger node)
    const nodes = data.nodes || [];
    const entryNode = nodes.find((node: any) =>
      node.type?.startsWith('trigger.')
    );

    if (!entryNode) {
      return NextResponse.json(
        { error: 'Workflow должен содержать хотя бы один trigger node' },
        { status: 400 }
      );
    }

    // Создаем новый workflow
    const workflow = await db.workflow.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        nodes: JSON.parse(JSON.stringify(data.nodes || [])) as any, // Cast to JSON
        connections: JSON.parse(JSON.stringify(data.connections || [])) as any, // Cast to JSON
        variables: JSON.parse(JSON.stringify(data.variables || [])) as any, // Cast to JSON
        settings: JSON.parse(JSON.stringify(data.settings || {})) as any // Cast to JSON
      }
    });

    console.log('Workflow created successfully:', workflow.id);

    // Создаем активную версию workflow
    const version = await db.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: 1,
        nodes: workflow.nodes,
        variables: workflow.variables,
        settings: workflow.settings,
        entryNodeId: entryNode.id,
        isActive: true
      }
    });

    console.log('Workflow version created:', version.id);

    // Workflow уже создан с версией, не нужно обновлять

    // Инвалидируем кэш workflow для проекта
    await WorkflowRuntimeService.invalidateCache(projectId);

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      { error: 'Ошибка создания workflow' },
      { status: 500 }
    );
  }
}
