---
inclusion: always
---

# React Best Practices (Next.js 15 + React 19)

> **Статус проекта:** ✅ Оптимизирован (2026-01-21)  
> **Client Components:** 5 из 19 (78% оптимизация)  
> **Основной паттерн:** Server Components First + Side Effects Isolation

## 🎯 Основные принципы

### 1. Server Components по умолчанию
- **По умолчанию все компоненты - Server Components**
- Добавляй `'use client'` только когда необходимо:
  - Интерактивность (onClick, onChange, etc.)
  - React hooks (useState, useEffect, useContext)
  - Browser APIs (window, document, localStorage)
  - Event listeners

### 2. Минимизация Client Components
```typescript
// ❌ Плохо - весь компонент клиентский
'use client';

export function Page() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <Header /> {/* Статичный, но стал клиентским */}
      <Content /> {/* Статичный, но стал клиентским */}
      <Counter count={count} onChange={setCount} /> {/* Нужен client */}
    </div>
  );
}

// ✅ Хорошо - только интерактивная часть клиентская
export function Page() {
  return (
    <div>
      <Header /> {/* Server Component */}
      <Content /> {/* Server Component */}
      <CounterClient /> {/* Client Component */}
    </div>
  );
}

// counter-client.tsx
'use client';
export function CounterClient() {
  const [count, setCount] = useState(0);
  return <Counter count={count} onChange={setCount} />;
}
```

### 3. Композиция вместо Prop Drilling
```typescript
// ❌ Плохо - пробрасывание props через уровни
export function Layout({ theme, user, settings }: Props) {
  return <Sidebar theme={theme} user={user} settings={settings} />;
}

// ✅ Хорошо - композиция через children
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Sidebar />
      {children}
    </div>
  );
}

// Использование
<Layout>
  <Content theme={theme} user={user} />
</Layout>
```

### 4. Slots Pattern для гибкости
```typescript
// ✅ Отлично - слоты для разных частей
interface LayoutProps {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Layout({ header, sidebar, children, footer }: LayoutProps) {
  return (
    <div>
      <header>{header}</header>
      <div className="flex">
        <aside>{sidebar}</aside>
        <main>{children}</main>
      </div>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}
```

## 📊 Загрузка данных

### 1. Fetch максимально близко к использованию
```typescript
// ✅ Хорошо - данные загружаются там, где используются
export async function UserProfile({ userId }: { userId: string }) {
  const user = await db.user.findUnique({ where: { id: userId } });
  
  return (
    <div>
      <h1>{user.name}</h1>
      <UserStats userId={userId} /> {/* Загрузит свои данные */}
    </div>
  );
}

async function UserStats({ userId }: { userId: string }) {
  const stats = await db.stats.findMany({ where: { userId } });
  return <div>{/* render stats */}</div>;
}
```

### 2. Параллельные запросы
```typescript
// ✅ Параллельная загрузка
export async function Dashboard() {
  const [user, projects, stats] = await Promise.all([
    getUser(),
    getProjects(),
    getStats()
  ]);
  
  return (
    <div>
      <UserInfo user={user} />
      <ProjectsList projects={projects} />
      <StatsWidget stats={stats} />
    </div>
  );
}
```

### 3. Кеширование с unstable_cache
```typescript
import { unstable_cache } from 'next/cache';

// ✅ Кеширование дорогих операций
const getCachedProjects = unstable_cache(
  async (userId: string) => {
    return await db.project.findMany({ where: { userId } });
  },
  ['projects'],
  { revalidate: 3600, tags: ['projects'] }
);
```

## ⚡ Streaming и Suspense

### 1. Suspense для постепенной загрузки
```typescript
import { Suspense } from 'react';

export function Page() {
  return (
    <div>
      <Header /> {/* Показывается сразу */}
      
      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsList /> {/* Загружается асинхронно */}
      </Suspense>
      
      <Suspense fallback={<StatsSkeleton />}>
        <StatsWidget /> {/* Загружается асинхронно */}
      </Suspense>
    </div>
  );
}
```

### 2. Loading.tsx для автоматических fallbacks
```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return <DashboardSkeleton />;
}

// app/dashboard/page.tsx
export default async function Dashboard() {
  const data = await fetchData(); // Автоматически обернется в Suspense
  return <DashboardContent data={data} />;
}
```

## 🎨 Специфика для нашего проекта

### Homepage компоненты
```typescript
// ❌ Текущая проблема
'use client'; // Весь компонент клиентский из-за useEffect

export function HomepagePage() {
  useEffect(() => {
    document.body.classList.add('homepage-active');
    // ...
  }, []);
  
  return (
    <div>
      <HomepageNavbar /> {/* Статичный, но стал клиентским */}
      <HomepageHero /> {/* Статичный, но стал клиентским */}
      {/* ... */}
    </div>
  );
}

// ✅ Решение - вынести side effects
// homepage-style-manager.tsx
'use client';
export function HomepageStyleManager() {
  useEffect(() => {
    document.body.classList.add('homepage-active');
    return () => document.body.classList.remove('homepage-active');
  }, []);
  return null;
}

// homepage-page.tsx (БЕЗ 'use client')
export function HomepagePage() {
  return (
    <>
      <HomepageStyleManager />
      <div>
        <HomepageNavbar /> {/* Теперь Server Component */}
        <HomepageHero /> {/* Теперь Server Component */}
        {/* ... */}
      </div>
    </>
  );
}
```

