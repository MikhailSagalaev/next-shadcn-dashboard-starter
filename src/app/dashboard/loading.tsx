import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className='space-y-6 px-6 py-6' aria-label='Загрузка дашборда'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className='h-28 rounded-xl' />
        ))}
      </div>
      <div className='grid gap-6 lg:grid-cols-7'>
        <Skeleton className='h-80 lg:col-span-4' />
        <Skeleton className='h-80 lg:col-span-3' />
      </div>
      <Skeleton className='h-56' />
    </div>
  );
}
