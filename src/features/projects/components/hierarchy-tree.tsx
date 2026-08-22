/**
 * @file: src/features/projects/components/hierarchy-tree.tsx
 * @description: Client Component — отображение партнёрского дерева на
 *               странице `/dashboard/projects/[id]/referral/hierarchy`.
 *               (b2b-referral-hierarchy Phase 6.9–6.11, 6.14)
 *
 *               Принимает плоский массив `HierarchyNode` от data-access,
 *               собирает дерево по `parentId`, рендерит сортируемую таблицу с
 *               раскрываемыми уровнями.
 *
 *               Возможности:
 *                 - Period selector (today / 7d / 30d / all) с обновлением URL
 *                 - Поиск по name/email/phone с подсветкой и
 *                   автораскрытием цепочки родителей
 *                 - Кнопка экспорта CSV
 *                 - Per-node агрегаты: direct, subtree size, purchases,
 *                   net referral bonuses
 *
 *               НЕ переиспользуем `ReferralTree` напрямую (он завязан на
 *               отдельную пагинированную загрузку через `loadingIds` и
 *               specific-shape `ReferralUser` из user-referrals-display).
 *               Здесь дерево уже целиком на руках, простой рекурсивный
 *               рендер достаточен.
 *
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui, framer-motion (опционально), composite EmptyState
 * @created: 2026-05-24
 * @author: AI Assistant + User
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Download,
  Mail,
  Phone,
  Search,
  ShoppingBag,
  Users,
  Wallet
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/composite';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PartnerRoleBadge } from '@/features/bonuses/components/partner-role-badge';
import type {
  HierarchyNode,
  HierarchyPeriod
} from '@/app/dashboard/projects/[id]/referral/hierarchy/data-access';

interface HierarchyTreeProps {
  projectId: string;
  nodes: HierarchyNode[];
  rootIds: string[];
  period: HierarchyPeriod;
  organizationId?: string | null;
  onPeriodChange: (period: HierarchyPeriod) => void;
}

const PERIOD_LABEL: Record<HierarchyPeriod, string> = {
  today: 'Сегодня',
  '7d': 'Последние 7 дней',
  '30d': 'Последние 30 дней',
  all: 'Всё время'
};

const formatRub = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(n);

interface ChildrenIndex {
  byParent: Map<string, HierarchyNode[]>;
  byId: Map<string, HierarchyNode>;
  parentOf: Map<string, string | null>;
}

type HierarchySortField =
  | 'name'
  | 'registeredAt'
  | 'directCount'
  | 'totalPurchasesPeriod'
  | 'commissionEarned';
type SortOrder = 'asc' | 'desc';

function compareNodes(
  left: HierarchyNode,
  right: HierarchyNode,
  field: HierarchySortField,
  order: SortOrder
) {
  let result = 0;
  if (field === 'name') {
    result = left.name.localeCompare(right.name, 'ru-RU');
  } else if (field === 'registeredAt') {
    result =
      new Date(left.registeredAt).getTime() -
      new Date(right.registeredAt).getTime();
  } else {
    result = left[field] - right[field];
  }
  if (result === 0) result = left.name.localeCompare(right.name, 'ru-RU');
  return order === 'asc' ? result : -result;
}

function buildIndex(
  nodes: HierarchyNode[],
  sortField: HierarchySortField,
  sortOrder: SortOrder
): ChildrenIndex {
  const byParent = new Map<string, HierarchyNode[]>();
  const byId = new Map<string, HierarchyNode>();
  const parentOf = new Map<string, string | null>();
  for (const n of nodes) {
    byId.set(n.id, n);
    parentOf.set(n.id, n.parentId);
    const key = n.parentId ?? '__root__';
    const arr = byParent.get(key) ?? [];
    arr.push(n);
    byParent.set(key, arr);
  }
  for (const children of byParent.values()) {
    children.sort((left, right) =>
      compareNodes(left, right, sortField, sortOrder)
    );
  }
  return { byParent, byId, parentOf };
}

/**
 * Подсветка совпадений в строке без `dangerouslySetInnerHTML`.
 */
