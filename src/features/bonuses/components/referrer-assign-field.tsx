/**
 * @file: src/features/bonuses/components/referrer-assign-field.tsx
 * @description: Поле карточки профиля для ручной привязки реферера ("кто привёл").
 *   Поиск по пользователям проекта + PATCH /users/[userId]/referrer, который
 *   выполняет полную b2b-привязку (referredBy + attribution комиссий).
 * @project: SaaS Bonus System
 * @created: 2026-07-05
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Pencil, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

interface ReferrerAssignFieldProps {
  projectId: string;
  userId: string;
  currentReferrerName?: string | null;
  onAssigned: (referrerName: string | null) => void;
}

interface FoundUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export function ReferrerAssignField({
  projectId,
  userId,
  currentReferrerName,
  onAssigned
}: ReferrerAssignFieldProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/users?search=${encodeURIComponent(q.trim())}&limit=8`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        // Исключаем самого пользователя из кандидатов в рефереры.
        setResults(
          (data.users ?? []).filter((u: FoundUser) => u.id !== userId)
        );
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [projectId, userId]
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 350);
  };

  const assign = async (referrer: FoundUser) => {
    setSavingId(referrer.id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/users/${userId}/referrer`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referrerId: referrer.id })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Не удалось привязать');
      onAssigned(data.referrerName ?? referrer.name ?? null);
      toast({
        title: 'Реферер привязан',
        description: `Приведён: ${data.referrerName ?? referrer.name}`
      });
      setOpen(false);
      setQuery('');
      setResults([]);
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось привязать',
        variant: 'destructive'
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <Label className='text-sm font-medium'>Приведён</Label>
      <div className='flex items-center gap-2'>
        <p className='text-muted-foreground text-sm'>
          {currentReferrerName || 'Не указан'}
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant='ghost' size='icon' className='h-6 w-6'>
              <Pencil className='h-3.5 w-3.5' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-80 p-2' align='start'>
            <div className='relative'>
              <Search className='text-muted-foreground absolute top-2.5 left-2 h-4 w-4' />
              <Input
                autoFocus
                placeholder='Имя, email или телефон реферера…'
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className='pl-8'
              />
            </div>
            <div className='mt-2 max-h-64 overflow-y-auto'>
              {isSearching ? (
                <div className='text-muted-foreground flex items-center justify-center py-4 text-sm'>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Поиск…
                </div>
              ) : query.trim().length < 2 ? (
                <p className='text-muted-foreground py-4 text-center text-xs'>
                  Введите минимум 2 символа
                </p>
              ) : results.length === 0 ? (
                <p className='text-muted-foreground py-4 text-center text-xs'>
                  Никого не найдено
                </p>
              ) : (
                <ul className='space-y-1'>
                  {results.map((u) => (
                    <li key={u.id}>
                      <button
                        type='button'
                        disabled={savingId !== null}
                        onClick={() => assign(u)}
                        className='hover:bg-muted flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm disabled:opacity-50'
                      >
                        <span className='min-w-0 flex-1 truncate'>
                          <span className='font-medium'>{u.name}</span>
                          {(u.email || u.phone) && (
                            <span className='text-muted-foreground ml-1 text-xs'>
                              {u.email || u.phone}
                            </span>
                          )}
                        </span>
                        {savingId === u.id && (
                          <Loader2 className='ml-2 h-3.5 w-3.5 animate-spin' />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
