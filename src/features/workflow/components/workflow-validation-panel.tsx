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
    <Card className={`${className} max-w-md`}>
      <CardContent className='flex items-center gap-2 p-2'>
        <div className='flex items-center gap-1.5 flex-shrink-0'>
          {hasErrors ? (
            <AlertTriangle className='h-3 w-3 text-amber-500' />
          ) : (
            <CheckCircle2 className='h-3 w-3 text-emerald-500' />
          )}
          <span className='text-[10px] font-semibold uppercase text-muted-foreground whitespace-nowrap'>Валидация</span>
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-[10px] text-muted-foreground truncate' title={headline}>
            {headline}
          </p>
        </div>
        {(result?.errors ?? []).length > 0 && (
          <div className='flex items-center gap-1 flex-shrink-0'>
            <ScrollArea className='max-w-[200px]'>
              <div className='flex items-center gap-1.5'>
                {result!.errors.slice(0, 3).map((error, index) => (
                  <ValidationItem key={`${error.nodeId ?? 'generic'}-${index}`} error={error} onFocusNode={onFocusNode} />
                ))}
                {(result!.errors.length > 3) && (
                  <Badge variant='outline' className='text-[10px] h-4 px-1'>
                    +{result!.errors.length - 3}
                  </Badge>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ValidationItem({ error, onFocusNode }: { error: WorkflowValidationError; onFocusNode?: (nodeId: string) => void }) {
  const isWarning = error.type === 'warning';

  return (
    <div className='flex items-center gap-1 rounded-md border border-dashed bg-background px-1.5 py-0.5'>
      <Badge variant={isWarning ? 'outline' : 'destructive'} className='uppercase text-[10px] h-3 px-1'>
        {isWarning ? 'W' : 'E'}
      </Badge>
      {error.nodeId && onFocusNode ? (
        <Button
          size='sm'
          variant='ghost'
          onClick={() => onFocusNode(error.nodeId!)}
          className='h-3 w-3 p-0 flex-shrink-0'
          title={error.message}
        >
          <Target className='h-2 w-2' />
        </Button>
      ) : (
        <span className='text-[10px] text-muted-foreground truncate max-w-[60px]' title={error.message}>
          {error.nodeId || 'Error'}
        </span>
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

