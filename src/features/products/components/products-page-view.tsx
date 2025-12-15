/**
 * @file: src/features/products/components/products-page-view.tsx
 * @description: Компонент страницы управления товарами
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState, useEffect } from 'react';
import { Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';

interface ProductsPageViewProps {
  projectId: string;
}

export function ProductsPageView({ projectId }: ProductsPageViewProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex items-center justify-between'>
        <Heading title='Товары' description='Управление товарами и категориями' />
        <Button>
          <Plus className='mr-2 h-4 w-4' />
          Добавить товар
        </Button>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Товары</CardTitle>
          <CardDescription>Всего: {products.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Загрузка...</div>
          ) : products.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              Нет товаров
            </div>
          ) : (
            <div className='space-y-2'>
              {products.map((product) => (
                <div key={product.id} className='border rounded p-4'>
                  <div className='font-medium'>{product.name}</div>
                  <div className='text-sm text-muted-foreground'>{product.price} руб.</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

