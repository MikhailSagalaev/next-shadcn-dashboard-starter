/**
 * @file: src/features/workflow/components/step-inspector.tsx
 * @description: Компонент инспектора шага выполнения с полным payload
 * @project: SaaS Bonus System
 * @dependencies: React, Shadcn UI
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Copy,
  Check,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Globe,
  Variable,
  FileJson
} from 'lucide-react';

interface StepData {
  id: string;
  step: number;
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  message?: string;
  data?: any;
  variables?: Record<string, any>;
  inputData?: any;
  outputData?: any;
  variablesBefore?: Record<string, any>;
  variablesAfter?: Record<string, any>;
  httpRequest?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  httpResponse?: {
    status: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

interface StepInspectorProps {
  step: StepData;
  onRestart?: (nodeId: string) => void;
  onClose?: () => void;
}

function JsonViewer({
  data,
  maxHeight = '300px'
}: {
  data: any;
  maxHeight?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (data === null || data === undefined) {
    return <div className='text-muted-foreground italic'>Нет данных</div>;
  }

  return (
    <div className='relative'>
      <Button
        variant='ghost'
        size='icon'
        className='absolute top-2 right-2 z-10'
        onClick={handleCopy}
      >
        {copied ? (
          <Check className='h-4 w-4 text-green-500' />
        ) : (
          <Copy className='h-4 w-4' />
        )}
      </Button>
      <ScrollArea
        style={{ maxHeight }}
        className='bg-muted/30 rounded-md border p-4'
      >
        <pre className='font-mono text-xs break-all whitespace-pre-wrap'>
          {JSON.stringify(data, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
}

export function StepInspector({
  step,
  onRestart,
  onClose
}: StepInspectorProps) {
  const [activeTab, setActiveTab] = useState('input');

  const getStatusColor = (status: StepData['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'running':
        return 'bg-blue-500';
      case 'skipped':
        return 'bg-gray-400';
      default:
        return 'bg-yellow-500';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const hasHttpData = step.httpRequest || step.httpResponse;
  const hasError = step.error || step.status === 'error';

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between border-b p-4'>
        <div className='flex items-center gap-3'>
          <span
            className={`h-3 w-3 rounded-full ${getStatusColor(step.status)}`}
          />
          <div>
            <h3 className='font-semibold'>{step.nodeLabel || step.nodeId}</h3>
            <p className='text-muted-foreground text-sm'>{step.nodeType}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>Шаг {step.step}</Badge>
          <Badge variant='outline'>{formatDuration(step.duration)}</Badge>
          {onRestart && step.status !== 'running' && (
            <Button
              variant='outline'
              size='sm'
              onClick={() => onRestart(step.nodeId)}
            >
              <RotateCcw className='mr-1 h-4 w-4' />
              Перезапустить
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='flex flex-1 flex-col'
      >
        <TabsList className='mx-4 mt-4'>
          <TabsTrigger value='input' className='flex items-center gap-1'>
            <ArrowRight className='h-3 w-3' />
            Input
          </TabsTrigger>
          <TabsTrigger value='output' className='flex items-center gap-1'>
            <ArrowLeft className='h-3 w-3' />
            Output
          </TabsTrigger>
          <TabsTrigger value='variables' className='flex items-center gap-1'>
            <Variable className='h-3 w-3' />
            Variables
          </TabsTrigger>
          {hasHttpData && (
            <TabsTrigger value='http' className='flex items-center gap-1'>
              <Globe className='h-3 w-3' />
              HTTP
            </TabsTrigger>
          )}
          {hasError && (
            <TabsTrigger
              value='error'
              className='flex items-center gap-1 text-red-500'
            >
              <AlertCircle className='h-3 w-3' />
              Error
            </TabsTrigger>
          )}
        </TabsList>

        <div className='flex-1 overflow-auto p-4'>
          <TabsContent value='input' className='mt-0'>
            <h4 className='mb-2 text-sm font-medium'>Входные данные</h4>
            <JsonViewer data={step.inputData || step.data} />
          </TabsContent>

          <TabsContent value='output' className='mt-0'>
            <h4 className='mb-2 text-sm font-medium'>Выходные данные</h4>
            <JsonViewer data={step.outputData} />
          </TabsContent>

          <TabsContent value='variables' className='mt-0 space-y-4'>
            <div>
              <h4 className='mb-2 text-sm font-medium'>До выполнения</h4>
              <JsonViewer
                data={step.variablesBefore || step.variables}
                maxHeight='200px'
              />
            </div>
            <div>
              <h4 className='mb-2 text-sm font-medium'>После выполнения</h4>
              <JsonViewer data={step.variablesAfter} maxHeight='200px' />
            </div>
          </TabsContent>

          {hasHttpData && (
            <TabsContent value='http' className='mt-0 space-y-4'>
              {step.httpRequest && (
                <div>
                  <h4 className='mb-2 flex items-center gap-2 text-sm font-medium'>
                    <Badge>{step.httpRequest.method}</Badge>
                    Request
                  </h4>
                  <div className='bg-muted mb-2 rounded p-2 font-mono text-xs'>
                    {step.httpRequest.url}
                  </div>
                  <JsonViewer data={step.httpRequest} maxHeight='200px' />
                </div>
              )}
              {step.httpResponse && (
                <div>
                  <h4 className='mb-2 flex items-center gap-2 text-sm font-medium'>
                    <Badge
                      variant={
                        step.httpResponse.status < 400
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {step.httpResponse.status}
                    </Badge>
                    Response
                  </h4>
                  <JsonViewer data={step.httpResponse} maxHeight='200px' />
                </div>
              )}
            </TabsContent>
          )}

          {hasError && (
            <TabsContent value='error' className='mt-0'>
              <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20'>
                <h4 className='mb-2 text-sm font-medium text-red-700 dark:text-red-400'>
                  {step.error?.code || 'Error'}
                </h4>
                <p className='mb-4 text-sm text-red-600 dark:text-red-300'>
                  {step.error?.message || step.message}
                </p>
                {step.error?.stack && (
                  <ScrollArea className='max-h-[200px]'>
                    <pre className='font-mono text-xs whitespace-pre-wrap text-red-500'>
                      {step.error.stack}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
