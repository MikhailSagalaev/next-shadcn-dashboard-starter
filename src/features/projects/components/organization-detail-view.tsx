/**
 * @file: organization-detail-view.tsx
 * @description: Детальная страница B2B-организации — статистика, участники, настройки
 * @project: SaaS Bonus System
 * @created: 2026-06-06
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Copy,
  Loader2,
  List,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserMinus
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/composite/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { buildReferralLink } from '@/lib/utils/referral-link';
import type {
  HierarchyNode,
  HierarchyPeriod
} from '@/app/dashboard/projects/[id]/referral/hierarchy/data-access';
import { OrganizationLevelBadge } from './organization-level-badge';

import { PartnerUserCombobox, type PartnerUser } from './partner-user-combobox';
import { HierarchyTree } from './hierarchy-tree';
import { OrganizationMemberSheet } from './organization-member-sheet';
import { OrganizationQrCard } from './organization-qr-card';

type PlanOption = { id: string; name: string };

type OrgStats = {
  members: number;
  levels: Array<{ level: number; count: number }>;
  managers: number;
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
  firstPurchaseDiscountPercent: number;
  defaultReferralCommissionPlanId: string | null;
  directorUserId: string | null;
  defaultReferralCommissionPlan?: { id: string; name: string } | null;
  project?: { domain: string | null };
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

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  partnerRole: string;
  level: number | null;
  title: string | null;
  canManage: boolean;
  referredBy: string | null;
  referrerName: string | null;
  referrerLinks: Array<{
    referrerId: string;
    referrerName: string;
    sharePercent: number;
    isPrimary: boolean;
  }>;
  outboundReferralPlanId: string | null;
  outboundPlanName: string | null;
  outboundPlanInherited: boolean;
  attributionPlanName: string | null;
  invitedById: string | null;
  invitedByName: string | null;
  acquisitionSource: 'QR' | 'REFERRAL' | 'MANUAL';
  referralStatus: 'CONFIRMED' | 'PENDING' | 'INFERRED' | null;
  directReferrals: Array<{ id: string; name: string }>;
  joinedAt: string;
  registeredAt: string;
  totalPurchases: number;
  referralBonusEarned: number;
  isActive: boolean;
};

type MemberSortField =
  | 'name'
  | 'joinedAt'
  | 'registeredAt'
  | 'directReferrals'
  | 'totalPurchases'
  | 'referralBonusEarned';

type SortOrder = 'asc' | 'desc';

type ReferralLinkDraft = {
  draftId: string;
  referrerId: string;
  sharePercent: number;
  isPrimary: boolean;
};

type HierarchyWarning = {
  code: string;
  message: string;
  userId?: string;
  userName?: string;
};

type OrganizationHierarchyData = {
  rootIds: string[];
  nodes: HierarchyNode[];
};

function memberToPartnerUser(member: Member | undefined): PartnerUser | null {
  if (!member) return null;
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    phone: member.phone,
    partnerRole: member.partnerRole,
    outboundReferralPlanId: member.outboundReferralPlanId
  };
}

function newReferralLink(
  values: Partial<Omit<ReferralLinkDraft, 'draftId'>> = {}
): ReferralLinkDraft {
  return {
    draftId: `${Date.now()}-${Math.random()}`,
    referrerId: '',
    sharePercent: 100,
    isPrimary: true,
    ...values
  };
}

function ReferralLinksEditor({
  projectId,
  organizationId,
  members,
  childUserId,
  value,
  onChange
}: {
  projectId: string;
  organizationId: string;
  members: Member[];
  childUserId?: string;
  value: ReferralLinkDraft[];
  onChange: (value: ReferralLinkDraft[]) => void;
}) {
  const totalShare = value.reduce(
    (sum, link) => sum + Number(link.sharePercent || 0),
    0
  );

  return (
    <Field>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <FieldLabel>Рефереры и доли</FieldLabel>
        <div className='flex items-center gap-2'>
          <Badge variant={totalShare > 100 ? 'destructive' : 'secondary'}>
            Всего {totalShare}%
          </Badge>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              onChange([
                ...value,
                newReferralLink({
                  sharePercent: 0,
                  isPrimary: value.length === 0
                })
              ])
            }
          >
            <Plus data-icon='inline-start' />
            Добавить
          </Button>
        </div>
      </div>
      <FieldDescription>
        Доля участвует в выплате на каждом уровне. 0% — только связь для
        просмотра команды. Сумма не должна превышать 100%.
      </FieldDescription>
      <div className='space-y-2'>
        {value.length === 0 ? (
          <p className='text-muted-foreground rounded-lg border border-dashed p-3 text-sm'>
            Рефереры не назначены — покупки этого участника не создают выплату
            вверх по организации.
          </p>
        ) : (
          value.map((link, index) => {
            const initialUser = memberToPartnerUser(
              members.find((member) => member.id === link.referrerId)
            );
            return (
              <div
                key={link.draftId}
                className='grid gap-3 rounded-lg border p-3'
              >
                <PartnerUserCombobox
                  projectId={projectId}
                  value={link.referrerId}
                  initialUser={initialUser}
                  organizationId={organizationId}
                  excludedUserIds={childUserId ? [childUserId] : []}
                  onChange={(user) =>
                    onChange(
                      value.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, referrerId: user?.id ?? '' }
                          : item
                      )
                    )
                  }
                  partnerRolesOnly={false}
                  className='w-full'
                  placeholder='Выберите участника этой организации'
                />
                <div className='grid grid-cols-[1fr_auto_auto] items-end gap-3'>
                  <Field>
                    <FieldLabel htmlFor={`referrer-share-${link.draftId}`}>
                      Доля, %
                    </FieldLabel>
                    <Input
                      id={`referrer-share-${link.draftId}`}
                      type='number'
                      min={0}
                      max={100}
                      step='0.01'
                      value={link.sharePercent}
                      onChange={(event) =>
                        onChange(
                          value.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  sharePercent: Number(event.target.value)
                                }
                              : item
                          )
                        )
                      }
                    />
                  </Field>
                  <Field className='pb-2'>
                    <div className='flex items-center gap-2'>
                      <Switch
                        id={`referrer-primary-${link.draftId}`}
                        checked={link.isPrimary}
                        onCheckedChange={(checked) =>
                          onChange(
                            value.map((item, itemIndex) => ({
                              ...item,
                              isPrimary: checked ? itemIndex === index : false
                            }))
                          )
                        }
                      />
                      <FieldLabel htmlFor={`referrer-primary-${link.draftId}`}>
                        Основной
                      </FieldLabel>
                    </div>
                  </Field>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label='Удалить реферера'
                    onClick={() =>
                      onChange(
                        value
                          .filter((_, itemIndex) => itemIndex !== index)
                          .map((item, itemIndex) => ({
                            ...item,
                            isPrimary:
                              item.isPrimary ||
                              (itemIndex === 0 &&
                                !value.some(
                                  (candidate, candidateIndex) =>
                                    candidateIndex !== index &&
                                    candidate.isPrimary
                                ))
                          }))
                      )
                    }
                  >
                    <Trash2 data-icon='icon-only' />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Field>
  );
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

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU');

function compareMembers(
  left: Member,
  right: Member,
  field: MemberSortField,
  order: SortOrder
) {
  let result = 0;
  if (field === 'name') {
    result = left.name.localeCompare(right.name, 'ru-RU');
  } else if (field === 'joinedAt' || field === 'registeredAt') {
    result = new Date(left[field]).getTime() - new Date(right[field]).getTime();
  } else if (field === 'directReferrals') {
    result = left.directReferrals.length - right.directReferrals.length;
  } else {
    result = left[field] - right[field];
  }
  if (result === 0) result = left.name.localeCompare(right.name, 'ru-RU');
  return order === 'asc' ? result : -result;
}

function SortableMemberHead({
  field,
  label,
  activeField,
  order,
  align = 'start',
  onSort
}: {
  field: MemberSortField;
  label: string;
  activeField: MemberSortField;
  order: SortOrder;
  align?: 'start' | 'end';
  onSort: (field: MemberSortField) => void;
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

function parseDiscountPercent(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : null;
}

export function OrganizationDetailView({ projectId, organizationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
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
  const [transferMemberTarget, setTransferMemberTarget] =
    useState<Member | null>(null);
  const [targetOrganizationId, setTargetOrganizationId] = useState('');

  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPlanId, setEditPlanId] = useState('');
  const [editDirectorId, setEditDirectorId] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [
    editFirstPurchaseDiscountPercent,
    setEditFirstPurchaseDiscountPercent
  ] = useState('0');

  const [newUserId, setNewUserId] = useState('');

  const [newLevel, setNewLevel] = useState('');
  const [newUserError, setNewUserError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCanManage, setNewCanManage] = useState(false);
  const [newReferrerLinks, setNewReferrerLinks] = useState<ReferralLinkDraft[]>(
    []
  );
  const [newPlanId, setNewPlanId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSortField, setMemberSortField] =
    useState<MemberSortField>('joinedAt');
  const [memberSortOrder, setMemberSortOrder] = useState<SortOrder>('desc');
  const [memberView, setMemberView] = useState<'hierarchy' | 'list'>(
    'hierarchy'
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const memberTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [hierarchyPeriod, setHierarchyPeriod] =
    useState<HierarchyPeriod>('30d');
  const [hierarchyData, setHierarchyData] =
    useState<OrganizationHierarchyData | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState('');
  const [hierarchyRefreshKey, setHierarchyRefreshKey] = useState(0);

  const [memberLevel, setMemberLevel] = useState('');
  const [memberTitle, setMemberTitle] = useState('');
  const [memberCanManage, setMemberCanManage] = useState(false);
  const [memberReferrerLinks, setMemberReferrerLinks] = useState<
    ReferralLinkDraft[]
  >([]);
  const [memberPlanId, setMemberPlanId] = useState('');

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      // silent — фоновое обновление после сохранения: не показываем полноэкранный
      // спиннер (иначе вьюха схлопывается и кажется, будто изменения не приняты).
      if (!opts?.silent) setLoading(true);
      try {
        setLoadError('');
        // cache: 'no-store' — иначе браузер отдаёт закэшированный ответ и свежие
        // данные видны только после полной перезагрузки страницы.
        const [orgRes, membersRes, organizationsRes, plansRes] =
          await Promise.all([
            fetch(
              `/api/projects/${projectId}/organizations/${organizationId}`,
              { cache: 'no-store' }
            ),
            fetch(
              `/api/projects/${projectId}/organizations/${organizationId}/members`,
              { cache: 'no-store' }
            ),
            fetch(`/api/projects/${projectId}/organizations`, {
              cache: 'no-store'
            }),
            fetch(`/api/projects/${projectId}/referral-commission-plans`, {
              cache: 'no-store'
            })
          ]);

        const failed = [orgRes, membersRes, organizationsRes, plansRes].find(
          (response) => !response.ok
        );
        if (failed) {
          throw new Error(`Не удалось загрузить данные (${failed.status})`);
        }

        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrganization(data.organization);
          setStats(data.stats);
          setHierarchyWarnings(data.hierarchyWarnings ?? []);
        }
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members ?? []);
          setHierarchyRefreshKey((current) => current + 1);
        }
        if (organizationsRes.ok) {
          const data = await organizationsRes.json();
          setOrganizations(data.organizations ?? []);
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
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить организацию';
        setLoadError(message);
        toast.error(message);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [projectId, organizationId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadHierarchy = useCallback(async () => {
    setHierarchyLoading(true);
    try {
      setHierarchyError('');
      const params = new URLSearchParams({
        period: hierarchyPeriod,
        organizationId
      });
      const response = await fetch(
        `/api/projects/${projectId}/hierarchy?${params.toString()}`,
        { cache: 'no-store' }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить иерархию');
      }
      setHierarchyData({
        rootIds: data.rootIds ?? [],
        nodes: data.nodes ?? []
      });
    } catch (error) {
      setHierarchyError(
        error instanceof Error ? error.message : 'Не удалось загрузить иерархию'
      );
    } finally {
      setHierarchyLoading(false);
    }
  }, [hierarchyPeriod, organizationId, projectId]);

  useEffect(() => {
    void loadHierarchy();
  }, [loadHierarchy, hierarchyRefreshKey]);

  const openEdit = () => {
    if (!organization) return;
    setEditName(organization.name);
    setEditSlug(organization.slug);
    setEditDescription(organization.description ?? '');
    setEditPlanId(organization.defaultReferralCommissionPlanId ?? '');
    setEditDirectorId(organization.directorUserId ?? '');
    setEditActive(organization.isActive);
    setEditFirstPurchaseDiscountPercent(
      String(organization.firstPurchaseDiscountPercent ?? 0)
    );
    setEditOpen(true);
  };

  const openAddMember = () => {
    setNewUserId('');
    setNewLevel('');
    setNewUserError('');
    setNewTitle('');
    setNewCanManage(false);
    setNewReferrerLinks([]);
    setNewPlanId('');
    setAddMemberOpen(true);
  };

  const saveOrg = async () => {
    const firstPurchaseDiscountPercent = parseDiscountPercent(
      editFirstPurchaseDiscountPercent
    );
    if (firstPurchaseDiscountPercent === null) {
      toast.error('Скидка должна быть целым числом от 0 до 100');
      return;
    }

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
            firstPurchaseDiscountPercent,
            defaultReferralCommissionPlanId: editPlanId || null,
            directorUserId: editDirectorId || null
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
      toast.success('Сохранено');
      setEditOpen(false);
      await load({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось');
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!newUserId) {
      setNewUserError('Выберите пользователя');
      return;
    }
    setNewUserError('');
    if (newReferrerLinks.some((link) => !link.referrerId)) {
      toast.error('Выберите пользователя во всех строках рефереров');
      return;
    }
    if (
      newReferrerLinks.reduce(
        (sum, link) => sum + Number(link.sharePercent || 0),
        0
      ) > 100
    ) {
      toast.error('Сумма долей рефереров не может превышать 100%');
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
            level: newLevel ? Number(newLevel) : null,
            title: newTitle.trim() || null,
            canManage: newCanManage,
            referrerLinks: newReferrerLinks.map(
              ({ referrerId, sharePercent, isPrimary }) => ({
                referrerId,
                sharePercent,
                isPrimary
              })
            ),
            outboundReferralPlanId: newPlanId || null
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось добавить');
      if (data.attributionLocked) {
        toast.warning('Участник добавлен', {
          description:
            'План регистрации уже зафиксирован. Новые реферальные доли применятся к следующим выплатам.'
        });
      } else {
        toast.success('Участник добавлен');
      }
      setAddMemberOpen(false);
      setNewUserId('');
      setNewLevel('');
      setNewTitle('');
      setNewCanManage(false);
      setNewReferrerLinks([]);
      setNewPlanId('');
      await load({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось');
    } finally {
      setSaving(false);
    }
  };

  const openEditMember = (member: Member) => {
    setEditMember(member);

    setMemberLevel(member.level ? String(member.level) : '');
    setMemberTitle(member.title ?? '');
    setMemberCanManage(member.canManage);
    setMemberReferrerLinks(
      member.referrerLinks.map((link) =>
        newReferralLink({
          referrerId: link.referrerId,
          sharePercent: link.sharePercent,
          isPrimary: link.isPrimary
        })
      )
    );
    setMemberPlanId(member.outboundReferralPlanId ?? '');
  };

  const saveMember = async () => {
    if (!editMember) return;
    if (memberReferrerLinks.some((link) => !link.referrerId)) {
      toast.error('Выберите пользователя во всех строках рефереров');
      return;
    }
    if (
      memberReferrerLinks.reduce(
        (sum, link) => sum + Number(link.sharePercent || 0),
        0
      ) > 100
    ) {
      toast.error('Сумма долей рефереров не может превышать 100%');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/organizations/${organizationId}/members/${editMember.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: memberLevel ? Number(memberLevel) : null,
            title: memberTitle.trim() || null,
            canManage: memberCanManage,
            referrerLinks: memberReferrerLinks.map(
              ({ referrerId, sharePercent, isPrimary }) => ({
                referrerId,
                sharePercent,
                isPrimary
              })
            ),
            outboundReferralPlanId: memberPlanId || null
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
      if (data.attributionLocked) {
        toast.warning('Связи обновлены', {
          description:
            'План регистрации остаётся прежним, а новые доли применятся к следующим выплатам.'
        });
      } else {
        toast.success('Участник обновлён');
      }
      setEditMember(null);
      await load({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось');
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
      toast.success('Участник убран из организации');
      setRemoveMemberTarget(null);
      await load({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось');
    } finally {
      setSaving(false);
    }
  };

  const copyMemberReferralLink = async (member: Member) => {
    if (!organization || (!member.level && !member.canManage)) return;
    try {
      await navigator.clipboard.writeText(
        buildReferralLink(
          organization.project?.domain,
          member.id,
          organization.slug
        )
      );
      toast.success('Реферальная ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const openTransferMember = (member: Member) => {
    const firstTarget = organizations.find(
      (candidate) => candidate.id !== organizationId
    );
    setTransferMemberTarget(member);
    setTargetOrganizationId(firstTarget?.id ?? '');
  };

  const transferMember = async () => {
    if (!transferMemberTarget || !targetOrganizationId) {
      toast.error('Выберите целевую организацию');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/organizations/${organizationId}/members/${transferMemberTarget.id}/transfer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetOrganizationId })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось перенести');

      if (data.attributionLocked) {
        toast.warning('Участник перенесён, но комиссия не изменена', {
          description:
            'Существующая атрибуция уже зафиксирована и не переносится на нового реферера.'
        });
      } else {
        toast.success('Участник перенесён');
      }
      setTransferMemberTarget(null);
      setTargetOrganizationId('');
      await load({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось');
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
    if (loadError) {
      return (
        <Alert variant='destructive'>
          <AlertTitle>Не удалось загрузить организацию</AlertTitle>
          <AlertDescription className='mt-2 space-y-3'>
            <p>{loadError}</p>
            <Button type='button' variant='outline' onClick={() => void load()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
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
  const selectedMember = selectedMemberId
    ? (members.find((member) => member.id === selectedMemberId) ?? null)
    : null;
  const query = memberSearch.trim().toLocaleLowerCase('ru-RU');
  const searchedMembers = query
    ? members.filter((member) =>
        [
          member.name,
          member.email,
          member.phone,
          member.referrerName,
          member.invitedByName,
          ...member.directReferrals.map((referral) => referral.name),
          member.outboundPlanName,
          member.attributionPlanName
        ].some((value) => value?.toLocaleLowerCase('ru-RU').includes(query))
      )
    : members;
  const filteredMembers = [...searchedMembers].sort((left, right) =>
    compareMembers(left, right, memberSortField, memberSortOrder)
  );
  const handleMemberSort = (field: MemberSortField) => {
    if (memberSortField === field) {
      setMemberSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setMemberSortField(field);
    setMemberSortOrder(field === 'name' ? 'asc' : 'desc');
  };
  const openMemberSheet = (memberId: string, trigger: HTMLButtonElement) => {
    memberTriggerRef.current = trigger;
    setSelectedMemberId(memberId);
  };

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
              Проверьте реферальные связи и доли участников. Управляющий доступ
              не создаёт выплату автоматически.
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
            {organization.firstPurchaseDiscountPercent > 0 && (
              <Badge variant='secondary'>
                Скидка на первую покупку{' '}
                {organization.firstPurchaseDiscountPercent}%
              </Badge>
            )}
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
                основной управляющий: {directorName}
              </>
            )}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' size='sm' onClick={openEdit}>
            <Pencil className='mr-2 h-4 w-4' />
            Настройки
          </Button>
        </div>
      </div>

      {stats && (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'>
          {[
            { label: 'Участников', value: stats.members },
            ...stats.levels.map(({ level, count }) => ({
              label: `Уровень ${level}`,
              value: count
            })),
            { label: 'Управляющие', value: stats.managers },
            { label: 'Клиенты', value: stats.clients },
            {
              label: 'Покупки',
              value: formatRub(stats.totalPurchases)
            },
            {
              label: 'Реф. бонусы',
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
          <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
            <p className='text-muted-foreground text-xs'>
              Участник может состоять в нескольких организациях. Уровень,
              управляющий доступ и реферальные выплаты настраиваются независимо.
            </p>
            <Button onClick={openAddMember}>
              <Plus className='mr-2 h-4 w-4' />
              Добавить участника
            </Button>
          </div>

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <p className='text-sm font-medium'>Представление участников</p>
              <p className='text-muted-foreground text-xs'>
                Иерархия сохраняет ветки; список сортирует всех участников
                целиком.
              </p>
            </div>
            <ToggleGroup
              type='single'
              variant='outline'
              size='sm'
              value={memberView}
              onValueChange={(value) => {
                if (value === 'hierarchy' || value === 'list') {
                  setMemberView(value);
                }
              }}
              aria-label='Представление участников'
            >
              <ToggleGroupItem value='hierarchy' aria-label='Иерархия'>
                <Network aria-hidden='true' />
                Иерархия
              </ToggleGroupItem>
              <ToggleGroupItem value='list' aria-label='Список'>
                <List aria-hidden='true' />
                Список
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {memberView === 'hierarchy' ? (
            hierarchyLoading && !hierarchyData ? (
              <div className='flex items-center justify-center rounded-lg border py-16'>
                <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                <span className='sr-only'>Загрузка иерархии</span>
              </div>
            ) : hierarchyError ? (
              <Alert variant='destructive'>
                <AlertTitle>Не удалось загрузить иерархию</AlertTitle>
                <AlertDescription className='mt-2 space-y-3'>
                  <p>{hierarchyError}</p>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => void loadHierarchy()}
                  >
                    Повторить
                  </Button>
                </AlertDescription>
              </Alert>
            ) : hierarchyData ? (
              <HierarchyTree
                projectId={projectId}
                nodes={hierarchyData.nodes}
                rootIds={hierarchyData.rootIds}
                period={hierarchyPeriod}
                organizationId={organizationId}
                onPeriodChange={setHierarchyPeriod}
                onMemberOpen={openMemberSheet}
              />
            ) : null
          ) : (
            <Card>
              <CardContent className='p-0'>
                {members.length === 0 ? (
                  <p className='text-muted-foreground p-6 text-center text-sm'>
                    Участников пока нет. Добавьте партнёров или клиентов в эту
                    сеть.
                  </p>
                ) : (
                  <>
                    <div className='border-b p-4'>
                      <div className='relative max-w-sm'>
                        <Label htmlFor='member-search' className='sr-only'>
                          Поиск участников
                        </Label>
                        <Search
                          className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2'
                          aria-hidden='true'
                        />
                        <Input
                          id='member-search'
                          value={memberSearch}
                          onChange={(event) =>
                            setMemberSearch(event.target.value)
                          }
                          placeholder='Поиск по имени, email или телефону…'
                          className='pl-9'
                        />
                      </div>
                      <p className='text-muted-foreground mt-2 text-xs md:hidden'>
                        Таблица прокручивается по горизонтали; действия
                        закреплены справа.
                      </p>
                    </div>
                    <Table className='min-w-[1540px]'>
                      <TableHeader>
                        <TableRow>
                          <SortableMemberHead
                            field='name'
                            label='Участник'
                            activeField={memberSortField}
                            order={memberSortOrder}
                            onSort={handleMemberSort}
                          />
                          <TableHead>Уровень и доступ</TableHead>
                          <TableHead>Источник</TableHead>
                          <TableHead>Кто привёл</TableHead>
                          <TableHead>Рефереры</TableHead>
                          <SortableMemberHead
                            field='directReferrals'
                            label='Рефералы'
                            activeField={memberSortField}
                            order={memberSortOrder}
                            onSort={handleMemberSort}
                          />
                          <TableHead>План комиссии</TableHead>
                          <SortableMemberHead
                            field='joinedAt'
                            label='Добавлен'
                            activeField={memberSortField}
                            order={memberSortOrder}
                            onSort={handleMemberSort}
                          />
                          <SortableMemberHead
                            field='totalPurchases'
                            label='Покупки'
                            activeField={memberSortField}
                            order={memberSortOrder}
                            align='end'
                            onSort={handleMemberSort}
                          />
                          <SortableMemberHead
                            field='referralBonusEarned'
                            label='Реф. бонусы'
                            activeField={memberSortField}
                            order={memberSortOrder}
                            align='end'
                            onSort={handleMemberSort}
                          />
                          <TableHead className='bg-background sticky right-0 z-10 w-[72px] shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]'>
                            <span className='sr-only'>Действия</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className='min-w-[220px]'>
                              <div className='flex items-center gap-2 font-medium'>
                                <button
                                  type='button'
                                  className='hover:text-primary focus-visible:ring-ring min-h-8 rounded-sm py-1 text-start underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                                  onClick={(event) =>
                                    openMemberSheet(m.id, event.currentTarget)
                                  }
                                  aria-label={`Открыть карточку участника: ${m.name}`}
                                >
                                  {m.name}
                                </button>
                                {!m.isActive && (
                                  <Badge variant='secondary'>Неактивен</Badge>
                                )}
                              </div>
                              <div className='text-muted-foreground text-xs'>
                                {m.email || m.phone}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className='flex flex-wrap items-center gap-1.5'>
                                <OrganizationLevelBadge level={m.level} />
                                {m.canManage && (
                                  <Badge variant='secondary'>Управляющий</Badge>
                                )}
                              </div>
                              {m.title && (
                                <div className='text-muted-foreground mt-1 text-xs'>
                                  {m.title}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {m.acquisitionSource === 'QR' ? (
                                <Badge variant='secondary'>
                                  QR организации
                                </Badge>
                              ) : m.acquisitionSource === 'REFERRAL' ? (
                                <Badge variant='outline'>
                                  Реферальная ссылка
                                </Badge>
                              ) : (
                                <span className='text-muted-foreground text-sm'>
                                  Добавлен вручную
                                </span>
                              )}
                            </TableCell>
                            <TableCell className='max-w-[200px] whitespace-normal'>
                              {m.invitedByName ? (
                                <>
                                  <div className='text-sm'>
                                    {m.invitedByName}
                                  </div>
                                  <div className='text-muted-foreground text-xs'>
                                    {m.referralStatus === 'PENDING'
                                      ? 'ожидает подтверждения'
                                      : m.referralStatus === 'INFERRED'
                                        ? 'по сохранённой реферальной ссылке'
                                        : 'при регистрации'}
                                  </div>
                                </>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className='max-w-[260px] whitespace-normal'>
                              {m.referrerLinks.length > 0 ? (
                                <div className='space-y-1'>
                                  {m.referrerLinks.map((link) => (
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
                            <TableCell className='max-w-[240px] whitespace-normal'>
                              {m.directReferrals.length > 0 ? (
                                <div className='space-y-1'>
                                  <Badge variant='secondary'>
                                    {m.directReferrals.length}
                                  </Badge>
                                  {m.directReferrals.map((referral) => (
                                    <div key={referral.id} className='text-xs'>
                                      {referral.name}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className='max-w-[220px] whitespace-normal'>
                              {m.outboundPlanName ? (
                                <>
                                  <div>{m.outboundPlanName}</div>
                                  <div className='text-muted-foreground text-xs'>
                                    {m.outboundPlanInherited
                                      ? 'по умолчанию организации'
                                      : 'для приглашений'}
                                  </div>
                                </>
                              ) : m.attributionPlanName ? (
                                <>
                                  <div>{m.attributionPlanName}</div>
                                  <div className='text-muted-foreground text-xs'>
                                    по регистрации
                                  </div>
                                </>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className='text-sm'>
                              <div>{formatDate(m.joinedAt)}</div>
                              <div className='text-muted-foreground text-xs'>
                                регистрация {formatDate(m.registeredAt)}
                              </div>
                            </TableCell>
                            <TableCell className='text-right text-sm font-medium tabular-nums'>
                              {formatRub(m.totalPurchases)}
                            </TableCell>
                            <TableCell className='text-right text-sm font-medium tabular-nums'>
                              {formatRub(m.referralBonusEarned)}
                            </TableCell>
                            <TableCell className='bg-background sticky right-0 z-10 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]'>
                              <div className='flex justify-end'>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={`Действия: ${m.name}`}
                                    >
                                      <MoreHorizontal />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align='end'>
                                    <DropdownMenuGroup>
                                      <DropdownMenuItem
                                        onSelect={() => openEditMember(m)}
                                      >
                                        <Pencil />
                                        Редактировать
                                      </DropdownMenuItem>
                                      {(Boolean(m.level) || m.canManage) && (
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            void copyMemberReferralLink(m)
                                          }
                                        >
                                          <Copy />
                                          Копировать реферальную ссылку
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onSelect={() => openTransferMember(m)}
                                      >
                                        <ArrowRightLeft />
                                        Перенести
                                      </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                      <DropdownMenuItem
                                        variant='destructive'
                                        onSelect={() =>
                                          setRemoveMemberTarget(m)
                                        }
                                      >
                                        <UserMinus />
                                        Убрать из организации
                                      </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredMembers.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={11}
                              className='text-muted-foreground h-24 text-center'
                            >
                              По вашему запросу участники не найдены
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value='about' className='mt-4 space-y-4'>
          <OrganizationQrCard
            projectId={projectId}
            organizationId={organizationId}
            organizationName={organization.name}
            slug={organization.slug}
            domain={organization.project?.domain}
            firstPurchaseDiscountPercent={
              organization.firstPurchaseDiscountPercent
            }
          />
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

      <OrganizationMemberSheet
        projectId={projectId}
        organizationId={organizationId}
        member={selectedMember}
        open={Boolean(selectedMember)}
        returnFocusRef={memberTriggerRef}
        onOpenChange={(open) => {
          if (!open) setSelectedMemberId(null);
        }}
        onEdit={(member) => {
          const target = members.find(
            (candidate) => candidate.id === member.id
          );
          if (target) openEditMember(target);
        }}
        onTransfer={(member) => {
          const target = members.find(
            (candidate) => candidate.id === member.id
          );
          if (target) openTransferMember(target);
        }}
        onRemove={(member) => {
          const target = members.find(
            (candidate) => candidate.id === member.id
          );
          if (target) setRemoveMemberTarget(target);
        }}
      />

      {/* Edit org dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col overflow-hidden p-0'>
          <DialogHeader className='shrink-0 px-6 pt-6'>
            <DialogTitle>Настройки организации</DialogTitle>
            <DialogDescription>
              Изменения slug повлияют на utm_org в реферальных ссылках
            </DialogDescription>
          </DialogHeader>
          <div className='grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-6 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='org-name'>Название</Label>
              <Input
                id='org-name'
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='org-slug'>Slug (URL)</Label>
              <Input
                id='org-slug'
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='org-description'>Описание</Label>
              <Textarea
                id='org-description'
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <FieldGroup className='gap-4'>
              <Field
                data-invalid={
                  parseDiscountPercent(editFirstPurchaseDiscountPercent) ===
                  null
                }
              >
                <FieldLabel htmlFor='org-first-purchase-discount'>
                  Приветственная скидка, %
                </FieldLabel>
                <Input
                  id='org-first-purchase-discount'
                  type='number'
                  min={0}
                  max={100}
                  step={1}
                  value={editFirstPurchaseDiscountPercent}
                  onChange={(event) =>
                    setEditFirstPurchaseDiscountPercent(event.target.value)
                  }
                  aria-invalid={
                    parseDiscountPercent(editFirstPurchaseDiscountPercent) ===
                    null
                  }
                />
                <FieldDescription>
                  Для участников этой организации без покупок. Значение 0
                  отключает скидку организации; общая скидка проекта продолжит
                  действовать, если она включена.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <div className='space-y-2'>
              <Label htmlFor='org-default-plan'>
                Партнёрский план по умолчанию
              </Label>
              <Select
                value={editPlanId || '__none__'}
                onValueChange={(v) => setEditPlanId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger id='org-default-plan' className='w-full'>
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
              <Label htmlFor='org-director'>Основной управляющий</Label>
              <p className='text-muted-foreground text-xs'>
                Получает доступ к участникам этой организации, но не участвует в
                выплатах автоматически. Один пользователь может управлять
                несколькими организациями.
              </p>
              <PartnerUserCombobox
                id='org-director'
                projectId={projectId}
                value={editDirectorId}
                initialUser={directorInitialUser}
                onChange={(u) => setEditDirectorId(u?.id ?? '')}
                partnerRolesOnly={false}
                placeholder='Выберите управляющего…'
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
          <DialogFooter className='bg-background shrink-0 border-t px-6 py-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setEditOpen(false)}
            >
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
        <DialogContent className='flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col overflow-hidden p-0'>
          <form
            className='flex min-h-0 flex-1 flex-col overflow-hidden'
            onSubmit={(event) => {
              event.preventDefault();
              void addMember();
            }}
          >
            <DialogHeader className='shrink-0 px-6 pt-6'>
              <DialogTitle>Добавить в организацию</DialogTitle>
              <DialogDescription>
                Пользователь останется в других организациях, если уже состоит в
                них.
              </DialogDescription>
            </DialogHeader>
            <div className='grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-6 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='new-member-user'>Пользователь</Label>
                <PartnerUserCombobox
                  id='new-member-user'
                  projectId={projectId}
                  value={newUserId}
                  onChange={(u) => {
                    setNewUserId(u?.id ?? '');
                    setNewUserError('');
                  }}
                  partnerRolesOnly={false}
                  excludedUserIds={members.map((member) => member.id)}
                  ariaInvalid={Boolean(newUserError)}
                  placeholder='Поиск по имени, email, телефону…'
                />
                {newUserError && (
                  <p role='alert' className='text-destructive text-sm'>
                    {newUserError}
                  </p>
                )}
              </div>

              <FieldGroup className='gap-4'>
                <Field>
                  <FieldLabel htmlFor='new-member-level'>
                    Уровень в организации
                  </FieldLabel>
                  <Input
                    id='new-member-level'
                    type='number'
                    min={1}
                    step={1}
                    value={newLevel}
                    onChange={(event) => setNewLevel(event.target.value)}
                    placeholder='Не задан'
                  />
                  <FieldDescription>
                    Любое целое число от 1. Оставьте пустым для обычного
                    клиента. Количество уровней не ограничено.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor='new-member-title'>
                    Название роли
                  </FieldLabel>
                  <Input
                    id='new-member-title'
                    value={newTitle}
                    maxLength={120}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder='Например, региональный куратор'
                  />
                </Field>
                <Field>
                  <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
                    <div>
                      <FieldLabel htmlFor='new-member-manage'>
                        Управляющий доступ
                      </FieldLabel>
                      <FieldDescription>
                        Видит и редактирует участников без автоматической
                        комиссии.
                      </FieldDescription>
                    </div>
                    <Switch
                      id='new-member-manage'
                      checked={newCanManage}
                      onCheckedChange={setNewCanManage}
                    />
                  </div>
                </Field>
              </FieldGroup>
              <ReferralLinksEditor
                projectId={projectId}
                organizationId={organizationId}
                members={members}
                childUserId={newUserId}
                value={newReferrerLinks}
                onChange={setNewReferrerLinks}
              />
              <div className='space-y-2'>
                <Label htmlFor='new-member-plan'>
                  План для приглашённых этим участником
                </Label>
                <Select
                  value={newPlanId || '__none__'}
                  onValueChange={(v) => setNewPlanId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger id='new-member-plan'>
                    <SelectValue placeholder='План организации' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>План организации</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className='bg-background shrink-0 border-t px-6 py-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setAddMemberOpen(false)}
              >
                Отмена
              </Button>
              <Button type='submit' disabled={saving}>
                {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Добавить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit member dialog */}
      <Dialog
        open={Boolean(editMember)}
        onOpenChange={(open) => !open && setEditMember(null)}
      >
        <DialogContent className='flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col overflow-hidden p-0'>
          <DialogHeader className='shrink-0 px-6 pt-6'>
            <DialogTitle>Участник: {editMember?.name}</DialogTitle>
            <DialogDescription>
              Уровень, управляющий доступ, рефереры и план этой организации
            </DialogDescription>
          </DialogHeader>
          <div className='grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-6 py-4'>
            <FieldGroup className='gap-4'>
              <Field>
                <FieldLabel htmlFor='edit-member-level'>
                  Уровень в организации
                </FieldLabel>
                <Input
                  id='edit-member-level'
                  type='number'
                  min={1}
                  step={1}
                  value={memberLevel}
                  onChange={(event) => setMemberLevel(event.target.value)}
                  placeholder='Не задан'
                />
              </Field>
              <Field>
                <FieldLabel htmlFor='edit-member-title'>
                  Название роли
                </FieldLabel>
                <Input
                  id='edit-member-title'
                  value={memberTitle}
                  maxLength={120}
                  onChange={(event) => setMemberTitle(event.target.value)}
                />
              </Field>
              <Field>
                <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
                  <div>
                    <FieldLabel htmlFor='edit-member-manage'>
                      Управляющий доступ
                    </FieldLabel>
                    <FieldDescription>
                      Не добавляет процент к выплатам.
                    </FieldDescription>
                  </div>
                  <Switch
                    id='edit-member-manage'
                    checked={memberCanManage}
                    onCheckedChange={setMemberCanManage}
                  />
                </div>
              </Field>
            </FieldGroup>
            <ReferralLinksEditor
              projectId={projectId}
              organizationId={organizationId}
              members={members}
              childUserId={editMember?.id}
              value={memberReferrerLinks}
              onChange={setMemberReferrerLinks}
            />
            <div className='space-y-2'>
              <Label htmlFor='edit-member-plan'>
                План для приглашённых этим участником
              </Label>
              <Select
                value={memberPlanId || '__none__'}
                onValueChange={(v) =>
                  setMemberPlanId(v === '__none__' ? '' : v)
                }
              >
                <SelectTrigger id='edit-member-plan' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>План организации</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className='bg-background shrink-0 border-t px-6 py-4'>
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

      <Dialog
        open={Boolean(transferMemberTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setTransferMemberTarget(null);
            setTargetOrganizationId('');
          }
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Перенести участника</DialogTitle>
            <DialogDescription>
              «{transferMemberTarget?.name}» будет перенесён в другую
              организацию с сохранением роли и outbound-плана.
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-2 py-2'>
            <Label>Целевая организация</Label>
            <Select
              value={targetOrganizationId}
              onValueChange={setTargetOrganizationId}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Выберите организацию' />
              </SelectTrigger>
              <SelectContent>
                {organizations
                  .filter((candidate) => candidate.id !== organizationId)
                  .map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                      {candidate.isActive ? '' : ' (неактивна)'}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {organizations.every(
              (candidate) => candidate.id === organizationId
            ) && (
              <p className='text-muted-foreground text-sm'>
                Других организаций в проекте нет.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setTransferMemberTarget(null)}
            >
              Отмена
            </Button>
            <Button
              onClick={transferMember}
              disabled={saving || !targetOrganizationId}
            >
              {saving && <Loader2 className='animate-spin' />}
              Перенести
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
