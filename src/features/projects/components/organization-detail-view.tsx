/**
 * @file: organization-detail-view.tsx
 * @description: Детальная страница B2B-организации — статистика, участники, настройки
 * @project: SaaS Bonus System
 * @created: 2026-06-06
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Loader2,
  Network,
  Pencil,
  Plus,
  UserMinus
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/composite/confirm-dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  getPartnerRoleLabel,
  PartnerRoleBadge
} from '@/features/bonuses/components/partner-role-badge';
import { PartnerUserCombobox } from './partner-user-combobox';

type PlanOption = { id: string; name: string };

type OrgStats = {
  members: number;
  trainers: number;
  managers: number;
  directors: number;
  clients: number;
  totalPurchases: number;
  commissionEarned: number;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  defaultReferralCommissionPlanId: string | null;
  directorUserId: string | null;
  defaultReferralCommissionPlan?: { id: string; name: string } | null;
  director?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    partnerRole: string;
  } | null;
  _count?: { members: number };
};

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  partnerRole: string;
  referredBy: string | null;
  referrerName: string | null;
  outboundReferralPlanId: string | null;
  outboundPlanName: string | null;
  registeredAt: string;
  totalPurchases: number;
  isActive: boolean;
};

type HierarchyWarning = {
  code: string;
  message: string;
  userId?: string;
  userName?: string;
};

function resolveDefaultReferrerForRole(
  role: 'CLIENT' | 'TRAINER' | 'MANAGER' | 'DIRECTOR',
  members: Member[],
  directorUserId: string | null
): string {
  if (role === 'DIRECTOR' || role === 'CLIENT') return '';
  if (role === 'MANAGER' && directorUserId) return directorUserId;
  if (role === 'TRAINER') {
    const manager = members.find((m) => m.partnerRole === 'MANAGER');
    if (manager) return manager.id;
    if (directorUserId) return directorUserId;
  }
  return '';
}

interface Props {
  projectId: string;
  organizationId: string;
}

const formatRub = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(n);

export function OrganizationDetailView({ projectId, organizationId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [hierarchyWarnings, setHierarchyWarnings] = useState<
    HierarchyWarning[]
  >([]);

  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<Member | null>(
    null
  );

  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPlanId, setEditPlanId] = useState('');
  const [editDirectorId, setEditDirectorId] = useState('');
  const [editActive, setEditActive] = useState(true);

  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<
    'CLIENT' | 'TRAINER' | 'MANAGER' | 'DIRECTOR'
  >('TRAINER');
  const [newReferrerId, setNewReferrerId] = useState('');
  const [newPlanId, setNewPlanId] = useState('');

  const [memberRole, setMemberRole] = useState<
    'CLIENT' | 'TRAINER' | 'MANAGER' | 'DIRECTOR'
  >('TRAINER');
  const [memberReferrerId, setMemberReferrerId] = useState('');
  const [memberPlanId, setMemberPlanId] = useState('');

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      // silent — фоновое обновление после сохранения: не показываем полноэкранный
      // спиннер (иначе вьюха схлопывается и кажется, будто изменения не приняты).
      if (!opts?.silent) setLoading(true);
      try {
        // cache: 'no-store' — иначе браузер отдаёт закэшированный ответ и свежие
        // данные видны только после полной перезагрузки страницы.
        const [orgRes, membersRes, plansRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/organizations/${organizationId}`, {
            cache: 'no-store'
          }),
          fetch(
            `/api/projects/${projectId}/organizations/${organizationId}/members`,
            { cache: 'no-store' }
          ),
          fetch(`/api/projects/${projectId}/referral-commission-plans`, {
            cache: 'no-store'
          })
        ]);

        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrganization(data.organization);
          setStats(data.stats);
          setHierarchyWarnings(data.hierarchyWarnings ?? []);
        }
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members ?? []);
        }
        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlans(
            (data.plans ?? []).map((p: { id: string; name: string }) => ({
              id: p.id,
              name: p.name
            }))
          );
        }
      } catch {
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить организацию',
          variant: 'destructive'
        });
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [projectId, organizationId, toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = () => {
    if (!organization) return;
    setEditName(organization.name);
    setEditSlug(organization.slug);
    setEditDescription(organization.description ?? '');
    setEditPlanId(organization.defaultReferralCommissionPlanId ?? '');
    setEditDirectorId(organization.directorUserId ?? '');
    setEditActive(organization.isActive);
    setEditOpen(true);
  };

  const saveOrg = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/organizations/${organizationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editName.trim(),
            slug: editSlug.trim(),
            description: editDescription.trim() || null,
            isActive: editActive,
            defaultReferralCommissionPlanId: editPlanId || null,
            directorUserId: editDirectorId || null
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
      toast({ title: 'Сохранено' });
      setEditOpen(false);
      await load({ silent: true });
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!newUserId) {
      toast({ title: 'Выберите пользователя', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/organizations/${organizationId}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: newUserId,
            partnerRole: newRole,
            ...(newReferrerId ? { referredBy: newReferrerId } : {}),
            outboundReferralPlanId: newPlanId || null
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось добавить');
      if (data.attributionLocked) {
        toast({
          title: 'Участник добавлен, но комиссия — нет',
          description:
            'У пользователя уже зафиксирована выплата другому рефереру — новая связь только отображается, начисления по ней не идут.',
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Участник добавлен' });
      }
      setAddMemberOpen(false);
      setNewUserId('');
      setNewReferrerId('');
      setNewPlanId('');
      await load({ silent: true });
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditMember = (m: Member) => {
    setEditMember(m);
    setMemberRole(
      m.partnerRole as 'CLIENT' | 'TRAINER' | 'MANAGER' | 'DIRECTOR'
    );
    setMemberReferrerId(m.referredBy ?? '');
    setMemberPlanId(m.outboundReferralPlanId ?? '');
  };

  const saveMember = async () => {
    if (!editMember) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/organizations/${organizationId}/members/${editMember.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerRole: memberRole,
            referredBy: memberReferrerId || null,
            outboundReferralPlanId: memberPlanId || null
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
      if (data.attributionLocked) {
        toast({
          title: 'Приведён обновлён, но выплата — нет',
          description:
            'У пользователя уже зафиксирована комиссия за предыдущего реферера — она не переедет на нового. Это только меняет отображаемую связь.',
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Участник обновлён' });
      }
      setEditMember(null);
      await load({ silent: true });
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async () => {
    if (!removeMemberTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/organizations/${organizationId}/members/${removeMemberTarget.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось удалить');
      toast({ title: 'Участник убран из организации' });
      setRemoveMemberTarget(null);
      await load({ silent: true });
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center py-16'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    );
  }

  if (!organization) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>Организация не найдена</AlertTitle>
      </Alert>
    );
  }

  const directorName = organization.director
    ? [organization.director.firstName, organization.director.lastName]
        .filter(Boolean)
        .join(' ') ||
      organization.director.email ||
      organization.director.phone
    : null;

  const directorInitialUser = organization.director
    ? {
        id: organization.director.id,
        name: directorName || organization.director.id,
        email: organization.director.email,
        phone: organization.director.phone,
        partnerRole: organization.director.partnerRole,
        outboundReferralPlanId: null
      }
    : null;

  return (
    <div className='space-y-6'>
      {hierarchyWarnings.length > 0 && (
        <Alert variant='destructive'>
          <AlertTitle>Проблемы иерархии сети</AlertTitle>
          <AlertDescription>
            <ul className='mt-2 list-inside list-disc space-y-1'>
              {hierarchyWarnings.map((w) => (
                <li key={`${w.code}-${w.userId ?? w.message}`}>{w.message}</li>
              ))}
            </ul>
            <p className='mt-2 text-sm'>
              Без корректных связей referredBy выплаты L2/L3 могут не
              начисляться. Назначьте реферера участникам или добавляйте их с
              автозаполнением.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <Button variant='ghost' size='sm' className='mb-2 -ml-2' asChild>
            <Link
              href={`/dashboard/projects/${projectId}/referral?tab=organizations`}
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              Все организации
            </Link>
          </Button>
          <div className='flex flex-wrap items-center gap-2'>
            <h1 className='text-2xl font-semibold'>{organization.name}</h1>
            <Badge variant={organization.isActive ? 'default' : 'secondary'}>
              {organization.isActive ? 'Активна' : 'Выключена'}
            </Badge>
          </div>
          <p className='text-muted-foreground mt-1 text-sm'>
            slug: <code>{organization.slug}</code>
            {organization.defaultReferralCommissionPlan && (
              <>
                {' · '}
                план: {organization.defaultReferralCommissionPlan.name}
              </>
            )}
            {directorName && (
              <>
                {' · '}
                руководитель: {directorName}
              </>
            )}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' size='sm' onClick={openEdit}>
            <Pencil className='mr-2 h-4 w-4' />
            Настройки
          </Button>
          <Button variant='outline' size='sm' asChild>
            <Link
              href={`/dashboard/projects/${projectId}/referral/hierarchy?organizationId=${organizationId}`}
            >
              <Network className='mr-2 h-4 w-4' />
              Иерархия
            </Link>
          </Button>
        </div>
      </div>

      {stats && (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'>
          {[
            { label: 'Участников', value: stats.members },
            { label: 'Тренеры', value: stats.trainers },
            { label: 'Менеджеры', value: stats.managers },
            { label: 'Руководители', value: stats.directors },
            { label: 'Клиенты', value: stats.clients },
            {
              label: 'Покупки',
              value: formatRub(stats.totalPurchases)
            },
            {
              label: 'Вознаграждение',
              value: formatRub(stats.commissionEarned)
            }
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className='pt-4 pb-3'>
                <p className='text-muted-foreground text-xs'>{item.label}</p>
                <p className='text-lg font-semibold'>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Компактная метка сети вместо крупного баннера-объяснения.
          Подробности вынесены во вкладку «О сети». */}
      <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-sm'>
        <Building2 className='h-4 w-4 shrink-0' />
        <span>Метка сети:</span>
        <code className='bg-muted rounded px-1.5 py-0.5 text-xs'>
          utm_org={organization.slug}
        </code>
        <CopyButton
          value={`utm_org=${organization.slug}`}
          label='Скопировать метку'
        />
      </div>

      <Tabs defaultValue='members'>
        <TabsList>
          <TabsTrigger value='members'>
            Участники ({members.length})
          </TabsTrigger>
          <TabsTrigger value='about'>О сети</TabsTrigger>
        </TabsList>

        <TabsContent value='members' className='mt-4 space-y-4'>
          <div className='flex items-center justify-between gap-4'>
            <p className='text-muted-foreground text-xs'>
              В «Иерархию партнёров» попадают только Тренеры, Менеджеры и
              Руководители — Клиенты видны только здесь, в списке сети.
            </p>
            <Button onClick={() => setAddMemberOpen(true)}>
              <Plus className='mr-2 h-4 w-4' />
              Добавить участника
            </Button>
          </div>

          <Card>
            <CardContent className='p-0'>
              {members.length === 0 ? (
                <p className='text-muted-foreground p-6 text-center text-sm'>
                  Участников пока нет. Добавьте партнёров или клиентов в эту
                  сеть.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Приведён</TableHead>
                      <TableHead>План</TableHead>
                      <TableHead className='text-right'>Покупки</TableHead>
                      <TableHead className='w-[100px]' />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className='font-medium'>{m.name}</div>
                          <div className='text-muted-foreground text-xs'>
                            {m.email || m.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <PartnerRoleBadge role={m.partnerRole} />
                        </TableCell>
                        <TableCell className='text-sm'>
                          {m.referrerName ?? '—'}
                        </TableCell>
                        <TableCell className='text-sm'>
                          {m.outboundPlanName ?? '—'}
                        </TableCell>
                        <TableCell className='text-right text-sm'>
                          {formatRub(m.totalPurchases)}
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-end gap-1'>
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => openEditMember(m)}
                            >
                              <Pencil className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => setRemoveMemberTarget(m)}
                            >
                              <UserMinus className='text-destructive h-4 w-4' />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='about' className='mt-4 space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Описание</CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground text-sm'>
              {organization.description || 'Описание не задано.'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Как работает реферальная ссылка сети</CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground space-y-2 text-sm'>
              <p>
                Партнёры этой организации делятся ссылками с меткой{' '}
                <code className='bg-muted rounded px-1 py-0.5 text-xs'>
                  utm_org={organization.slug}
                </code>
                .
              </p>
              <p>
                Клиент, зарегистрировавшийся по такой ссылке, автоматически
                попадает в эту сеть, а комиссии распределяются по её иерархии.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit org dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Настройки организации</DialogTitle>
            <DialogDescription>
              Изменения slug повлияют на utm_org в реферальных ссылках
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='space-y-2'>
              <Label>Название</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>Slug (URL)</Label>
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>Описание</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className='space-y-2'>
              <Label>Партнёрский план по умолчанию</Label>
              <Select
                value={editPlanId || '__none__'}
                onValueChange={(v) => setEditPlanId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Не выбран</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Руководитель сети</Label>
              <PartnerUserCombobox
                projectId={projectId}
                value={editDirectorId}
                initialUser={directorInitialUser}
                onChange={(u) => setEditDirectorId(u?.id ?? '')}
                partnerRolesOnly
                placeholder='Выберите руководителя…'
                className='w-full max-w-none'
              />
            </div>
            <div className='flex items-center justify-between rounded-lg border p-3'>
              <Label htmlFor='org-active'>Сеть активна</Label>
              <Switch
                id='org-active'
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveOrg} disabled={saving}>
              {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Добавить в организацию</DialogTitle>
            <DialogDescription>
              Пользователь будет привязан к сети «{organization.name}»
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='space-y-2'>
              <Label>Пользователь</Label>
              <PartnerUserCombobox
                projectId={projectId}
                value={newUserId}
                onChange={(u) => setNewUserId(u?.id ?? '')}
                partnerRolesOnly={false}
                placeholder='Поиск по имени, email, телефону…'
              />
            </div>
            <div className='space-y-2'>
              <Label>Роль в сети</Label>
              <Select
                value={newRole}
                onValueChange={(v) => {
                  const role = v as typeof newRole;
                  setNewRole(role);
                  setNewReferrerId(
                    resolveDefaultReferrerForRole(
                      role,
                      members,
                      organization.directorUserId
                    )
                  );
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['DIRECTOR', 'MANAGER', 'TRAINER', 'CLIENT'] as const).map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {getPartnerRoleLabel(r)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Приведён (кто пригласил)</Label>
              <PartnerUserCombobox
                projectId={projectId}
                value={newReferrerId}
                onChange={(u) => setNewReferrerId(u?.id ?? '')}
                partnerRolesOnly
                placeholder='Необязательно'
              />
            </div>
            <div className='space-y-2'>
              <Label>Партнёрский план (outbound)</Label>
              <Select
                value={newPlanId || '__none__'}
                onValueChange={(v) => setNewPlanId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='По умолчанию сети' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>По умолчанию сети</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAddMemberOpen(false)}>
              Отмена
            </Button>
            <Button onClick={addMember} disabled={saving}>
              {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit member dialog */}
      <Dialog
        open={Boolean(editMember)}
        onOpenChange={(open) => !open && setEditMember(null)}
      >
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Участник: {editMember?.name}</DialogTitle>
            <DialogDescription>
              Роль, реферер и партнёрский план для этой сети
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='space-y-2'>
              <Label>Роль</Label>
              <Select
                value={memberRole}
                onValueChange={(v) => setMemberRole(v as typeof memberRole)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['DIRECTOR', 'MANAGER', 'TRAINER', 'CLIENT'] as const).map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {getPartnerRoleLabel(r)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Приведён</Label>
              <PartnerUserCombobox
                projectId={projectId}
                value={memberReferrerId}
                onChange={(u) => setMemberReferrerId(u?.id ?? '')}
                partnerRolesOnly
                placeholder='Не задан'
              />
            </div>
            <div className='space-y-2'>
              <Label>Партнёрский план</Label>
              <Select
                value={memberPlanId || '__none__'}
                onValueChange={(v) =>
                  setMemberPlanId(v === '__none__' ? '' : v)
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Сбросить</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditMember(null)}>
              Отмена
            </Button>
            <Button onClick={saveMember} disabled={saving}>
              {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeMemberTarget)}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
        title='Убрать из организации?'
        description={
          removeMemberTarget
            ? `«${removeMemberTarget.name}» останется в проекте, но потеряет привязку к сети «${organization.name}».`
            : ''
        }
        confirmLabel='Убрать'
        variant='destructive'
        onConfirm={removeMember}
      />
    </div>
  );
}
