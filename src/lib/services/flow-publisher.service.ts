import { db } from '@/lib/db';
import { BotFlow, BotNode, BotConnection } from '@/types/bot-constructor';
import {
  WorkflowVersion,
  WorkflowNode,
  WorkflowConnection
} from '@/types/workflow';
import { logger } from '@/lib/logger';

export class FlowPublisherService {
  /**
   * Publishes a BotFlow to the active WorkflowVersion
   */
  static async publish(
    projectId: string,
    botFlowId: string
  ): Promise<WorkflowVersion> {
    try {
      // 1. Get the source BotFlow
      const botFlow = await db.botFlow.findUnique({
        where: { id: botFlowId }
      });

      if (!botFlow) {
        throw new Error('Bot flow not found');
      }

      if (botFlow.projectId !== projectId) {
        throw new Error('Access denied');
      }

      // 2. Validate essential structure
      const entryNode = (botFlow.nodes as any[]).find(
        (n: BotNode) => n.type === 'start'
      );
      if (!entryNode) {
        throw new Error('Flow must have a Start node');
      }

      // 3. Find or Create the parent Workflow
      // We assume a 1-to-1 mapping or we create a new one.
      // For now, let's try to find an existing Workflow with the same name or link
      // Ideally, BotFlow should have a relation to Workflow, but if schemas are detached, we link by logic

      let workflow = await db.workflow.findFirst({
        where: {
          projectId,
          name: botFlow.name
        }
      });

      if (!workflow) {
        workflow = await db.workflow.create({
          data: {
            projectId,
            name: botFlow.name,
            description: botFlow.description,
            isActive: true, // Auto-activate the workflow container
            settings: botFlow.settings || {},
            nodes: [], // Base workflow doesn't store active nodes, versions do
            connections: []
          }
        });
      }

      // 4. Map Nodes and Connections
      // The BotNode structure usually matches WorkflowNode requirements, but let's be safe
      const workflowNodes = this.mapNodes(
        botFlow.nodes as unknown as BotNode[]
      );

      // 5. Create new Version
      const nextVersionNumber = await this.getNextVersionNumber(workflow.id);

      // Deactivate all previous versions
      await db.workflowVersion.updateMany({
        where: { workflowId: workflow.id },
        data: { isActive: false }
      });

      const newVersion = await db.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: nextVersionNumber,
          nodes: workflowNodes as any, // Prisma specific type casting
          entryNodeId: entryNode.id,
          variables: botFlow.variables || [],
          settings: botFlow.settings || {},
          isActive: true
        }
      });

      // Also update the main workflow with latest connections (sometimes used for graph visualization outside of versioning)
      await db.workflow.update({
        where: { id: workflow.id },
        data: {
          connections: botFlow.connections || [],
          updatedAt: new Date()
        }
      });

      logger.info('Bot flow published successfully', {
        projectId,
        botFlowId,
        workflowId: workflow.id,
        version: newVersion.version
      });

      return newVersion as unknown as WorkflowVersion;
    } catch (error) {
      logger.error('Failed to publish flow', {
        projectId,
        botFlowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private static mapNodes(botNodes: BotNode[]): Record<string, WorkflowNode> {
    const nodeMap: Record<string, WorkflowNode> = {};

    // In many cases, the structure is identical or compatible enough.
    // If specific transformations are needed (e.g. UI position stripping), do it here.
    // We will keep position data as it might be useful for read-only viewing of production versions.

    botNodes.forEach((node) => {
      nodeMap[node.id] = {
        id: node.id,
        type: node.type as any, // Type compatibility between BotNode and WorkflowNode
        data: node.data as any, // Type compatibility between BotNode and WorkflowNode
        position: node.position
      };
    });

    return nodeMap;
  }

  private static async getNextVersionNumber(
    workflowId: string
  ): Promise<number> {
    const latestVersion = await db.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' },
      select: { version: true }
    });
    return (latestVersion?.version || 0) + 1;
  }
}
