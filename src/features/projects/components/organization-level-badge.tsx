'use client';

import type { CSSProperties } from 'react';

import { Badge } from '@/components/ui/badge';
import { getOrganizationLevelHue } from '@/lib/organization-level-colors';
import { cn } from '@/lib/utils';

type LevelBadgeStyle = CSSProperties & {
  '--organization-level-hue'?: number;
};

interface OrganizationLevelBadgeProps {
  level: number | null | undefined;
  className?: string;
}

/**
 * Organization levels are unbounded, so the number is the primary marker and
 * a deterministic OKLCH hue is a supplementary visual cue.
 */
export function OrganizationLevelBadge({
  level,
  className
}: OrganizationLevelBadgeProps) {
  if (!level || level < 1) {
    return (
      <Badge variant='outline' className={className}>
        Клиент
      </Badge>
    );
  }

  const style: LevelBadgeStyle = {
    '--organization-level-hue': getOrganizationLevelHue(level)
  };

  return (
    <Badge
      variant='outline'
      className={cn('organization-level-badge font-medium', className)}
      style={style}
    >
      Уровень {level}
    </Badge>
  );
}
