'use client';

import Link from 'next/link';
import { ClipboardMinus, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MarkingOperationsLinks({
  projectId,
  active
}: {
  projectId: string;
  active: 'write-offs' | 'reconciliation';
}) {
  return (
    <nav
      className='flex flex-wrap gap-2'
      aria-label='Операции с маркированным товаром'
    >
      <Button
        variant={active === 'write-offs' ? 'secondary' : 'outline'}
        className={cn(active === 'write-offs' && 'font-semibold')}
        asChild
      >
        <Link href={`/dashboard/projects/${projectId}/write-offs`}>
          <ClipboardMinus />
          Списания
        </Link>
      </Button>
      <Button
        variant={active === 'reconciliation' ? 'secondary' : 'outline'}
        className={cn(active === 'reconciliation' && 'font-semibold')}
        asChild
      >
        <Link href={`/dashboard/projects/${projectId}/reconciliation`}>
          <Scale />
          Сверка
        </Link>
      </Button>
    </nav>
  );
}
