# Dashboard Design System - Правила дизайна страниц

> **Статус:** ✅ Активен  
> **Применяется к:** Всем страницам dashboard и admin панелей  
> **Основано на:** `/dashboard` архитектура и UI паттерны

## 🎯 Общие принципы

### Архитектура страниц
1. **Server Components First** - все страницы по умолчанию Server Components
2. **Data Access Layer** - отдельный файл `data-access.ts` для загрузки данных
3. **Client Components** - только для интерактивных элементов (графики, формы, анимации)
4. **Композиция** - разделение на переиспользуемые компоненты

### Структура файлов страницы
```
src/app/[section]/
├── page.tsx              # Server Component (главная страница)
├── layout.tsx            # Layout с sidebar/header
├── data-access.ts        # Функции загрузки данных
└── components/           # Компоненты страницы
    ├── stats-cards.tsx   # Client Component (анимации)
    ├── charts.tsx        # Client Component (графики)
    ├── table.tsx         # Server Component (статика)
    └── actions.tsx       # Client Component (кнопки)
```

## 📐 Layout структура

### Обязательные элементы layout
```tsx
// layout.tsx
import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function SectionLayout({ children }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  
  return (
    <KBar>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset className='h-screen'>
          <Header />
          <div className='flex-1 overflow-y-scroll'>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
```

### Header компоненты
- **SidebarTrigger** - кнопка сворачивания sidebar
- **Breadcrumbs** - навигационные хлебные крошки
- **SearchInput** - поиск (скрыт на мобильных)
- **UserNav** - меню пользователя
- **ModeToggle** - переключатель темы
- **ThemeSelector** - выбор цветовой схемы

## 🎨 Дизайн-система

### Цветовая палитра (CSS Variables)
```css
/* Light Theme */
--background: oklch(1 0 0);           /* Белый фон */
--foreground: oklch(0.145 0 0);       /* Черный текст */
--card: oklch(1 0 0);                 /* Белые карточки */
--muted-foreground: oklch(0.556 0 0); /* Серый текст */
--border: oklch(0.922 0 0);           /* Светлые границы */

/* Dark Theme */
--background: oklch(0.145 0 0);       /* Темный фон */
--foreground: oklch(0.985 0 0);       /* Светлый текст */
--card: oklch(0.205 0 0);             /* Темные карточки */
--border: oklch(1 0 0 / 10%);         /* Прозрачные границы */
```

### Glass Effect (Glassmorphism)
```css
.glass-card {
  @apply bg-white/60 backdrop-blur-xl dark:bg-zinc-900/60 
         supports-[backdrop-filter]:bg-white/40 
         supports-[backdrop-filter]:dark:bg-zinc-900/40;
}
```

**Применение:**
- Карточки статистики
- Модальные окна
- Всплывающие панели
- Hover эффекты

## 📄 Структура страницы

### Обязательный шаблон page.tsx
```tsx
/**
 * @file: page.tsx
 * @description: [Описание страницы]
 * @project: SaaS Bonus System
 * @created: YYYY-MM-DD
 */

import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { getPageData } from './data-access';

export const metadata = {
  title: '[Название] | Gupil',
  description: '[Описание для SEO]'
};

export default async function PageName() {
  const data = await getPageData();

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <Heading
          title='[Заголовок страницы]'
          description='[Краткое описание]'
        />
      </div>

      <Separator className='my-4' />

      {/* Stats Cards */}
      <Suspense fallback={<div>Loading stats...</div>}>
        <StatsCards data={data.stats} />
      </Suspense>

      {/* Main Content Grid */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-7'>
        <div className='col-span-1 lg:col-span-4'>
          <MainContent data={data.main} />
        </div>
        <div className='col-span-1 lg:col-span-3'>
          <SideContent data={data.side} />
        </div>
      </div>

      {/* Additional Content */}
      <div className="grid grid-cols-1">
        <AdditionalContent data={data.additional} />
      </div>
    </div>
  );
}
```

### Spacing и Layout
- **Padding страницы:** `px-6 py-6`
- **Spacing между секциями:** `space-y-6`
- **Gap в grid:** `gap-4` или `gap-6`
- **Separator margin:** `my-4`

## 📊 Компоненты статистики

### Stats Cards паттерн
```tsx
'use client';

import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
}

export function StatsCards({ data }: { data: StatCardProps[] }) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={container}
      initial='hidden'
      animate='show'
      className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'
    >
      {data.map((stat, index) => (
        <motion.div key={index} variants={item}>
          <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
            <div className={`absolute right-4 top-4 rounded-full ${stat.iconBgColor} p-2.5 ${stat.iconColor}`}>
              <stat.icon className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                {stat.title}
              </p>
              <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                {stat.value}
              </h3>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                {stat.description}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Цвета для иконок статистики
```tsx
const iconColors = {
  blue: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
  purple: { color: 'text-purple-500', bg: 'bg-purple-500/10' },
  emerald: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  amber: { color: 'text-amber-500', bg: 'bg-amber-500/10' },
  indigo: { color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  rose: { color: 'text-rose-500', bg: 'bg-rose-500/10' }
};
```

## 📈 Графики и Charts

### Recharts паттерн
```tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useTheme } from 'next-themes';

