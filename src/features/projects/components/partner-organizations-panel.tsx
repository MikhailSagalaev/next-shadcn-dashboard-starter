/**
 * @file: partner-organizations-panel.tsx
 * @description: Список B2B-организаций — компактный UI, создание в диалоге
 * @project: SaaS Bonus System
 * @created: 2026-06-06
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';

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
  DialogTitle,
  DialogTrigger
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { PartnerUserCombobox } from './partner-user-combobox';

type PlanOption = { id: string; name: string };

type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  defaultReferralCommissionPlanId: string | null;
  directorUserId: string | null;
  defaultReferralCommissionPlan?: { id: string; name: string } | null;
  _count?: { members: number };
};

interface Props {
  projectId: string;
}

export function PartnerOrganizationsPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [defaultPlanId, setDefaultPlanId] = useState('');
  const [directorUserId, setDirectorUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRes, planRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/organizations`),
        fetch(`/api/projects/${projectId}/referral-commission-plans`)
      ]);
      if (orgRes.ok) {
        const data = await orgRes.json();
        setOrganizations(data.organizations ?? []);
      }
      if (planRes.ok) {
        const data = await planRes.json();
        setPlans(
          (data.plans ?? []).map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name
          }))
        );
      }
    } catch {
      toast.error('Не удалось загрузить организации');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setDefaultPlanId('');
    setDirectorUserId('');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Укажите название');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          defaultReferralCommissionPlanId: defaultPlanId || null,
          directorUserId: directorUserId || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось создать');
      toast.success('Организация создана');
      setCreateOpen(false);
      resetForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/organizations/${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось удалить');
      toast.success('Организация удалена');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground max-w-2xl text-sm'>
          Отдельные партнёрские сети внутри проекта — свой руководитель, план
          партнёрских планов и изолированная иерархия. Ссылки партнёров
          добавляют <code className='text-xs'>utm_org=slug</code>.
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className='mr-2 h-4 w-4' />
              Новая организация
            </Button>
          </DialogTrigger>
          <DialogContent className='max-w-lg'>
            <DialogHeader>
              <DialogTitle>Новая организация</DialogTitle>
              <DialogDescription>
                Slug попадёт в реферальные ссылки и атрибуцию Tilda
              </DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-2'>
              <div className='space-y-2'>
                <Label htmlFor='new-org-name'>Название</Label>
                <Input
                  id='new-org-name'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Сеть X-Fit Москва'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='new-org-slug'>Slug</Label>
                <Input
                  id='new-org-slug'
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder='xfit-moscow (авто из названия)'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='new-org-description'>Описание</Label>
                <Textarea
                  id='new-org-description'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='new-org-plan'>
                  Партнёрский план по умолчанию
                </Label>
                <Select
                  value={defaultPlanId || '__none__'}
                  onValueChange={(v) =>
                    setDefaultPlanId(v === '__none__' ? '' : v)
                  }
                >
                  <SelectTrigger id='new-org-plan'>
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
                <Label htmlFor='new-org-director'>Руководитель</Label>
                <PartnerUserCombobox
                  id='new-org-director'
                  projectId={projectId}
                  value={directorUserId}
                  onChange={(u) => setDirectorUserId(u?.id ?? '')}
                  partnerRolesOnly={false}
                  placeholder='Выберите руководителя…'
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
            <Building2 className='text-muted-foreground h-10 w-10' />
            <p className='text-muted-foreground text-sm'>
              Организаций пока нет. Создайте первую сеть.
            </p>
            <Button variant='outline' onClick={() => setCreateOpen(true)}>
              <Plus className='mr-2 h-4 w-4' />
              Создать
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-3'>
          {organizations.map((org) => (
            <Card key={org.id} className='hover:bg-muted/30 transition-colors'>
              <CardHeader className='flex flex-row items-center justify-between gap-4 py-4'>
                <Link
                  href={`/dashboard/projects/${projectId}/referral/organizations/${org.id}`}
                  className='min-w-0 flex-1'
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <CardTitle className='text-lg'>{org.name}</CardTitle>
                    <Badge variant={org.isActive ? 'default' : 'secondary'}>
                      {org.isActive ? 'Активна' : 'Выкл.'}
                    </Badge>
                  </div>
                  <CardDescription className='mt-1'>
                    <code>{org.slug}</code>
                    {' · '}
                    {org._count?.members ?? 0} участн.
                    {org.defaultReferralCommissionPlan && (
                      <>
                        {' · '}
                        {org.defaultReferralCommissionPlan.name}
                      </>
                    )}
                  </CardDescription>
                </Link>
                <div className='flex shrink-0 items-center gap-1'>
                  <Button variant='ghost' size='icon' asChild>
                    <Link
                      href={`/dashboard/projects/${projectId}/referral/organizations/${org.id}`}
                      aria-label={`Открыть организацию «${org.name}»`}
                    >
                      <ChevronRight aria-hidden='true' className='h-5 w-5' />
                    </Link>
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setDeleteTarget(org)}
                    aria-label={`Удалить организацию «${org.name}»`}
                  >
                    <Trash2
                      aria-hidden='true'
                      className='text-destructive h-4 w-4'
                    />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title='Удалить организацию?'
        description={
          deleteTarget
            ? `«${deleteTarget.name}» будет удалена. Участники останутся в проекте без привязки к сети.`
            : ''
        }
        confirmLabel='Удалить'
        variant='destructive'
        onConfirm={handleDelete}
      />
    </div>
  );
}
