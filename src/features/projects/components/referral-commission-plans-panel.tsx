/**
 * @file: src/features/projects/components/referral-commission-plans-panel.tsx
 * @description: Панель планов реферальных % и назначения пользователям-партнёрам.
 *               (b2b-referral-hierarchy Phase 6.1–6.6)
 *                 6.1 — поиск пользователя через `Command`-комбобокс вместо input userId
 *                 6.2 — debounced поиск через
 *                       /api/projects/{id}/users?search=&role=TRAINER,MANAGER,DIRECTOR
 *                 6.3 — роль badge + текущий outbound-план в результатах
 *                 6.4 — кнопка «Назначить всем тренерам» с диалогом подтверждения
 *                 6.5 — произвольное количество уровней выплат
 *                 6.6 — баннер «Используются персональные планы» когда
 *                       `referralPlansEnabled = true` (legacy ReferralLevel
 *                       editor спрятан в этом случае на уровне родителя)
 * @project: SaaS Bonus System
 * @dependencies: shadcn/ui (Command, Popover, Slider, Alert, Switch, Dialog)
 * @created: 2026-05-12
 * @updated: 2026-05-24
 * @author: AI Assistant + User
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Info,
  Loader2,
  Plus,
  Trash2,
  UserPlus
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ConfirmDialog } from '@/components/composite/confirm-dialog';
import { toast } from 'sonner';
import { PartnerUserCombobox, type PartnerUser } from './partner-user-combobox';

type PlanLevel = {
  id?: string;
  level: number;
  percent: number;
  isActive?: boolean;
};

type Plan = {
  id: string;
  name: string;
  maxPayoutDepth: number;
  levels: PlanLevel[];
};

type DeletePlanResponse = {
  deleted: boolean;
  archived: boolean;
  dependencies: {
    projectDefaults: number;
    organizationDefaults: number;
    outboundUsers: number;
    referralAttributions: number;
  };
};

interface Props {
  projectId: string;
  /**
   * Включена ли b2b-иерархия. Когда true — фильтр в комбобоксе по партнёрской
   * роли + кнопка bulk-assign видна. По умолчанию `false` — поведение прежнее.
   */
  enablePartnerRoles?: boolean;
}

function formatPlanLevels(levels: PlanLevel[]): string {
  return [...levels]
    .sort((a, b) => a.level - b.level)
    .map((level) => `Уровень ${level.level}: ${level.percent}%`)
    .join(' · ');
}

type AssignTarget = 'one' | 'role';

const ROLE_PLURAL: Record<'TRAINER' | 'MANAGER' | 'DIRECTOR', string> = {
  TRAINER: 'партнёров уровня 1',
  MANAGER: 'партнёров уровня 2',
  DIRECTOR: 'партнёров уровня 3'
};

