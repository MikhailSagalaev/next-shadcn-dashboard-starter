/**
 * @file: route.ts
 * @description: Аналитика в разрезе b2b-организаций проекта
 * @project: SaaS Bonus System
 * @dependencies: Next.js, Prisma, withProjectAccess
 * @created: 2026-06-23
 *
 * Возвращает по каждой организации: число пользователей, сумму активных
 * бонусов (не использованных и не истёкших) и сумму начислений (EARN).
 * Доступно только при включённой партнёрской иерархии (`enablePartnerRoles`);
 * иначе отдаём `{ enabled: false }`, чтобы UI не показывал лишнюю вкладку.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withProjectAccess } from '@/lib/with-project-access';

export const GET = withProjectAccess(async (_request, { projectId }) => {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { enablePartnerRoles: true }
  });

  if (!project?.enablePartnerRoles) {
    return NextResponse.json({ enabled: false, organizations: [] });
  }

  // Организации проекта + независимые членства (пользователь может быть в
  // нескольких организациях одновременно).
  const [orgs, members] = await Promise.all([
    db.partnerOrganization.findMany({
      where: { projectId },
      select: { id: true, name: true, slug: true, isActive: true },
      orderBy: { name: 'asc' }
    }),
    db.partnerOrganizationMembership.findMany({
      where: { projectId },
      select: { userId: true, organizationId: true }
    })
  ]);

  const memberIds = [
    ...new Set(members.map((membership) => membership.userId))
  ];
  const userToOrganizations = new Map<string, string[]>();
  for (const membership of members) {
    const organizationIds = userToOrganizations.get(membership.userId) ?? [];
    organizationIds.push(membership.organizationId);
    userToOrganizations.set(membership.userId, organizationIds);
  }

  // Агрегаты по пользователям организаций (один проход на тип метрики).
  const [txByUser, activeBonusByUser] = await Promise.all([
    memberIds.length
      ? db.transaction.groupBy({
          by: ['userId', 'type'],
          where: { userId: { in: memberIds }, type: 'EARN' },
          _sum: { amount: true }
        })
      : Promise.resolve([] as any[]),
    memberIds.length
      ? db.bonus.groupBy({
          by: ['userId'],
          where: {
            userId: { in: memberIds },
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          _sum: { amount: true }
        })
      : Promise.resolve([] as any[])
  ]);

  // Инициализируем агрегаты по организациям.
  const acc = new Map<
    string,
    { usersCount: number; activeBonuses: number; totalEarned: number }
  >();
  for (const org of orgs) {
    acc.set(org.id, { usersCount: 0, activeBonuses: 0, totalEarned: 0 });
  }
  for (const m of members) {
    const bucket = acc.get(m.organizationId);
    if (bucket) bucket.usersCount += 1;
  }
  for (const row of txByUser) {
    for (const organizationId of userToOrganizations.get(row.userId) ?? []) {
      const bucket = acc.get(organizationId);
      if (bucket) bucket.totalEarned += Number(row._sum?.amount || 0);
    }
  }
  for (const row of activeBonusByUser) {
    for (const organizationId of userToOrganizations.get(row.userId) ?? []) {
      const bucket = acc.get(organizationId);
      if (bucket) bucket.activeBonuses += Number(row._sum?.amount || 0);
    }
  }

  const organizations = orgs.map((org) => {
    const a = acc.get(org.id)!;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
      usersCount: a.usersCount,
      activeBonuses: Number(a.activeBonuses.toFixed(2)),
      totalEarned: Number(a.totalEarned.toFixed(2))
    };
  });

  return NextResponse.json({ enabled: true, organizations });
});
