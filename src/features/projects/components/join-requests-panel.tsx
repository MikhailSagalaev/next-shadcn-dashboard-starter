/**
 * @file: src/features/projects/components/join-requests-panel.tsx
 * @description: Заявки на вступление в b2b-команду — админ может одобрить
 *   или отклонить заявку сам, если реферер (менеджер/директор) не может
 *   сделать это в Telegram-боте. Раньше единственный путь — бот; заявка
 *   зависала в PENDING без альтернативы в дашборде.
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PartnerRoleBadge } from '@/features/bonuses/components/partner-role-badge';
import { useToast } from '@/hooks/use-toast';

interface JoinRequestUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  partnerRole?: string;
}

interface JoinRequestRow {
  id: string;
  userId: string;
  referrerId: string;
  organizationId: string | null;
  createdAt: string;
  user: JoinRequestUser | null;
  referrer: JoinRequestUser | null;
  organization: { id: string; name: string } | null;
}

function displayName(u: JoinRequestUser | null): string {
  if (!u) return 'Неизвестно';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || u.phone || u.id.slice(0, 8);
}

export function JoinRequestsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/join-requests?status=PENDING`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const data = await res.json();
      setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (requestId: string, action: 'approve' | 'reject') => {
    setActingId(requestId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/join-requests/${requestId}/${action}`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || 'Не удалось обработать заявку');
      toast({
        title: action === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена',
        description:
          action === 'approve'
            ? 'Уведомления отправлены и рефереру, и заявителю.'
            : 'Заявитель получил уведомление об отказе.'
      });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось',
        variant: 'destructive'
      });
    } finally {
      setActingId(null);
    }
  };

  if (loading || requests.length === 0) return null;

  return (
    <Card className='border-amber-200 dark:border-amber-800'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <UserPlus className='h-4 w-4' />
          Заявки на вступление ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {requests.map((r) => (
          <div
            key={r.id}
            className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'
          >
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <span className='font-medium'>{displayName(r.user)}</span>
                <span className='text-muted-foreground text-xs'>
                  хочет присоединиться к
                </span>
                <span className='font-medium'>{displayName(r.referrer)}</span>
                <PartnerRoleBadge role={r.referrer?.partnerRole} />
              </div>
              <p className='text-muted-foreground text-xs'>
                {r.organization ? `Сеть: ${r.organization.name} · ` : ''}
                {new Date(r.createdAt).toLocaleString('ru-RU')}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                disabled={actingId === r.id}
                onClick={() => act(r.id, 'reject')}
              >
                {actingId === r.id ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <X className='h-4 w-4' />
                )}
                Отклонить
              </Button>
              <Button
                size='sm'
                disabled={actingId === r.id}
                onClick={() => act(r.id, 'approve')}
              >
                {actingId === r.id ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Check className='mr-2 h-4 w-4' />
                )}
                Одобрить
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
