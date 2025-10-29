/**
 * @file: workflow-validation-panel.tsx
 * @description: Панель отображения ошибок валидации workflow
 * @project: SaaS Bonus System
 * @created: 2025-10-25
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle2, Info, Target } from 'lucide-react';
import type { WorkflowValidationResult, WorkflowValidationError } from '@/lib/services/workflow/workflow-validator';

interface WorkflowValidationPanelProps {
  result: WorkflowValidationResult | null;
  onFocusNode?: (nodeId: string) => void;
  className?: string;
}

export function WorkflowValidationPanel({ result, onFocusNode, className }: WorkflowValidationPanelProps) {
  const hasErrors = (result?.errors ?? []).some((error) => error.type === 'error');
  const headline = getHeadline(result);

  return (
    <Card className={className}>
      <CardHeader className='pb-1 pt-2'>
        <CardTitle className='flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground'>
          {hasErrors ? (
            <AlertTriangle className='h-3 w-3 text-amber-500' />
          ) : (
            <CheckCircle2 className='h-3 w-3 text-emerald-500' />
          )}
          Валидация
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className='space-y-2 pt-2 pb-2'>
        <p className='flex items-center gap-1 text-xs text-muted-foreground'>
          <Info className='h-3 w-3 flex-shrink-0' />
          <span className='line-clamp-2'>{headline}</span>
        </p>

        <ScrollArea className='max-h-32 rounded-md border bg-muted/20 p-2'>
          <div className='space-y-1 text-xs'>
            {(result?.errors ?? []).length === 0 ? (
              <p className='text-muted-foreground text-xs'>Ошибок нет</p>
            ) : (
              result!.errors.map((error, index) => (
                <ValidationItem key={`${error.nodeId ?? 'generic'}-${index}`} error={error} onFocusNode={onFocusNode} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function ValidationItem({ error, onFocusNode }: { error: WorkflowValidationError; onFocusNode?: (nodeId: string) => void }) {
  const isWarning = error.type === 'warning';

  return (
    <div className='flex items-start justify-between gap-2 rounded-md border border-dashed bg-background px-2 py-1.5'>
      <div className='flex flex-col gap-0.5 min-w-0 flex-1'>
        <div className='flex items-center gap-1'>
          <Badge variant={isWarning ? 'outline' : 'destructive'} className='uppercase text-[10px] h-4 px-1'>
            {isWarning ? 'Warn' : 'Error'}
          </Badge>
          {error.nodeId && (
            <span className='text-[10px] text-muted-foreground truncate'>{error.nodeId}</span>
          )}
        </div>
        <p className='text-xs leading-tight line-clamp-2'>{error.message}</p>
      </div>

      {error.nodeId && onFocusNode && (
        <Button
          size='sm'
          variant='ghost'
          onClick={() => onFocusNode(error.nodeId!)}
          className='flex items-center gap-1 h-6 px-2 flex-shrink-0'
        >
          <Target className='h-3 w-3' />
        </Button>
      )}
    </div>
  );
}

function getHeadline(result: WorkflowValidationResult | null): string {
  if (!result) {
    return 'Валидация выполняется...';
  }

  if (result.errors.length === 0) {
    return 'Настройка выглядит корректно.';
  }

  const criticalCount = result.errors.filter((error) => error.type === 'error').length;
  const warningCount = result.errors.filter((error) => error.type === 'warning').length;

  if (criticalCount > 0) {
    return `Найдено ${criticalCount} критических ошибок и ${warningCount} предупреждений.`;
  }

  return `Найдено ${warningCount} предупреждений.`;
}

