/**
 * @file: src/features/bot-constructor/components/bot-constructor.tsx
 * @description: Основной компонент визуального конструктора ботов (Fixed: Debounce, Circular Deps, Preview Mode)
 * @project: SaaS Bonus System
 * @dependencies: React, React Flow, BotConstructor types
 * @created: 2025-09-30
 * @updated: 2026-01-17 (Bug fixes & Optimization)
 * @author: AI Assistant + User
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  Panel,
  NodeChange,
  EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../bot-constructor.css';

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

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<BotNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Flag to track if we have unsaved changes locally
  const hasUnsavedChanges = useRef(false);

  // Custom hooks
  const {
    flows,
    currentFlow,
    isLoading,
    isPreviewMode,
    isSaving,
    createFlow,
    updateFlow,
    deleteFlow,
    loadFlow,
    saveFlow,
    exportFlow,
    importFlow,

    togglePreviewMode,
    setCurrentFlow,
    publishFlow
  } = useBotFlow(projectId);

  // Convert BotConnection[] to Edge[]
  const botConnectionsToEdges = useCallback(
    (connections: BotConnection[]): Edge[] => {
      return connections.map((connection) => ({
        id: connection.id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: connection.type || 'default',
        animated: connection.animated,
        style: connection.style
      }));
    },
    []
  );

  // Convert Edge[] to BotConnection[]
  const edgesToBotConnections = useCallback(
    (rfEdges: Edge[]): BotConnection[] => {
      return rfEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type:
          edge.type === 'true' || edge.type === 'false' ? edge.type : 'default',
        animated: edge.animated,
        style: edge.style
      }));
    },
    []
  );

  // Initial Sync: Load flow into React Flow ONLY when a new flow is selected
  // We track the flow ID to ensure we only reset state when switching flows
  const loadedFlowId = useRef<string | null>(null);

  useEffect(() => {
    if (currentFlow && currentFlow.id !== loadedFlowId.current) {
      setNodes(currentFlow.nodes);
      setEdges(botConnectionsToEdges(currentFlow.connections));
      loadedFlowId.current = currentFlow.id;
      hasUnsavedChanges.current = false;
    } else if (!currentFlow) {
      setNodes([]);
      setEdges([]);
      loadedFlowId.current = null;
    }
  }, [currentFlow, setNodes, setEdges, botConnectionsToEdges]);

  // Debounced Save Logic
  useEffect(() => {
    // If no flow or preview mode, do nothing
    if (!currentFlow || isPreviewMode) return;

    const saveTimer = setTimeout(() => {
      if (hasUnsavedChanges.current) {
        // Prepare updated flow data
        const updatedFlowData: Partial<BotFlow> = {
          nodes,
          connections: edgesToBotConnections(edges)
        };

        // Optimistic update: don't wait for server
        // Call updateFlow but DO NOT reset local state from the response result
        updateFlow(currentFlow.id, updatedFlowData)
          .then(() => {
            hasUnsavedChanges.current = false;
          })
          .catch((err) => {
            console.error('Auto-save failed', err);
          });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(saveTimer);
  }, [
    nodes,
    edges,
    currentFlow,
    isPreviewMode,
    updateFlow,
    edgesToBotConnections
  ]);

  // Handle adding new nodes
  const handleAddNode = useCallback(
    (nodeType: NodeType, position: Position) => {
      if (isPreviewMode) return; // Block in preview mode

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
      hasUnsavedChanges.current = true;
    },
    [isPreviewMode, setNodes]
  );

  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => {
      if (isPreviewMode) return; // Block in preview mode

      const edgeType =
        params.sourceHandle === 'true'
          ? 'true'
          : params.sourceHandle === 'false'
            ? 'false'
            : params.sourceHandle?.includes('error')
              ? 'error'
              : 'default'; // Improved edge type logic

      const newEdge: Edge = {
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: edgeType,
        animated: true
      };

      setEdges((eds) => addEdge(newEdge, eds));
      hasUnsavedChanges.current = true;
    },
    [isPreviewMode, setEdges]
  );

  // Custom Change Handlers to track unsaved changes
  const onNodesChangeWithTracking = useCallback(
    (changes: NodeChange[]) => {
      if (isPreviewMode) return;

      // Apply changes
      onNodesChange(changes as any);

      // If we have selected node, check if it was removed or modified
      if (changes.some((c) => c.type !== 'select')) {
        hasUnsavedChanges.current = true;
      }
    },
    [isPreviewMode, onNodesChange]
  );

  const onEdgesChangeWithTracking = useCallback(
    (changes: EdgeChange[]) => {
      if (isPreviewMode) return;
      onEdgesChange(changes);
      if (changes.some((c) => c.type !== 'select')) {
        hasUnsavedChanges.current = true;
      }
    },
    [isPreviewMode, onEdgesChange]
  );

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as BotNode);
  }, []);

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle property updates from panel
  const handleNodeUpdate = useCallback(
    (updatedNode: BotNode) => {
      if (isPreviewMode) return;

      setNodes((nds) =>
        nds.map((node) => (node.id === updatedNode.id ? updatedNode : node))
      );
      setSelectedNode(updatedNode);
      hasUnsavedChanges.current = true;
    },
    [isPreviewMode, setNodes]
  );

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
    <div className='flex h-screen flex-col overflow-hidden'>
      {/* Header */}
      <BotConstructorHeader
        projectId={projectId}
        flows={flows}
        currentFlow={currentFlow}
        selectedFlowId={selectedFlowId}
        onFlowSelect={setSelectedFlowId}
        onFlowCreate={createFlow}
        onFlowLoad={loadFlow}
        onFlowSave={saveFlow} // Manual save
        onFlowDelete={deleteFlow}
        onFlowExport={exportFlow}
        onFlowImport={importFlow}
        isPreviewMode={isPreviewMode}
        onPreviewToggle={togglePreviewMode}
        onFlowPublish={() => {
          // New prop implementation will be handled in next step or internal component update
          // This is a placeholder for the concept
        }}
        isSaving={isSaving}
      />

      {/* Main content */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Toolbar */}
        <BotConstructorToolbar onAddNode={handleAddNode} />

        {/* Canvas */}
        <div className='relative flex-1 overflow-hidden'>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeWithTracking}
            onEdgesChange={onEdgesChangeWithTracking}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition='bottom-left'
            className='h-full w-full'
            nodesDraggable={!isPreviewMode}
            nodesConnectable={!isPreviewMode}
            elementsSelectable={!isPreviewMode} // Optional: allow selection but not editing
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
            <MiniMap />

            {/* Preview mode indicator */}
            {isPreviewMode && (
              <Panel position='top-center'>
                <div className='flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-white shadow-lg'>
                  <span>🧪 Режим предпросмотра</span>
                  <span className='text-xs opacity-75'>
                    (Изменения заблокированы)
                  </span>
                </div>
              </Panel>
            )}

            {/* Unsaved changes indicator (debug or user feedback) */}
            {hasUnsavedChanges.current && !isSaving && (
              <Panel position='bottom-right'>
                <div className='text-muted-foreground bg-background/80 rounded p-1 text-xs'>
                  Unsaved changes...
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Properties panel */}
        {selectedNode && (
          <BotConstructorProperties
            node={selectedNode}
            onNodeUpdate={handleNodeUpdate}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

// Helper functions (kept same as before)
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
