/**
 * @file: partner-user-combobox.tsx
 * @description: Searchable combobox для выбора пользователя-партнёра проекта.
 *               Используется в `referral-commission-plans-panel` для назначения
 *               outbound-плана конкретному тренеру/менеджеру/руководителю.
 *               Поиск debounced 300ms через
 *               GET /api/projects/{id}/users?search={q}&role=TRAINER,MANAGER,DIRECTOR.
 *               (b2b-referral-hierarchy Phase 6.1–6.3)
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui Command + Popover, useDebouncedCallback
 * @created: 2026-05-24
 * @author: AI Assistant + User
 */

'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, Search, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { PartnerRoleBadge } from '@/features/bonuses/components/partner-role-badge';

export type PartnerUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  partnerRole: string;
  outboundReferralPlanId: string | null;
};

interface PartnerUserComboboxProps {
  projectId: string;
  /** Текущий выбранный userId (или пустая строка). */
  value: string;
  /** Уже известные данные выбранного пользователя (без лишнего запроса). */
  initialUser?: PartnerUser | null;
  /** Ограниченный локальный список, например участники одной организации. */
  options?: PartnerUser[];
  /** Колбэк при выборе/очистке (передаёт обогащённого пользователя для UI). */
  onChange: (user: PartnerUser | null) => void;
  /** Включить роль-фильтр (только партнёры). По умолчанию true. */
  partnerRolesOnly?: boolean;
  /**
   * Маппинг planId → planName. Нужен, чтобы под именем пользователя
   * показывать текущий outbound-план (Phase 6.3).
   */
  planNameById?: Record<string, string>;
  disabled?: boolean;
  className?: string;
  /** Плейсхолдер кнопки когда нет выбранного пользователя. */
  placeholder?: string;
}

const FETCH_LIMIT = 20;

