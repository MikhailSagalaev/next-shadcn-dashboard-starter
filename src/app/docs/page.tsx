import Link from 'next/link';
import { ArrowRight, BookOpen, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

const guides = [
  {
    title: 'Настроить проект',
    description: 'Откройте проект и подключите нужные каналы.',
    icon: Settings,
    href: '/dashboard/projects'
  },
  {
    title: 'Управлять бонусами',
    description: 'Проверяйте балансы, сроки и историю операций.',
    icon: BookOpen,
    href: '/dashboard/bonuses'
  },
  {
    title: 'Работать с B2B-партнерами',
    description:
      'Организации, роли, цепочки и выплаты находятся в разделе реферальной программы.',
    icon: Users,
    href: '/dashboard/projects'
  }
];

export default function DocsPage() {
  return (
    <main className='container mx-auto max-w-5xl space-y-8 px-4 py-10'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight'>
          Документация Gupil
        </h1>
        <p className='text-muted-foreground'>
          Быстрые маршруты к основным разделам сервиса.
        </p>
      </div>
      <div className='grid gap-4 md:grid-cols-3'>
        {guides.map((guide) => (
          <Card key={guide.title} className='flex flex-col'>
            <CardHeader>
              <guide.icon
                className='text-primary mb-2 h-6 w-6'
                aria-hidden='true'
              />
              <CardTitle>{guide.title}</CardTitle>
              <CardDescription>{guide.description}</CardDescription>
            </CardHeader>
            <CardContent className='mt-auto'>
              <Button asChild variant='outline'>
                <Link href={guide.href}>
                  Открыть
                  <ArrowRight className='ml-2 h-4 w-4' aria-hidden='true' />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
