/**
 * @file: src/app/api/projects/[id]/workflows/[workflowId]/route.ts
 * @description: API endpoints для управления конкретным workflow
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, Workflow types
 * @created: 2025-01-11
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateWorkflowRequest } from '@/types/workflow';
import { WorkflowRuntimeService } from '@/lib/services/workflow-runtime.service';

// GET /api/projects/[id]/workflows/[workflowId] - Получить workflow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: projectId, workflowId } = resolvedParams;

    const workflow = await db.workflow.findFirst({
      where: {
        id: workflowId,
        projectId
      }
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Ошибка получения workflow' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/workflows/[workflowId] - Обновить workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: projectId, workflowId } = resolvedParams;
    const data: UpdateWorkflowRequest = await request.json();

    // Проверяем существование workflow
    const existingWorkflow = await db.workflow.findFirst({
      where: {
        id: workflowId,
        projectId
      }
    });

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: 'Workflow не найден' },
        { status: 404 }
      );
    }

    // Если активируем workflow, деактивируем все остальные
    if (data.isActive) {
      await db.workflow.updateMany({
        where: {
          projectId,
          isActive: true,
          id: { not: workflowId }
        },
        data: {
          isActive: false
        }
      });
    }

    // Проверяем, нужно ли создавать новую версию
    const hasWorkflowData = data.nodes !== undefined || data.connections !== undefined || data.variables !== undefined || data.settings !== undefined;

    // Если активируем workflow и нет активной версии, создаем версию на основе текущих данных
    const needsVersion = data.isActive && !hasWorkflowData;

    let version: any = null;

    if (hasWorkflowData || needsVersion) {
      // Определяем entry node (первый trigger node)
      const nodes = (data.nodes || existingWorkflow.nodes || []) as any[];

      console.log('Creating workflow version with nodes:', {
        hasWorkflowData,
        needsVersion,
        dataNodesCount: data.nodes?.length,
        existingNodesCount: Array.isArray(existingWorkflow.nodes) ? existingWorkflow.nodes.length : 0,
        nodesLength: nodes.length,
        nodesTypes: nodes.map((n: any) => n.type)
      });

      const entryNode = nodes.find((node: any) =>
        node.type?.startsWith('trigger.')
      );

      if (!entryNode) {
        console.error('No entry node found in workflow', {
          nodes: nodes.map((n: any) => ({ id: n.id, type: n.type }))
        });
        return NextResponse.json(
          { error: 'Workflow должен содержать хотя бы один trigger node' },
          { status: 400 }
        );
      }

      console.log('Entry node found:', { id: entryNode.id, type: entryNode.type });

      // Создаем новую версию workflow
      const currentVersion = await db.workflowVersion.findFirst({
        where: { workflowId, isActive: true },
        orderBy: { version: 'desc' }
      });

      const newVersionNumber = (currentVersion?.version || 0) + 1;

      version = await db.workflowVersion.create({
        data: {
          workflowId,
          version: newVersionNumber,
          nodes: JSON.parse(JSON.stringify(data.nodes || existingWorkflow.nodes)) as any,
          variables: JSON.parse(JSON.stringify(data.variables || existingWorkflow.variables)) as any,
          settings: JSON.parse(JSON.stringify(data.settings || existingWorkflow.settings)) as any,
          entryNodeId: entryNode.id,
          isActive: true
        }
      });

      console.log('New workflow version created:', version.id, 'version:', newVersionNumber);

      // Деактивируем предыдущую активную версию
      if (currentVersion) {
        await db.workflowVersion.update({
          where: { id: currentVersion.id },
          data: { isActive: false }
        });
      }
    }

    // Обновляем workflow
    const updateData: any = {
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      updatedAt: new Date()
    };

    // Обновляем данные workflow только если они пришли
    if (data.nodes !== undefined) {
      updateData.nodes = JSON.parse(JSON.stringify(data.nodes)) as any;
    }
    if (data.connections !== undefined) {
      updateData.connections = JSON.parse(JSON.stringify(data.connections)) as any;
    }
    if (data.variables !== undefined) {
      updateData.variables = JSON.parse(JSON.stringify(data.variables)) as any;
    }
    if (data.settings !== undefined) {
      updateData.settings = JSON.parse(JSON.stringify(data.settings)) as any;
    }

    // Версии управляются отдельно, currentVersionId не нужен

    const workflow = await db.workflow.update({
      where: { id: workflowId },
      data: updateData
    });

    // Инвалидируем кэш workflow для проекта
    WorkflowRuntimeService.invalidateCache(projectId);

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { error: 'Ошибка обновления workflow' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/workflows/[workflowId] - Удалить workflow
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: projectId, workflowId } = resolvedParams;

    // Проверяем существование workflow
    const existingWorkflow = await db.workflow.findFirst({
      where: {
        id: workflowId,
        projectId
      }
    });

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: 'Workflow не найден' },
        { status: 404 }
      );
    }

    // Удаляем workflow
    await db.workflow.delete({
      where: { id: workflowId }
    });

    // Инвалидируем кэш workflow для проекта
    WorkflowRuntimeService.invalidateCache(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления workflow' },
      { status: 500 }
    );
  }
}