export function ReferralCommissionPlansPanel({
  projectId,
  enablePartnerRoles = false
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [referralPlansEnabled, setReferralPlansEnabled] = useState(false);
  const [defaultPlanId, setDefaultPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [newName, setNewName] = useState('Инфлюенсер');
  const [newLevels, setNewLevels] = useState<PlanLevel[]>([
    { level: 1, percent: 10, isActive: true },
    { level: 2, percent: 3, isActive: true },
    { level: 3, percent: 1, isActive: true }
  ]);
  const [maxDepth, setMaxDepth] = useState(3);

  // Единый диалог назначения плана
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget>('one');
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignUser, setAssignUser] = useState<PartnerUser | null>(null);
  const [assignRole, setAssignRole] = useState<
    'TRAINER' | 'MANAGER' | 'DIRECTOR'
  >('TRAINER');
  /** true = не перезаписывать партнёров, у которых уже есть свой план */
  const [assignOnlyWithoutPlan, setAssignOnlyWithoutPlan] = useState(true);
  const [rolePreview, setRolePreview] = useState<{
    total: number;
    empty: number;
  } | null>(null);
  const [loadingRolePreview, setLoadingRolePreview] = useState(false);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [bulkOverwriteConfirmOpen, setBulkOverwriteConfirmOpen] =
    useState(false);

  const planNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of plans) map[p.id] = p.name;
    return map;
  }, [plans]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-commission-settings`
      );
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setReferralPlansEnabled(Boolean(data.referralPlansEnabled));
      setDefaultPlanId(data.defaultReferralCommissionPlanId ?? null);
      setPlans(data.plans || []);
    } catch {
      toast.error('Ошибка', {
        description: 'Не удалось загрузить настройки планов'
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssignDialog = (preselectedPlanId?: string) => {
    setAssignPlanId(preselectedPlanId ?? defaultPlanId ?? plans[0]?.id ?? '');
    setAssignTarget('one');
    setAssignUser(null);
    setAssignRole('TRAINER');
    setAssignOnlyWithoutPlan(true);
    setRolePreview(null);
    setAssignDialogOpen(true);
  };

  const loadRolePreview = useCallback(async () => {
    if (!assignPlanId || assignTarget !== 'role') {
      setRolePreview(null);
      return;
    }
    setLoadingRolePreview(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-commission-plans/${assignPlanId}/bulk-assign?role=${assignRole}`
      );
      if (!res.ok) throw new Error('preview failed');
      const data = await res.json();
      setRolePreview({
        total: Number(data.total ?? 0),
        empty: Number(data.empty ?? 0)
      });
    } catch {
      setRolePreview(null);
    } finally {
      setLoadingRolePreview(false);
    }
  }, [assignPlanId, assignRole, assignTarget, projectId]);

  useEffect(() => {
    if (!assignDialogOpen || assignTarget !== 'role') return;
    void loadRolePreview();
  }, [assignDialogOpen, assignTarget, loadRolePreview]);

  const saveSettings = async (next?: {
    enabled?: boolean;
    defaultId?: string | null;
  }) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-commission-settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referralPlansEnabled: next?.enabled ?? referralPlansEnabled,
            defaultReferralCommissionPlanId:
              next?.defaultId !== undefined ? next.defaultId : defaultPlanId
          })
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'save failed');
      }
      toast.success('Сохранено');
      await load();
    } catch (e) {
      toast.error('Ошибка', {
        description: e instanceof Error ? e.message : 'Не сохранилось'
      });
    } finally {
      setSaving(false);
    }
  };

  const seedFromLegacy = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-commission-plans/seed-from-legacy`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'seed failed');
      }
      toast.success('Готово', {
        description: 'Создан план по умолчанию из текущих уровней программы'
      });
      await load();
    } catch (e) {
      toast.error('Ошибка', {
        description: e instanceof Error ? e.message : 'Не удалось'
      });
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-commission-plans`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName,
            maxPayoutDepth: maxDepth,
            levels: newLevels.map((level) => ({
              level: level.level,
              percent: level.percent,
              isActive: level.percent > 0
            }))
          })
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'create failed');
      }
      toast.success('План создан');
      setCreatePlanOpen(false);
      await load();
    } catch (e) {
      toast.error('Ошибка', {
        description: e instanceof Error ? e.message : 'Не удалось'
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (planId: string) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-commission-plans/${planId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'delete failed');
      }
      const result = (await res.json()) as DeletePlanResponse;
      toast.success(result.archived ? 'План архивирован' : 'План удалён');
      await load();
    } catch (e) {
      toast.error('Ошибка', {
        description: e instanceof Error ? e.message : 'Не удалось'
      });
    } finally {
      setSaving(false);
    }
  };

  const assignPlanToRole = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/referral-commission-plans/${assignPlanId}/bulk-assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: assignRole,
            onlyEmpty: assignOnlyWithoutPlan
          })
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Не удалось назначить');
      }
      const data = await res.json();
      toast.success('План назначен', {
        description: `«${planNameById[assignPlanId]}» → ${data.updated} ${ROLE_PLURAL[assignRole]}`
      });
      setAssignDialogOpen(false);
      await load();
    } catch (e) {
      toast.error('Ошибка', {
        description: e instanceof Error ? e.message : 'Не удалось'
      });
    } finally {
      setSaving(false);
    }
  };

  const submitAssign = async () => {
    if (!assignPlanId) {
      toast.error('Выберите план');
      return;
    }

    if (assignTarget === 'one') {
      if (!assignUser) {
        toast.error('Выберите партнёра');
        return;
      }
      setSaving(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/users/${assignUser.id}/referral-outbound-plan`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outboundReferralPlanId: assignPlanId })
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'assign failed');
        }
        toast.success('План назначен', {
          description: `«${planNameById[assignPlanId]}» → ${assignUser.name}`
        });
        setAssignDialogOpen(false);
        await load();
      } catch (e) {
        toast.error('Ошибка', {
          description: e instanceof Error ? e.message : 'Не удалось'
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    const affected = assignOnlyWithoutPlan
      ? (rolePreview?.empty ?? 0)
      : (rolePreview?.total ?? 0);

    if (affected === 0) {
      toast.error('Никого не затронет', {
        description: assignOnlyWithoutPlan
          ? `У всех ${ROLE_PLURAL[assignRole]} уже есть свой план`
          : `В проекте нет ${ROLE_PLURAL[assignRole]}`
      });
      return;
    }

    if (
      !assignOnlyWithoutPlan &&
      rolePreview &&
      rolePreview.total > rolePreview.empty
    ) {
      setBulkOverwriteConfirmOpen(true);
      return;
    }

    await assignPlanToRole();
  };

  if (loading) {
    return (
      <div className='flex justify-center py-12'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    );
  }

  const showBanner = referralPlansEnabled;

  return (
    <div className='space-y-6'>
      {/* Phase 6.6 — баннер при включённых персональных планах */}
      {showBanner && (
        <Alert className='border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/40'>
          <Info className='h-4 w-4 text-emerald-600' />
          <AlertTitle>Используются персональные партнёрские планы</AlertTitle>
          <AlertDescription>
            Старые уровни реферальной программы (вкладка «Настройки» → «Уровни»)
            больше не применяются для новых атрибуций. Существующие начисления
            остаются неизменными — атрибуция зафиксирована.
          </AlertDescription>
        </Alert>
      )}

      {enablePartnerRoles && (
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Партнёрские планы ≠ бонусы клиентам</AlertTitle>
          <AlertDescription className='text-sm'>
            Здесь задаётся, сколько % от покупки выплачивается на каждом уровне
            реферальной цепочки. Количество уровней не ограничено
            бизнес-логикой. Бонусы для клиентов — во вкладке «Настройки».
            Приоритет плана: персональный outbound → план организации → план по
            умолчанию.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <div>
            <CardTitle>Настройки планов</CardTitle>
            <CardDescription>
              Включите персональные планы и выберите дефолт для новых
              приглашённых
            </CardDescription>
          </div>
          <div className='flex shrink-0 flex-wrap gap-2'>
            {plans.length > 0 && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => openAssignDialog()}
              >
                <UserPlus className='mr-2 h-4 w-4' />
                Назначить план
              </Button>
            )}
            <Button
              type='button'
              size='sm'
              onClick={() => setCreatePlanOpen(true)}
            >
              <Plus className='mr-2 h-4 w-4' />
              Новый план
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-row items-center justify-between rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='ref-plans-enabled'>
                Включить персональные планы
              </Label>
              <p className='text-muted-foreground text-sm'>
                Без дефолтного плана новые атрибуции не создаются
              </p>
            </div>
            <Switch
              id='ref-plans-enabled'
              checked={referralPlansEnabled}
              onCheckedChange={(v) => {
                setReferralPlansEnabled(v);
                void saveSettings({ enabled: v });
              }}
              disabled={saving}
            />
          </div>

          <div className='flex flex-wrap items-end gap-3'>
            <div className='space-y-2'>
              <Label>План по умолчанию</Label>
              <Select
                value={defaultPlanId ?? '__none__'}
                onValueChange={(v) => {
                  const id = v === '__none__' ? null : v;
                  setDefaultPlanId(id);
                  void saveSettings({ defaultId: id });
                }}
                disabled={saving || !plans.length}
              >
                <SelectTrigger className='w-[260px]'>
                  <SelectValue placeholder='Не выбран' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>— не выбран —</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => void seedFromLegacy()}
              disabled={saving}
            >
              Из текущей программы
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Планы ({plans.length})</CardTitle>
          <CardDescription>
            Проценты выплат по уровням иерархии с каждой покупки приглашённого
            клиента
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {plans.length === 0 ? (
            <p className='text-muted-foreground py-4 text-center text-sm'>
              Планов пока нет.{' '}
              <button
                type='button'
                className='text-primary underline'
                onClick={() => setCreatePlanOpen(true)}
              >
                Создать первый
              </button>
            </p>
          ) : (
            plans.map((p) => (
              <div
                key={p.id}
                className='flex items-center justify-between gap-3 rounded-lg border p-3'
              >
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-medium'>{p.name}</span>
                    {defaultPlanId === p.id && (
                      <Badge variant='secondary' className='text-xs'>
                        по умолчанию
                      </Badge>
                    )}
                  </div>
                  <p className='text-muted-foreground mt-0.5 text-sm'>
                    {formatPlanLevels(p.levels)}
                    {' · '}
                    глубина {p.maxPayoutDepth}
                  </p>
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='secondary'
                    onClick={() => openAssignDialog(p.id)}
                  >
                    Назначить
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-destructive hover:text-destructive'
                    onClick={() => setPlanToDelete(p)}
                    disabled={saving || defaultPlanId === p.id}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create plan dialog */}
      <Dialog open={createPlanOpen} onOpenChange={setCreatePlanOpen}>
        <DialogContent className='max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Новый партнёрский план</DialogTitle>
            <DialogDescription>
              Добавьте нужное количество уровней выплат
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='space-y-2'>
              <Label>Название</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='new-plan-depth'>Глубина выплат</Label>
              <Input
                id='new-plan-depth'
                type='number'
                min={1}
                step={1}
                value={maxDepth}
                onChange={(event) =>
                  setMaxDepth(
                    Math.max(1, Math.trunc(Number(event.target.value)))
                  )
                }
              />
              <p className='text-muted-foreground text-xs'>
                Максимальный уровень, до которого рассчитывается цепочка.
              </p>
            </div>
            <div className='space-y-3'>
              <div className='flex items-center justify-between gap-3'>
                <Label>Проценты по уровням</Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const nextLevel =
                      Math.max(0, ...newLevels.map((level) => level.level)) + 1;
                    setNewLevels((levels) => [
                      ...levels,
                      { level: nextLevel, percent: 0, isActive: false }
                    ]);
                    setMaxDepth((depth) => Math.max(depth, nextLevel));
                  }}
                >
                  <Plus data-icon='inline-start' />
                  Добавить уровень
                </Button>
              </div>
              <div className='space-y-2'>
                {newLevels.map((level, index) => (
                  <div
                    key={`${level.level}-${index}`}
                    className='grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-lg border p-3'
                  >
                    <div className='space-y-2'>
                      <Label htmlFor={`new-level-number-${index}`}>
                        Уровень
                      </Label>
                      <Input
                        id={`new-level-number-${index}`}
                        type='number'
                        min={1}
                        step={1}
                        value={level.level}
                        onChange={(event) => {
                          const value = Math.max(
                            1,
                            Math.trunc(Number(event.target.value))
                          );
                          setNewLevels((levels) =>
                            levels.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, level: value }
                                : item
                            )
                          );
                          setMaxDepth((depth) => Math.max(depth, value));
                        }}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor={`new-level-percent-${index}`}>
                        Процент
                      </Label>
                      <Input
                        id={`new-level-percent-${index}`}
                        type='number'
                        min={0}
                        max={100}
                        step='0.01'
                        value={level.percent}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setNewLevels((levels) =>
                            levels.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, percent: value }
                                : item
                            )
                          );
                        }}
                      />
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label={`Удалить уровень ${level.level}`}
                      disabled={newLevels.length === 1}
                      onClick={() =>
                        setNewLevels((levels) =>
                          levels.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      <Trash2 data-icon='icon-only' />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreatePlanOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void createPlan()} disabled={saving}>
              {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Назначить план — один диалог: одному партнёру или всей роли */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Назначить партнёрский план</DialogTitle>
            <DialogDescription>
              План определяет проценты на каждом уровне цепочки клиентов,
              которых пригласил партнёр
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-5 py-2'>
            <div className='space-y-2'>
              <Label>Какой план</Label>
              <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder='Выберите план' />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {defaultPlanId === p.id ? ' (по умолчанию)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-3'>
              <Label>Кому назначить</Label>
              <RadioGroup
                value={assignTarget}
                onValueChange={(v) => setAssignTarget(v as AssignTarget)}
                className='grid gap-2'
              >
                <label
                  htmlFor='assign-one'
                  className='hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3'
                >
                  <RadioGroupItem
                    value='one'
                    id='assign-one'
                    className='mt-0.5'
                  />
                  <div>
                    <p className='text-sm font-medium'>Одному партнёру</p>
                    <p className='text-muted-foreground text-xs'>
                      Найти по имени, email или телефону
                    </p>
                  </div>
                </label>
                {enablePartnerRoles && (
                  <label
                    htmlFor='assign-role'
                    className='hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3'
                  >
                    <RadioGroupItem
                      value='role'
                      id='assign-role'
                      className='mt-0.5'
                    />
                    <div>
                      <p className='text-sm font-medium'>
                        Всем партнёрам одной роли
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        Например, всем партнёрам уровня 1 сразу
                      </p>
                    </div>
                  </label>
                )}
              </RadioGroup>
            </div>

            {assignTarget === 'one' ? (
              <div className='space-y-2'>
                <Label>Партнёр</Label>
                <PartnerUserCombobox
                  projectId={projectId}
                  value={assignUser?.id ?? ''}
                  onChange={(u) => setAssignUser(u)}
                  partnerRolesOnly={enablePartnerRoles}
                  planNameById={planNameById}
                  disabled={saving}
                />
                {assignUser?.outboundReferralPlanId && (
                  <p className='text-muted-foreground text-xs'>
                    Сейчас:{' '}
                    {planNameById[assignUser.outboundReferralPlanId] ??
                      'другой план'}
                  </p>
                )}
              </div>
            ) : (
              <div className='space-y-4 rounded-lg border p-3'>
                <div className='space-y-2'>
                  <Label>Роль</Label>
                  <Select
                    value={assignRole}
                    onValueChange={(v) =>
                      setAssignRole(v as 'TRAINER' | 'MANAGER' | 'DIRECTOR')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='TRAINER'>Уровень 1</SelectItem>
                      <SelectItem value='MANAGER'>Уровень 2</SelectItem>
                      <SelectItem value='DIRECTOR'>Уровень 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className='flex cursor-pointer items-start gap-2 text-sm'>
                  <input
                    type='checkbox'
                    className='mt-1'
                    checked={assignOnlyWithoutPlan}
                    onChange={(e) => setAssignOnlyWithoutPlan(e.target.checked)}
                  />
                  <span>
                    Только тем, у кого ещё нет своего плана
                    <span className='text-muted-foreground block text-xs'>
                      Не перезаписывать уже настроенных партнёров
                    </span>
                  </span>
                </label>
                <div className='bg-muted/50 rounded-md px-3 py-2 text-sm'>
                  {loadingRolePreview ? (
                    <span className='text-muted-foreground flex items-center gap-2'>
                      <Loader2 className='h-3 w-3 animate-spin' />
                      Считаем…
                    </span>
                  ) : rolePreview ? (
                    <>
                      Будет назначено:{' '}
                      <strong>
                        {assignOnlyWithoutPlan
                          ? rolePreview.empty
                          : rolePreview.total}
                      </strong>{' '}
                      {ROLE_PLURAL[assignRole]}
                      {!assignOnlyWithoutPlan &&
                        rolePreview.total > rolePreview.empty && (
                          <span className='text-muted-foreground block text-xs'>
                            из них {rolePreview.total - rolePreview.empty} уже
                            имеют другой план — он будет заменён
                          </span>
                        )}
                    </>
                  ) : (
                    <span className='text-muted-foreground'>
                      Выберите роль для подсчёта
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setAssignDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button onClick={() => void submitAssign()} disabled={saving}>
              {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Назначить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={planToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPlanToDelete(null);
        }}
        title='Удалить план?'
        description={
          planToDelete
            ? `План «${planToDelete.name}» будет удалён, если не используется, или архивирован при наличии назначений и атрибуций.`
            : undefined
        }
        confirmLabel='Удалить'
        variant='destructive'
        onConfirm={async () => {
          if (planToDelete) await deletePlan(planToDelete.id);
        }}
      />

      <ConfirmDialog
        open={bulkOverwriteConfirmOpen}
        onOpenChange={setBulkOverwriteConfirmOpen}
        title='Перезаписать назначенные планы?'
        description={
          rolePreview
            ? `План будет назначен ${rolePreview.total} ${ROLE_PLURAL[assignRole]}. У ${rolePreview.total - rolePreview.empty} уже есть другой план — он будет заменён.`
            : undefined
        }
        confirmLabel='Перезаписать'
        variant='destructive'
        onConfirm={assignPlanToRole}
      />
    </div>
  );
}