type UsersApiResponse = {
  users?: Record<string, unknown>[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
};

/**
 * Поиск + выбор пользователя проекта с фильтром по партнёрской роли.
 * Возвращает обогащённый объект через `onChange`. Если убрать выбор — `null`.
 */
function mapApiUser(
  raw: Record<string, unknown>,
  fallbackId?: string
): PartnerUser {
  const firstName = (raw.firstName as string | null | undefined) ?? '';
  const lastName = (raw.lastName as string | null | undefined) ?? '';
  const email = (raw.email as string | null | undefined) ?? null;
  const phone = (raw.phone as string | null | undefined) ?? null;
  const id = (raw.id as string | undefined) ?? fallbackId ?? '';

  return {
    id,
    name:
      (raw.name as string | undefined) ||
      `${firstName} ${lastName}`.trim() ||
      email ||
      phone ||
      id,
    email,
    phone,
    partnerRole: (raw.partnerRole as string | undefined) ?? 'CLIENT',
    outboundReferralPlanId:
      (raw.outboundReferralPlanId as string | null | undefined) ?? null
  };
}

export function PartnerUserCombobox({
  projectId,
  value,
  initialUser,
  options,
  onChange,
  partnerRolesOnly = true,
  planNameById,
  disabled,
  className,
  placeholder = 'Выберите партнёра…'
}: PartnerUserComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<PartnerUser[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [selected, setSelected] = React.useState<PartnerUser | null>(null);
  const searchRequestIdRef = React.useRef(0);
  const loadMoreRequestIdRef = React.useRef(0);
  const activeQueryRef = React.useRef('');

  const fetchUsers = React.useCallback(
    async (search: string, requestedPage: number, append: boolean) => {
      const normalizedSearch = search.trim();
      const requestId = append
        ? ++loadMoreRequestIdRef.current
        : ++searchRequestIdRef.current;

      if (append) {
        setLoadingMore(true);
      } else {
        loadMoreRequestIdRef.current += 1;
        activeQueryRef.current = normalizedSearch;
        setLoading(true);
      }

      const isCurrentRequest = () =>
        activeQueryRef.current === normalizedSearch &&
        (append
          ? requestId === loadMoreRequestIdRef.current
          : requestId === searchRequestIdRef.current);

      try {
        if (options) {
          const normalizedQuery = normalizedSearch.toLocaleLowerCase('ru-RU');
          const filtered = options.filter((user) =>
            [user.name, user.email, user.phone, user.id].some((value) =>
              value?.toLocaleLowerCase('ru-RU').includes(normalizedQuery)
            )
          );
          const start = (requestedPage - 1) * FETCH_LIMIT;
          const users = filtered.slice(start, start + FETCH_LIMIT);
          if (!isCurrentRequest()) return;
          setItems((current) => {
            if (!append) return users;
            const byId = new Map(current.map((user) => [user.id, user]));
            users.forEach((user) => byId.set(user.id, user));
            return Array.from(byId.values());
          });
          setPage(requestedPage);
          setTotal(filtered.length);
          setTotalPages(Math.max(1, Math.ceil(filtered.length / FETCH_LIMIT)));
          setHasMore(start + users.length < filtered.length);
          return;
        }

        const params = new URLSearchParams({
          includeStats: 'false',
          limit: String(FETCH_LIMIT),
          page: String(requestedPage)
        });
        if (normalizedSearch) params.set('search', normalizedSearch);
        if (partnerRolesOnly) params.set('role', 'TRAINER,MANAGER,DIRECTOR');

        const res = await fetch(
          `/api/projects/${projectId}/users?${params.toString()}`
        );
        if (!res.ok) throw new Error('Failed to load users');

        const data = (await res.json()) as UsersApiResponse;
        const users = Array.isArray(data.users)
          ? data.users.map((user) => mapApiUser(user))
          : [];
        const responsePage = data.pagination?.page ?? requestedPage;
        const responseTotal = data.pagination?.total ?? users.length;
        const responseTotalPages = Math.max(1, data.pagination?.pages ?? 1);

        if (!isCurrentRequest()) return;

        setItems((current) => {
          if (!append) return users;
          const byId = new Map(current.map((user) => [user.id, user]));
          users.forEach((user) => byId.set(user.id, user));
          return Array.from(byId.values());
        });
        setPage(responsePage);
        setTotal(responseTotal);
        setTotalPages(responseTotalPages);
        setHasMore(responsePage < responseTotalPages);
      } catch {
        if (!isCurrentRequest()) return;
        if (!append) {
          setItems([]);
          setPage(1);
          setTotal(0);
          setTotalPages(1);
          setHasMore(false);
        }
      } finally {
        if (!isCurrentRequest()) return;
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [options, projectId, partnerRolesOnly]
  );

  const debouncedFetch = useDebouncedCallback(
    (search: string) => fetchUsers(search, 1, false),
    300
  );

  React.useEffect(() => {
    if (!open) return;

    searchRequestIdRef.current += 1;
    loadMoreRequestIdRef.current += 1;
    activeQueryRef.current = query.trim();
    setItems([]);
    setPage(1);
    setTotal(0);
    setTotalPages(1);
    setHasMore(false);
    setLoadingMore(false);
    debouncedFetch(query);
  }, [open, query, debouncedFetch]);

  const loadMore = React.useCallback(() => {
    if (loading || loadingMore || !hasMore || page >= totalPages) return;
    void fetchUsers(query, page + 1, true);
  }, [fetchUsers, hasMore, loading, loadingMore, page, query, totalPages]);

  // Если есть value, но нет данных о выбранном пользователе — догружаем профиль.
  React.useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (initialUser?.id === value) {
      setSelected(initialUser);
      return;
    }
    if (selected?.id === value) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/users/${value}`
        ).catch(() => null);
        if (!res || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const raw = (data.user ?? data) as Record<string, unknown>;
        setSelected(mapApiUser(raw, value));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, projectId, selected?.id, initialUser]);

  const handleSelect = (user: PartnerUser) => {
    setSelected(user);
    onChange(user);
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSelected(null);
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-[320px] justify-between text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className='flex min-w-0 flex-1 items-center gap-2'>
            {selected ? (
              <>
                <User className='h-4 w-4 shrink-0 opacity-60' />
                <span className='truncate'>{selected.name}</span>
                <PartnerRoleBadge role={selected.partnerRole} />
              </>
            ) : (
              <>
                <Search className='h-4 w-4 shrink-0 opacity-60' />
                <span className='truncate'>{placeholder}</span>
              </>
            )}
          </span>
          {selected ? (
            <span
              role='button'
              tabIndex={0}
              onClick={handleClear}
              className='hover:text-foreground text-muted-foreground ml-2 text-xs'
            >
              Сбросить
            </span>
          ) : (
            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='max-h-[min(50dvh,24rem)] w-[min(360px,calc(100vw-2rem))] overflow-hidden p-0'
        align='start'
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='Поиск по имени, email, телефону…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className='max-h-[min(50dvh,22rem)] overflow-y-auto'>
            {loading && (
              <div className='text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Поиск…
              </div>
            )}
            {!loading && items.length === 0 && (
              <CommandEmpty>
                {query
                  ? 'Никого не нашли по запросу'
                  : 'Начните вводить имя или телефон'}
              </CommandEmpty>
            )}
            {items.length > 0 && (
              <CommandGroup
                heading={partnerRolesOnly ? 'Партнёры' : 'Пользователи'}
              >
                {items.map((u) => {
                  const planName =
                    u.outboundReferralPlanId && planNameById
                      ? planNameById[u.outboundReferralPlanId]
                      : null;
                  const isSelected = selected?.id === u.id;
                  return (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      onSelect={() => handleSelect(u)}
                      className='flex items-start gap-2'
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                        <div className='flex items-center gap-2'>
                          <span className='truncate font-medium'>{u.name}</span>
                          <PartnerRoleBadge role={u.partnerRole} />
                        </div>
                        <div className='text-muted-foreground truncate text-xs'>
                          {u.email || u.phone || u.id}
                        </div>
                        {planName ? (
                          <div className='text-muted-foreground text-xs'>
                            <span className='font-medium'>Текущий план:</span>{' '}
                            {planName}
                          </div>
                        ) : u.outboundReferralPlanId ? (
                          <div className='text-muted-foreground text-xs'>
                            <span className='font-medium'>Текущий план:</span>{' '}
                            (есть назначение)
                          </div>
                        ) : (
                          <div className='text-muted-foreground/70 text-xs italic'>
                            план не назначен
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
                {hasMore && page < totalPages && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='mt-1 w-full'
                    disabled={loadingMore}
                    onClick={loadMore}
                  >
                    {loadingMore && <Loader2 className='animate-spin' />}
                    {loadingMore
                      ? 'Загрузка…'
                      : `Показать ещё (${items.length} из ${total})`}
                  </Button>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
