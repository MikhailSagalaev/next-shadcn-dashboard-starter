/**
 * @file: src/lib/services/billing-plan.utils.ts
 * @description: Утилиты для нормализации тарифных планов и расчетов лимитов
 * @project: SaaS Bonus System
 * @created: 2025-11-16
 */

import { Prisma } from '@prisma/client';

export type PlanLimits = {
  projects: number;
  users: number;
  bots: number;
  notifications: number;
};

const PLAN_LIMIT_PRESETS: Record<string, Partial<PlanLimits>> = {
  free: { projects: 1, users: 100, bots: 1, notifications: 1000 },
  starter: { projects: 1, users: 100, bots: 1, notifications: 1000 },
  pro: { projects: 5, users: 1000, bots: 5, notifications: 10000 },
  professional: { projects: 5, users: 1000, bots: 5, notifications: 10000 },
  enterprise: { projects: -1, users: -1, bots: -1, notifications: -1 }
};

export const POPULAR_PLAN_SLUGS = new Set(['pro', 'professional']);

export const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
};

export const parseFeatures = (features: Prisma.JsonValue | null): string[] => {
  if (!features) return [];
  if (Array.isArray(features)) {
    return features.map((item) => String(item));
  }

  if (typeof features === 'object') {
    const description = (features as Record<string, unknown>).description;
    if (Array.isArray(description)) {
      return description.map((item) => String(item));
    }
  }

  return [];
};

export const derivePlanLimits = (plan: {
  slug: string;
  maxProjects: number;
  maxUsersPerProject: number;
}): PlanLimits => {
  const preset =
    PLAN_LIMIT_PRESETS[plan.slug] ||
    PLAN_LIMIT_PRESETS[plan.slug?.toLowerCase?.() || ''] ||
    {};

  const projectsLimit =
    typeof preset.projects === 'number'
      ? preset.projects
      : (plan.maxProjects ?? -1);
  const botsLimit =
    typeof preset.bots === 'number' ? preset.bots : projectsLimit;

  const notificationsLimit =
    typeof preset.notifications === 'number' ? preset.notifications : -1;

  let usersLimit: number;
  if (typeof preset.users === 'number') {
    usersLimit = preset.users;
  } else if (plan.maxUsersPerProject && projectsLimit && projectsLimit > 0) {
    usersLimit = plan.maxUsersPerProject * projectsLimit;
  } else if (plan.maxUsersPerProject) {
    usersLimit = plan.maxUsersPerProject;
  } else {
    usersLimit = -1;
  }

  return {
    projects: projectsLimit ?? -1,
    users: usersLimit ?? -1,
    bots: botsLimit ?? -1,
    notifications: notificationsLimit
  };
};

export const formatPlan = (
  plan: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    price: Prisma.Decimal;
    currency: string;
    interval: string;
    features: Prisma.JsonValue | null;
    maxProjects: number;
    maxUsersPerProject: number;
    isActive: boolean;
    isPublic: boolean;
    sortOrder: number;
  },
  options: {
    status?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    nextPaymentDate?: Date | null;
  } = {}
) => {
  const limits = derivePlanLimits(plan);

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    price: toNumber(plan.price),
    currency: plan.currency,
    interval: (plan.interval as 'month' | 'year') || 'month',
    features: parseFeatures(plan.features),
    limits,
    popular: POPULAR_PLAN_SLUGS.has(plan.slug),
    isActive: plan.isActive,
    isPublic: plan.isPublic,
    sortOrder: plan.sortOrder,
    status: options.status ?? null,
    startDate: options.startDate?.toISOString() ?? null,
    endDate: options.endDate?.toISOString() ?? null,
    nextPaymentDate: options.nextPaymentDate?.toISOString() ?? null
  };
};