function Highlight({
  text,
  query
}: {
  text: string;
  query: string;
}): React.ReactElement {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className='rounded bg-yellow-200 px-0.5 dark:bg-yellow-700/40'>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface NodeRowProps {
  node: HierarchyNode;
  hasChildren: boolean;
  isExpanded: boolean;
  isHighlighted: boolean;
  query: string;
  onToggle: () => void;
  depth: number;
}

function NodeRow({
  node,
  hasChildren,
  isExpanded,
  isHighlighted,
  query,
  onToggle,
  depth
}: NodeRowProps) {
  return (
    <TableRow
      className={
        isHighlighted ? 'bg-amber-50/60 dark:bg-amber-900/20' : undefined
      }
    >
      <TableCell className='min-w-[320px] whitespace-normal'>
        <div
          className='flex min-w-0 items-start gap-2'
          style={{ paddingInlineStart: `${depth * 16}px` }}
        >
          <button
            type='button'
            onClick={onToggle}
            disabled={!hasChildren}
            aria-label={`${isExpanded ? 'Свернуть' : 'Развернуть'} ветку: ${node.name}`}
            aria-expanded={hasChildren ? isExpanded : undefined}
            className='text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-30'
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className='h-4 w-4' aria-hidden='true' />
              ) : (
                <ChevronRight className='h-4 w-4' aria-hidden='true' />
              )
            ) : (
              <span className='inline-block h-4 w-4' />
            )}
          </button>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-medium'>
                <Highlight text={node.name} query={query} />
              </span>
              {node.organizationTitle ? (
                <Badge variant='outline'>{node.organizationTitle}</Badge>
              ) : node.organizationLevel ? (
                <Badge variant='outline'>
                  Уровень {node.organizationLevel}
                </Badge>
              ) : (
                <PartnerRoleBadge role={node.partnerRole} />
              )}
              {node.canManageOrganization && (
                <Badge variant='secondary'>Управляющий</Badge>
              )}
            </div>
            <div className='text-muted-foreground mt-0.5 flex flex-wrap gap-3 text-xs'>
              {node.email && (
                <span className='inline-flex items-center gap-1'>
                  <Mail className='h-3 w-3' aria-hidden='true' />
                  <Highlight text={node.email} query={query} />
                </span>
              )}
              {node.phone && (
                <span className='inline-flex items-center gap-1'>
                  <Phone className='h-3 w-3' aria-hidden='true' />
                  <Highlight text={node.phone} query={query} />
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground tabular-nums'>
        {new Date(node.registeredAt).toLocaleDateString('ru-RU')}
      </TableCell>
      <TableCell className='max-w-[280px] whitespace-normal'>
        {node.referrerLinks.length > 0 ? (
          <div className='space-y-1 text-xs'>
            {node.referrerLinks.map((link) => (
              <div key={link.referrerId}>
                {link.referrerName} · {link.sharePercent}%
                {link.isPrimary ? ' · основной' : ''}
              </div>
            ))}
          </div>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className='text-right'>
        <Badge variant='secondary' className='gap-1 tabular-nums'>
          <Users className='h-3 w-3' aria-hidden='true' />
          {node.directCount}
          <span className='text-muted-foreground'>/{node.subtreeSize}</span>
        </Badge>
      </TableCell>
      <TableCell className='text-right font-medium tabular-nums'>
        <span className='inline-flex items-center gap-1'>
          <ShoppingBag
            className='text-muted-foreground h-3.5 w-3.5'
            aria-hidden='true'
          />
          {formatRub(node.totalPurchasesPeriod)}
        </span>
      </TableCell>
      <TableCell className='text-right font-medium tabular-nums'>
        <span className='inline-flex items-center gap-1'>
          <Wallet
            className='text-muted-foreground h-3.5 w-3.5'
            aria-hidden='true'
          />
          {formatRub(node.commissionEarned)}
        </span>
      </TableCell>
    </TableRow>
  );
}

function SortableHierarchyHead({
  field,
  label,
  activeField,
  order,
  align = 'start',
  onSort
}: {
  field: HierarchySortField;
  label: string;
  activeField: HierarchySortField;
  order: SortOrder;
  align?: 'start' | 'end';
  onSort: (field: HierarchySortField) => void;
}) {
  const active = field === activeField;
  const Icon = active ? (order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead
      className={align === 'end' ? 'text-right' : undefined}
      aria-sort={
        active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className={`h-8 px-2 ${align === 'end' ? 'ml-auto' : '-ml-2'} ${
          active ? 'font-semibold' : ''
        }`}
        onClick={() => onSort(field)}
        aria-label={`${label}: сортировать ${
          active && order === 'asc' ? 'по убыванию' : 'по возрастанию'
        }`}
      >
        {label}
        <Icon
          className={`ml-1.5 h-3.5 w-3.5 ${active ? '' : 'opacity-40'}`}
          aria-hidden='true'
        />
      </Button>
    </TableHead>
  );
}

export function HierarchyTree({
  projectId,
  nodes,
  rootIds,
  period,
  organizationId,
  onPeriodChange
}: HierarchyTreeProps) {
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sortField, setSortField] =
    React.useState<HierarchySortField>('registeredAt');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const index = React.useMemo(
    () => buildIndex(nodes, sortField, sortOrder),
    [nodes, sortField, sortOrder]
  );

  /**
   * При наличии поиска — собираем set матчей и всех их предков, чтобы
   * автоматически раскрыть цепочку (Phase 6.11).
   */
  const { matchedIds, expandedAuto } = React.useMemo(() => {
    if (!debouncedSearch) {
      return {
        matchedIds: new Set<string>(),
        expandedAuto: new Set<string>()
      };
    }
    const q = debouncedSearch.toLowerCase();
    const matched = new Set<string>();
    for (const n of nodes) {
      const haystack =
        `${n.name} ${n.email ?? ''} ${n.phone ?? ''}`.toLowerCase();
      if (haystack.includes(q)) matched.add(n.id);
    }
    const auto = new Set<string>();
    for (const id of matched) {
      let cursor: string | null = index.parentOf.get(id) ?? null;
      let safety = 0;
      while (cursor && safety < 20) {
        auto.add(cursor);
        cursor = index.parentOf.get(cursor) ?? null;
        safety += 1;
      }
    }
    return { matchedIds: matched, expandedAuto: auto };
  }, [debouncedSearch, nodes, index.parentOf]);

  // Manual expand state (click). Совмещается с авто-раскрытием от поиска.
  const [manualExpanded, setManualExpanded] = React.useState<Set<string>>(
    () => new Set(rootIds) // По умолчанию корни раскрыты.
  );

  React.useEffect(() => {
    setManualExpanded((current) => new Set([...current, ...rootIds]));
  }, [rootIds]);

  const toggleId = (id: string) => {
    setManualExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set('period', period);
    if (organizationId) params.set('organizationId', organizationId);
    const url = `/api/projects/${projectId}/hierarchy/export?${params.toString()}`;
    window.location.href = url;
  };
  const handleSort = (field: HierarchySortField) => {
    if (field === sortField) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortOrder(field === 'name' ? 'asc' : 'desc');
  };

  const visibleRows = React.useMemo(() => {
    const rows: Array<{
      node: HierarchyNode;
      depth: number;
      hasChildren: boolean;
      expanded: boolean;
    }> = [];
    const searchVisibleIds = debouncedSearch
      ? new Set([...matchedIds, ...expandedAuto])
      : null;
    const visit = (node: HierarchyNode, depth: number) => {
      if (searchVisibleIds && !searchVisibleIds.has(node.id)) return;
      const children = index.byParent.get(node.id) ?? [];
      const expanded = manualExpanded.has(node.id) || expandedAuto.has(node.id);
      rows.push({
        node,
        depth,
        hasChildren: children.length > 0,
        expanded
      });
      if (expanded) {
        children.forEach((child) => visit(child, depth + 1));
      }
    };
    (index.byParent.get('__root__') ?? []).forEach((root) => visit(root, 0));
    return rows;
  }, [debouncedSearch, expandedAuto, index, manualExpanded, matchedIds]);

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title='Партнёров пока нет'
        description='Добавьте участников в организацию, задайте уровни и реферальные связи — они появятся в дереве сразу.'
        action={
          <Link
            href={`/dashboard/projects/${projectId}/users`}
            className='text-primary text-sm underline'
          >
            Перейти к пользователям →
          </Link>
        }
      />
    );
  }

  return (
    <div className='space-y-4'>
      {/* Toolbar: search, period, export */}
      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative min-w-[260px] flex-1'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 h-4 w-4'
            aria-hidden='true'
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Поиск по имени, email, телефону…'
            aria-label='Поиск участников иерархии'
            className='pl-8'
          />
        </div>
        <Select
          value={period}
          onValueChange={(v) => onPeriodChange(v as HierarchyPeriod)}
        >
          <SelectTrigger className='w-[200px]' aria-label='Период статистики'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABEL) as HierarchyPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type='button'
          variant='outline'
          onClick={handleExport}
          className='gap-2'
        >
          <Download className='h-4 w-4' aria-hidden='true' />
          Экспорт CSV
        </Button>
      </div>

      {debouncedSearch && (
        <div className='text-muted-foreground text-xs'>
          Найдено совпадений: <strong>{matchedIds.size}</strong>
        </div>
      )}

      <p className='text-muted-foreground text-xs md:hidden'>
        Таблица прокручивается по горизонтали. Раскрывайте строки кнопкой перед
        именем участника.
      </p>

      <div className='overflow-hidden rounded-lg border'>
        {rootIds.length > 0 ? (
          <Table className='min-w-[1160px]'>
            <TableHeader>
              <TableRow>
                <SortableHierarchyHead
                  field='name'
                  label='Участник'
                  activeField={sortField}
                  order={sortOrder}
                  onSort={handleSort}
                />
                <SortableHierarchyHead
                  field='registeredAt'
                  label='Регистрация'
                  activeField={sortField}
                  order={sortOrder}
                  onSort={handleSort}
                />
                <TableHead>Рефереры</TableHead>
                <SortableHierarchyHead
                  field='directCount'
                  label='Прямые / ветка'
                  activeField={sortField}
                  order={sortOrder}
                  align='end'
                  onSort={handleSort}
                />
                <SortableHierarchyHead
                  field='totalPurchasesPeriod'
                  label='Покупки'
                  activeField={sortField}
                  order={sortOrder}
                  align='end'
                  onSort={handleSort}
                />
                <SortableHierarchyHead
                  field='commissionEarned'
                  label='Реф. бонусы'
                  activeField={sortField}
                  order={sortOrder}
                  align='end'
                  onSort={handleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length > 0 ? (
                visibleRows.map(({ node, depth, hasChildren, expanded }) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    depth={depth}
                    hasChildren={hasChildren}
                    isExpanded={expanded}
                    isHighlighted={matchedIds.has(node.id)}
                    query={debouncedSearch}
                    onToggle={() => toggleId(node.id)}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='text-muted-foreground h-24 text-center'
                  >
                    По вашему запросу участники не найдены
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Users}
            title='Корней дерева не найдено'
            description='У всех участников задан основной реферер. Проверьте связи, если ожидался отдельный корень.'
            size='sm'
          />
        )}
      </div>
    </div>
  );
}
