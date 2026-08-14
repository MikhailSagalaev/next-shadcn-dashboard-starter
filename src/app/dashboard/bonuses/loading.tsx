import { Skeleton } from '@/components/ui/skeleton';

export default function BonusesLoading() {
  return (
    <div className='space-y-6 p-6' aria-label='Загрузка бонусов'>
      <Skeleton className='h-10 w-72 max-w-full' />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-28 rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-[28rem]' />
    </div>
  );
}
