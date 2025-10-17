/**
 * @file: src/app/dashboard/projects/[id]/ab-testing/page.tsx
 * @description: Страница A/B тестирования для проекта
 * @project: SaaS Bonus System
 * @created: 2025-01-28
 * @author: AI Assistant
 */

'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BarChart3, Users, Target } from 'lucide-react';

export default function ABTestingPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Тестирование</h1>
          <p className="text-muted-foreground">
            Создавайте и управляйте A/B тестами для оптимизации конверсии
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Создать тест
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные тесты</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              +0% с прошлого месяца
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Участники</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              +0% с прошлого месяца
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Конверсия</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-muted-foreground">
              +0% с прошлого месяца
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статистическая значимость</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Недостаточно данных
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Пустое состояние */}
      <Card>
        <CardHeader>
          <CardTitle>A/B Тесты</CardTitle>
          <CardDescription>
            Создайте свой первый A/B тест для оптимизации конверсии
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Нет активных тестов</h3>
          <p className="text-muted-foreground mb-6">
            Создайте A/B тест для сравнения разных версий вашего бота
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Создать первый тест
          </Button>
        </CardContent>
      </Card>

      {/* Информация о функциях */}
      <Card>
        <CardHeader>
          <CardTitle>Возможности A/B тестирования</CardTitle>
          <CardDescription>
            Что вы сможете тестировать и оптимизировать
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">Сообщения бота</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Разные тексты приветствия</li>
                <li>• Варианты ответов на вопросы</li>
                <li>• Разные стили сообщений</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Потоки диалогов</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Разные последовательности вопросов</li>
                <li>• Альтернативные пути регистрации</li>
                <li>• Разные варианты onboarding</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Кнопки и интерфейс</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Разные варианты клавиатур</li>
                <li>• Альтернативные тексты кнопок</li>
                <li>• Разные макеты сообщений</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Аналитика</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Статистическая значимость</li>
                <li>• Конверсия по группам</li>
                <li>• Детальная аналитика</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}