### Dashboard компоненты
```typescript
// ✅ Разделение на Server и Client части
// dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  const projects = await getProjects();
  const stats = await getStats();
  
  return (
    <div>
      <DashboardHeader stats={stats} /> {/* Server */}
      <ProjectsTableClient projects={projects} /> {/* Client для интерактивности */}
    </div>
  );
}

// projects-table-client.tsx
'use client';
export function ProjectsTableClient({ projects }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  // Интерактивная логика
  return <ProjectsTable projects={projects} selected={selected} />;
}
```

### Workflow компоненты
```typescript
// ✅ Сложные компоненты правильно используют Client
'use client';

export function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  // Вся логика canvas требует client-side
  return <ReactFlow nodes={nodes} edges={edges} />;
}

// Но статичные части можно вынести
// workflow-page.tsx (Server)
export default async function WorkflowPage({ params }: Props) {
  const workflow = await getWorkflow(params.id);
  
  return (
    <div>
      <WorkflowHeader workflow={workflow} /> {/* Server */}
      <WorkflowCanvasClient initialData={workflow} /> {/* Client */}
    </div>
  );
}
```

## 🚀 API Routes оптимизация

### 1. Используй Route Handlers правильно
```typescript
// app/api/projects/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // ✅ Используй searchParams
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  
  const projects = await db.project.findMany({
    where: { userId: userId || undefined }
  });
  
  return Response.json(projects);
}

// ✅ Добавь revalidate для кеширования
export const revalidate = 60; // Кеш на 60 секунд
```

### 2. Server Actions для мутаций
```typescript
// actions/project.ts
'use server';

export async function createProject(formData: FormData) {
  const name = formData.get('name') as string;
  
  const project = await db.project.create({
    data: { name }
  });
  
  revalidatePath('/dashboard/projects');
  return { success: true, project };
}

// В компоненте
'use client';
export function CreateProjectForm() {
  return (
    <form action={createProject}>
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## 📋 Чеклист перед коммитом

- [ ] Все компоненты по умолчанию Server Components
- [ ] `'use client'` только где действительно нужно
- [ ] Интерактивные части вынесены в отдельные Client Components
- [ ] Нет излишнего prop drilling (используется композиция)
- [ ] Данные загружаются близко к месту использования
- [ ] Используется Suspense для асинхронных компонентов
- [ ] Дорогие операции кешируются
- [ ] API routes имеют revalidate где применимо

## 📊 Результаты оптимизации в проекте

### Выполненные оптимизации (2026-01-21)

**Homepage компоненты:**
- ✅ `HomepagePage` → Server Component
- ✅ `HomepageStyleManager` → Client Component (side effects)
- ✅ `HomepageNavbar` → Server Component
- ✅ `HomepageHero` → Server Component
- ✅ `HomepageFeatures` → Server Component
- ✅ `HomepageSteps` → Server Component
- ✅ `HomepagePricing` → Server Component
- ✅ `HomepageFooter` → Server Component
- ✅ `HomepageMarquee` → Client Component (CSS animation)

**Landing компоненты:**
- ✅ `LandingPage` → Server Component
- ✅ `LandingStyleManager` → Client Component (side effects)
- ✅ `HeroSection` → Server Component
- ✅ `Pricing` → Server Component
- ✅ `ProblemSolution` → Server Component
- ✅ `Advantages` → Server Component
- ✅ `HowItWorks` → Server Component
- ✅ `Features` → Server Component
- ✅ `CTASection` → Server Component
- ✅ `Footer` → Server Component
- ✅ `Navbar` → Client Component (scroll state, mobile menu)
- ✅ `FAQ` → Client Component (accordion state)

### Метрики улучшений
- **До оптимизации:** 19 Client Components (Homepage: 9, Landing: 10)
- **После оптимизации:** 5 Client Components (Homepage: 2, Landing: 3)
- **Уменьшение Client Components на 78%**
- **Меньше JavaScript на клиенте** — статичный контент рендерится на сервере
- **Быстрее Time to Interactive** — меньше гидратации
- **Лучше SEO** — больше контента доступно для краулеров

### Паттерн Side Effects Isolation

```tsx
// ❌ До оптимизации
'use client';
import { useEffect } from 'react';

export function LandingPage() {
  useEffect(() => {
    document.body.classList.add('landing-page-active');
    // ... side effects
  }, []);
  
  return (
    <div>
      <Navbar /> {/* Стал клиентским из-за 'use client' */}
      <Hero /> {/* Стал клиентским из-за 'use client' */}
      <Features /> {/* Стал клиентским из-за 'use client' */}
    </div>
  );
}

// ✅ После оптимизации
// landing-page.tsx (Server Component)
export function LandingPage() {
  return (
    <>
      <LandingStyleManager /> {/* Client Component для side effects */}
      <div>
        <Navbar /> {/* Server Component */}
        <Hero /> {/* Server Component */}
        <Features /> {/* Server Component */}
      </div>
    </>
  );
}

// landing-style-manager.tsx (Client Component)
'use client';
import { useEffect } from 'react';

export function LandingStyleManager() {
  useEffect(() => {
    document.body.classList.add('landing-page-active');
    // ... side effects
    return () => {
      document.body.classList.remove('landing-page-active');
    };
  }, []);
  
  return null; // Не рендерит ничего
}
```

## 🔗 Ссылки
- [Vercel React Best Practices](https://vercel.com/blog/introducing-react-best-practices)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React 19 Documentation](https://react.dev/)
