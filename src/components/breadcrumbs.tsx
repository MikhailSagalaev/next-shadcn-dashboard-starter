'use client';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import { IconSlash } from '@tabler/icons-react';
import { Fragment } from 'react';

// Глубоко вложенные разделы (например сеть внутри организаций внутри реф-программы)
// дают 6 крошек и переполняют шапку. Схлопываем середину: первый → … → последние
// два. Порог 4 подобран так, чтобы обычные пути (≤4) показывались целиком.
const MAX_VISIBLE = 4;

export function Breadcrumbs() {
  const items = useBreadcrumbs();
  if (items.length === 0) return null;

  const collapsed =
    items.length > MAX_VISIBLE
      ? [
          { ...items[0], _kind: 'link' as const },
          { title: '', link: '', _kind: 'ellipsis' as const },
          ...items.slice(-2).map((it) => ({ ...it, _kind: 'link' as const }))
        ]
      : items.map((it) => ({ ...it, _kind: 'link' as const }));

  return (
    <Breadcrumb className='min-w-0'>
      <BreadcrumbList className='flex-nowrap overflow-hidden'>
        {collapsed.map((item, index) => {
          const isLast = index === collapsed.length - 1;
          return (
            <Fragment key={`${item.link}-${index}`}>
              {item._kind === 'ellipsis' ? (
                <BreadcrumbItem className='shrink-0'>
                  <BreadcrumbEllipsis className='size-4' />
                </BreadcrumbItem>
              ) : isLast ? (
                <BreadcrumbItem className='min-w-0'>
                  <BreadcrumbPage className='truncate'>
                    {item.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem className='hidden min-w-0 shrink md:flex'>
                  <BreadcrumbLink href={item.link} className='truncate'>
                    {item.title}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              )}
              {!isLast && (
                <BreadcrumbSeparator className='hidden shrink-0 md:flex'>
                  <IconSlash />
                </BreadcrumbSeparator>
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
