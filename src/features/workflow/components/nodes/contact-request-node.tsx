/**
 * @file: src/features/workflow/components/nodes/contact-request-node.tsx
 * @description: Компонент для ноды запроса контакта
 * @project: SaaS Bonus System
 * @dependencies: React Flow, shadcn/ui
 * @created: 2025-10-21
 * @author: AI Assistant + User
 */

'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, User } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

interface ContactRequestNodeProps extends NodeProps {
  data: WorkflowNodeData;
}

export function ContactRequestNode({ data, selected }: ContactRequestNodeProps) {
  return (
    <Card className={`w-64 transition-all ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="p-1 rounded bg-emerald-100 text-emerald-600">
            <Phone className="h-3 w-3" />
          </div>
          Запрос контакта
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>Ждёт контакт от пользователя</span>
          </div>
          <div className="text-xs bg-muted px-2 py-1 rounded">
            После получения контакта workflow продолжится
          </div>
        </div>
      </CardContent>

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 !bg-muted-foreground"
      />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 !bg-muted-foreground"
      />
    </Card>
  );
}
