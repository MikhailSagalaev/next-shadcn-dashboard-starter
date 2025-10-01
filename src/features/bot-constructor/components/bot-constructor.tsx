/**
 * @file: src/features/bot-constructor/components/bot-constructor.tsx
 * @description: Основной компонент визуального конструктора ботов
 * @project: SaaS Bonus System
 * @dependencies: React, React Flow, BotConstructor types
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Components
import { BotConstructorToolbar } from './bot-constructor-toolbar';
import { BotConstructorProperties } from './bot-constructor-properties';
import { BotConstructorHeader } from './bot-constructor-header';

// Node types
import { nodeTypes } from './nodes/node-types';

// Hooks
import { useBotFlow } from '../hooks/use-bot-flow';

// Types
import type {
  BotNode,
  BotConnection,
  BotFlow,
  NodeType,
  Position
} from '@/types/bot-constructor';

interface BotConstructorProps {
  projectId: string;
}

export function BotConstructor({ projectId }: BotConstructorProps) {
  // State
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<BotNode | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<BotNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BotConnection>([]);

  // Custom hooks
  const {
    flows,
    currentFlow,
    isLoading,
    createFlow,
    updateFlow,
    deleteFlow,
    loadFlow,
    saveFlow
  } = useBotFlow(projectId);

  // Handle adding new nodes
  const handleAddNode = useCallback(
    (nodeType: NodeType, position: Position) => {
      const newNode: BotNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          label: getDefaultLabel(nodeType),
          config: getDefaultConfig(nodeType)
        }
      };

      setNodes((nds) => [...nds, newNode]);
    },
    []
  );

  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: BotConnection = {
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        sourceNodeId: params.source!,
        targetNodeId: params.target!,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type:
          params.sourceHandle === 'true'
            ? 'true'
            : params.sourceHandle === 'false'
              ? 'false'
              : 'default',
        animated: true
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as BotNode);
  }, []);

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle node changes
  const onNodesChangeWithSave = useCallback(
    (changes: any[]) => {
      onNodesChange(changes);
      // Auto-save after changes (debounced)
      if (currentFlow && changes.length > 0) {
        const updatedFlow: Partial<BotFlow> = {
          nodes,
          connections: edges
        };
        updateFlow(currentFlow.id, updatedFlow);
      }
    },
    [onNodesChange, nodes, edges, currentFlow, updateFlow]
  );

  // Handle edge changes
  const onEdgesChangeWithSave = useCallback(
    (changes: any[]) => {
      onEdgesChange(changes);
      // Auto-save after changes (debounced)
      if (currentFlow && changes.length > 0) {
        const updatedFlow: Partial<BotFlow> = {
          nodes,
          connections: edges
        };
        updateFlow(currentFlow.id, updatedFlow);
      }
    },
    [onEdgesChange, nodes, edges, currentFlow, updateFlow]
  );

  // Memoized flow data for React Flow
  const flowData = useMemo(() => {
    if (!currentFlow) return { nodes: [], edges: [] };

    const rfNodes: Node[] = currentFlow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      selected: selectedNode?.id === node.id
    }));

    const rfEdges: Edge[] = currentFlow.connections.map((connection) => ({
      id: connection.id,
      source: connection.sourceNodeId,
      target: connection.targetNodeId,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'default',
      animated: connection.animated,
      style: connection.style
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [currentFlow, selectedNode]);

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground mt-4'>Загрузка конструктора...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <BotConstructorHeader
        projectId={projectId}
        flows={flows}
        currentFlow={currentFlow}
        selectedFlowId={selectedFlowId}
        onFlowSelect={setSelectedFlowId}
        onFlowCreate={createFlow}
        onFlowLoad={loadFlow}
        onFlowSave={saveFlow}
        onFlowDelete={deleteFlow}
        onFlowExport={exportFlow}
        onFlowImport={importFlow}
        isPreviewMode={isPreviewMode}
        onPreviewToggle={setIsPreviewMode}
      />

      {/* Main content - занимает всё оставшееся пространство */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Toolbar */}
        <BotConstructorToolbar onAddNode={handleAddNode} />

        {/* Canvas - занимает всё доступное пространство */}
        <div className='relative flex-1 overflow-hidden'>
          <ReactFlow
            nodes={flowData.nodes}
            edges={flowData.edges}
            onNodesChange={onNodesChangeWithSave}
            onEdgesChange={onEdgesChangeWithSave}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition='bottom-left'
            className='h-full w-full'
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
            <MiniMap />

            {/* Preview mode indicator */}
            {isPreviewMode && (
              <Panel position='top-center'>
                <div className='rounded-lg bg-yellow-500 px-4 py-2 text-white shadow-lg'>
                  🧪 Режим предпросмотра - изменения не сохраняются
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Properties panel */}
        {selectedNode && (
          <BotConstructorProperties
            node={selectedNode}
            onNodeUpdate={(updatedNode) => {
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === updatedNode.id ? updatedNode : node
                )
              );
              setSelectedNode(updatedNode);
            }}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

// Helper functions
function getDefaultLabel(nodeType: NodeType): string {
  const labels: Record<NodeType, string> = {
    start: 'Старт',
    message: 'Сообщение',
    command: 'Команда',
    callback: 'Callback',
    input: 'Ввод данных',
    condition: 'Условие',
    action: 'Действие',
    middleware: 'Middleware',
    session: 'Сессия',
    end: 'Конец'
  };
  return labels[nodeType];
}

function getDefaultConfig(nodeType: NodeType): any {
  const defaultConfigs: Record<NodeType, any> = {
    start: {},
    message: {
      message: {
        text: '',
        parseMode: 'Markdown'
      }
    },
    command: {
      command: {
        command: '',
        description: ''
      }
    },
    callback: {
      callback: {
        data: '',
        pattern: ''
      }
    },
    input: {
      input: {
        prompt: '',
        timeout: 300
      }
    },
    condition: {
      condition: {
        variable: '',
        operator: 'equals',
        value: '',
        trueNodeId: '',
        falseNodeId: ''
      }
    },
    action: {
      action: {
        type: 'grammy_api'
      }
    },
    middleware: {
      middleware: {
        type: 'logging',
        priority: 50
      }
    },
    session: {
      session: {
        key: '',
        operation: 'set'
      }
    },
    end: {}
  };
  return defaultConfigs[nodeType];
}