export function ChartComponent({ data }: { data: any[] }) {
  const { theme } = useTheme();

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">[Заголовок]</CardTitle>
        <CardDescription>[Описание графика]</CardDescription>
      </CardHeader>
      <CardContent className="pl-0">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke={theme === 'dark' ? '#27272a' : '#e5e7eb'} 
            />
            <XAxis
              dataKey="name"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                borderColor: theme === 'dark' ? '#27272a' : '#e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#8b5cf6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorTotal)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### Цвета для графиков
```tsx
const chartColors = {
  primary: '#8b5cf6',   // Фиолетовый
  success: '#10b981',   // Зеленый
  warning: '#f59e0b',   // Оранжевый
  danger: '#ef4444',    // Красный
  info: '#3b82f6'       // Синий
};
```

## 🎭 Анимации (Framer Motion)

### Stagger Animation для списков
```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

<motion.div variants={container} initial='hidden' animate='show'>
  {items.map((item, i) => (
    <motion.div key={i} variants={item}>
      {/* content */}
    </motion.div>
  ))}
</motion.div>
```

### Hover и Tap эффекты
```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  className='cursor-pointer'
>
  {/* content */}
</motion.div>
```

### Slide-in анимация
```tsx
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.1 }}
>
  {/* content */}
</motion.div>
```

## 🃏 Card компоненты

### Базовая карточка
```tsx
<Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
  <CardHeader>
    <CardTitle className="text-xl font-semibold">[Заголовок]</CardTitle>
    <CardDescription>[Описание]</CardDescription>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

### Интерактивная карточка с hover
```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  className='group cursor-pointer rounded-xl border border-zinc-100 bg-white p-3 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900/50'
  onClick={handleClick}
>
  <div className='flex items-center gap-4'>
    <div className='rounded-lg p-2.5 bg-blue-500/10 text-blue-500'>
      <Icon className='h-5 w-5' />
    </div>
    <div className='flex-1'>
      <h4 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors'>
        {title}
      </h4>
      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
        {description}
      </p>
    </div>
  </div>
</motion.div>
```

## 🎯 Quick Actions паттерн

### Боковая панель с действиями
```tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const actions = [
  {
    title: '[Действие]',
    description: '[Описание]',
    icon: IconComponent,
    href: '/path',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  }
];

export function QuickActions() {
  const router = useRouter();

  return (
    <Card className='h-full glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-indigo-500" />
          Быстрые действия
        </CardTitle>
        <CardDescription>Часто используемые функции</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        {actions.map((action) => (
          <motion.div
            key={action.title}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className='group cursor-pointer rounded-xl border border-zinc-100 bg-white p-3 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900/50'
            onClick={() => router.push(action.href)}
          >
            <div className='flex items-center gap-4'>
              <div className={`rounded-lg p-2.5 ${action.bgColor} ${action.color}`}>
                <action.icon className='h-5 w-5' />
              </div>
              <div className='flex-1'>
                <h4 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors'>
                  {action.title}
                </h4>
                <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                  {action.description}
                </p>
              </div>
              <div className='text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity'>
                →
              </div>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
```

## 📋 Списки и таблицы

### Recent Items паттерн
```tsx
'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ExternalLink, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export function RecentItems({ items }: { items: any[] }) {
  const router = useRouter();

  return (
    <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">[Заголовок]</CardTitle>
        <CardDescription>[Описание]</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          {items.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={item.id}
              className='group flex items-center justify-between'
            >
              <div className='flex items-center space-x-4'>
                <div className='relative'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20'>
                    <Star className="h-5 w-5 fill-white/20" />
                  </div>
                  {item.isActive && (
                    <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900"></span>
                    </span>
                  )}
                </div>

                <div className='space-y-1'>
                  <p className='text-sm font-medium leading-none text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400 transition-colors cursor-pointer'>
                    {item.name}
                  </p>
                  <div className='flex items-center text-xs text-zinc-500 dark:text-zinc-400'>
                    <span>{item.count} элементов</span>
                    <span className="mx-1.5 h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    <span>
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                        locale: ru
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className='flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100'>
                <Badge variant={item.isActive ? 'default' : 'secondary'}>
                  {item.status}
                </Badge>
                <button className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

## 🔄 Data Access Layer

### Шаблон data-access.ts
```typescript
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface PageData {
  stats: StatsData;
  items: ItemData[];
  // ... другие данные
}

export async function getPageData(): Promise<PageData> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect('/auth/login');
  }

  // Фильтр по владельцу для мультитенантности
  const ownerFilter = { ownerId: admin.sub };

  try {
    // Параллельная загрузка данных
    const [stats, items] = await Promise.all([
      getStats(ownerFilter),
      getItems(ownerFilter)
    ]);

    return {
      stats,
      items
    };
  } catch (error) {
    logger.error('Error fetching page data', { error }, 'page-service');
    // Возвращаем пустые данные вместо краша
    return {
      stats: getEmptyStats(),
      items: []
    };
  }
}

async function getStats(filter: any): Promise<StatsData> {
  // Реализация загрузки статистики
}

async function getItems(filter: any): Promise<ItemData[]> {
  // Реализация загрузки элементов
}
```

### Правила Data Access
1. **Всегда проверять аутентификацию** через `getCurrentAdmin()`
2. **Применять ownerFilter** для мультитенантности
3. **Использовать Promise.all** для параллельных запросов
4. **Обрабатывать ошибки** и возвращать fallback данные
5. **Логировать ошибки** через logger
6. **Типизировать** все возвращаемые данные

## 🎨 Responsive Design

### Breakpoints
```tsx
// Mobile First подход
className='
  grid gap-4 
  md:grid-cols-2      /* >= 768px */
  lg:grid-cols-4      /* >= 1024px */
  xl:grid-cols-6      /* >= 1280px */
'

// Скрытие на мобильных
className='hidden md:flex'

// Показ только на мобильных
className='md:hidden'
```

### Grid Layout паттерны
```tsx
// 2 колонки на desktop, 1 на mobile
<div className='grid grid-cols-1 gap-6 md:grid-cols-2'>

// 7-колоночная сетка (4+3)
<div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-7'>
  <div className='col-span-1 lg:col-span-4'>
    {/* Основной контент */}
  </div>
  <div className='col-span-1 lg:col-span-3'>
    {/* Боковая панель */}
  </div>
</div>
```

## 🎯 Badges и Status

### Status Badge паттерн
```tsx
<Badge variant={isActive ? 'default' : 'secondary'}>
  {isActive ? 'Активен' : 'Остановлен'}
</Badge>
```

### Animated Status Indicator
```tsx
{isActive && (
  <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900"></span>
  </span>
)}
```

## 📱 Empty States

### Пустое состояние
```tsx
if (items.length === 0) {
  return (
    <Card className='h-full border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle>[Заголовок]</CardTitle>
        <CardDescription>[Описание]</CardDescription>
      </CardHeader>
      <CardContent className='flex h-[200px] items-center justify-center text-sm text-zinc-500'>
        Нет данных для отображения
      </CardContent>
    </Card>
  );
}
```

## ✅ Чеклист для новой страницы

### Обязательные элементы
- [ ] Server Component по умолчанию
- [ ] Файл `data-access.ts` с типизированными функциями
- [ ] Metadata для SEO (`title`, `description`)
- [ ] Heading компонент с заголовком и описанием
- [ ] Separator после заголовка
- [ ] Suspense для асинхронных компонентов
- [ ] Glass-card стили для карточек
- [ ] Responsive grid layout
- [ ] Dark mode поддержка
- [ ] Framer Motion анимации для интерактивных элементов
- [ ] Empty states для пустых данных
- [ ] Error handling в data-access
- [ ] Owner filter для мультитенантности
- [ ] Логирование ошибок

### Стилистические требования
- [ ] Padding страницы: `px-6 py-6`
- [ ] Spacing между секциями: `space-y-6`
- [ ] Border radius: `rounded-xl`
- [ ] Shadow: `shadow-sm` с `hover:shadow-md`
- [ ] Transitions: `transition-all` или `transition-colors`
- [ ] Icon размеры: `h-5 w-5` для карточек, `h-4 w-4` для кнопок
- [ ] Font sizes: `text-xl` для заголовков карточек, `text-sm` для текста
- [ ] Colors: использовать zinc-* для нейтральных цветов

### Интерактивность
- [ ] Hover эффекты на карточках
- [ ] Cursor pointer для кликабельных элементов
- [ ] Loading states (Suspense fallbacks)
- [ ] Анимации появления (stagger для списков)
- [ ] Smooth transitions (0.2s - 0.4s)

## 🔗 Связанные документы

- `react-best-practices.md` - React паттерны
- `component-guidelines.md` - Композитные компоненты
- `quick-reference.md` - Быстрая справка
- `project-rules.md` - Общие правила проекта
