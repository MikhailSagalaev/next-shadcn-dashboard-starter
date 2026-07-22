'use client';

import Link from 'next/link';
import { BookOpenCheck, Package, ReceiptText, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WorkspaceSection = 'integration' | 'catalog' | 'orders';

const sections = [
  {
    id: 'integration' as const,
    label: 'Настройка кассы',
    icon: Settings2,
    href: 'integrations/yookassa-fiscal'
  },
  {
    id: 'catalog' as const,
    label: 'Каталог',
    icon: Package,
    href: 'products'
  },
  {
    id: 'orders' as const,
    label: 'Заказы',
    icon: ReceiptText,
    href: 'orders'
  }
];

export function MarkingWorkspaceNav({
  projectId,
  active
}: {
  projectId: string;
  active: WorkspaceSection;
}) {
  return (
    <div className='bg-card flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between'>
      <nav
        className='flex min-w-0 gap-1 overflow-x-auto'
        aria-label='Маркировка'
      >
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant={active === section.id ? 'secondary' : 'ghost'}
              asChild
              className={cn(active === section.id && 'font-semibold')}
            >
              <Link
                href={`/dashboard/projects/${projectId}/${section.href}`}
                aria-current={active === section.id ? 'page' : undefined}
              >
                <Icon /> {section.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <TestingGuide />
    </div>
  );
}

function TestingGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='outline' className='shrink-0'>
          <BookOpenCheck /> Как проверить без покупки
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Безопасная проверка маркировки</DialogTitle>
          <DialogDescription>
            Разделяйте проверку интерфейса, тест ЮKassa и настоящее выбытие в
            «Честном знаке». Это три разных уровня.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 text-sm'>
          <TestStep
            number='1'
            title='Проверьте 2D-сканер бесплатно'
            description='Подключите USB/Bluetooth-сканер в режиме клавиатуры, включите английскую раскладку и сделайте 20 считываний в Блокнот. Сканер должен вводить всю строку Data Matrix и завершать её Enter. На странице заказа есть отдельная проверка, которая ничего не сохраняет.'
          />
          <TestStep
            number='2'
            title='Используйте отдельный тестовый проект и магазин ЮKassa'
            description='В тестовом магазине деньги не списываются, а режим проверки чеков имитирует кассу. Боевой заказ нельзя проверять тестовым ключом: payment_id принадлежит конкретному shopId. Создайте отдельный проект Gupil и направьте тестовую оплату Tilda в тестовый магазин.'
            href='https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing'
            linkLabel='Инструкция ЮKassa'
          />
          <TestStep
            number='3'
            title='Для полного теста используйте демоконтур ГИС МТ'
            description='Тест ЮKassa проверяет платежи и структуру чека, но не реальное выбытие кода. Демоконтур «Честного знака» позволяет бесплатно получить тестовые коды, отправить тестовый чек через тестовый ОФД и проверить статус «Выбыл».'
            href='https://markirovka.ru/knowledge/tovarnye-gruppy/obschie-voprosy-gis/kak-mozhno-protestirovat-rabotu-kassy-na-testovom-stende'
            linkLabel='Как настроить тестовый стенд'
          />
          <div className='rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100'>
            Не отправляйте выдуманный Data Matrix через боевые реквизиты. Для
            рабочего чека нужен настоящий код с фактической упаковки; для
            экспериментов используйте только тестовый магазин или демоконтур.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TestStep({
  number,
  title,
  description,
  href,
  linkLabel
}: {
  number: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className='flex gap-3 rounded-lg border p-4'>
      <span className='bg-primary text-primary-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-semibold'>
        {number}
      </span>
      <div>
        <div className='font-medium'>{title}</div>
        <p className='text-muted-foreground mt-1'>{description}</p>
        {href && (
          <a
            className='text-primary mt-2 inline-block hover:underline'
            href={href}
            target='_blank'
            rel='noreferrer'
          >
            {linkLabel} ↗
          </a>
        )}
      </div>
    </div>
  );
}
