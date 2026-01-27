/**
 * @file: analytics-client.tsx
 * @description: Client component для аналитики
 * @project: SaaS Bonus System
 * @created: 2026-01-27
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  DollarSign,
  Calendar,
  Users
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AnalyticsClientProps {
  projectId: string;
}

export function AnalyticsClient({ projectId }: AnalyticsClientProps) {
  const [period, setPeriod] = useState('30d');
  const [ordersData, setOrdersData] = useState<any>(null);
  const [productsData, setProductsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period, projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/analytics/orders?period=${period}`),
        fetch(`/api/projects/${projectId}/analytics/products?period=${period}`)
      ]);

      const orders = await ordersRes.json();
      const products = await productsRes.json();

      setOrdersData(orders);
      setProductsData(products);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className='py-12 text-center'>Загрузка аналитики...</div>;
  }

  const stats = [
    {
      title: 'Всего заказов',
      value: ordersData?.stats?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Общая выручка',
      value: `${(ordersData?.stats?.totalRevenue || 0).toLocaleString('ru-RU')} ₽`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Средний чек',
      value: `${(ordersData?.stats?.averageOrderValue || 0).toLocaleString('ru-RU')} ₽`,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Использовано бонусов',
      value: `${(ordersData?.stats?.totalBonusUsed || 0).toLocaleString('ru-RU')} ₽`,
      icon: Package,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    }
  ];

  return (
    <div className='space-y-6'>
      {/* Period Selector */}
      <div className='flex justify-end'>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='7d'>Последние 7 дней</SelectItem>
            <SelectItem value='30d'>Последние 30 дней</SelectItem>
            <SelectItem value='90d'>Последние 90 дней</SelectItem>
            <SelectItem value='1y'>Последний год</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'
      >
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className='glass-card relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50'>
              <div
                className={`absolute top-4 right-4 rounded-full ${stat.bgColor} p-2.5 ${stat.color}`}
              >
                <stat.icon className='h-5 w-5' />
              </div>
              <div>
                <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                  {stat.title}
                </p>
                <h3 className='mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                  {stat.value}
                </h3>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue='orders' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='orders'>Заказы</TabsTrigger>
          <TabsTrigger value='products'>Товары</TabsTrigger>
          <TabsTrigger value='top'>Топ товаров</TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value='orders' className='space-y-4'>
          <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
            <CardHeader>
              <CardTitle>Последние заказы</CardTitle>
              <CardDescription>
                {ordersData?.orders?.length || 0} заказов за выбранный период
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {ordersData?.orders?.slice(0, 20).map((order: any) => (
                  <div
                    key={order.id}
                    className='flex items-center justify-between border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800'
                  >
                    <div className='space-y-1'>
                      <div className='flex items-center gap-2'>
                        <p className='font-medium'>#{order.orderNumber}</p>
                        <Badge
                          variant={
                            order.status === 'CONFIRMED'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <p className='text-sm text-zinc-500'>
                        {order.user?.email || order.user?.phone || 'Гость'}
                      </p>
                      <p className='text-xs text-zinc-400'>
                        {order.itemsCount} товаров •{' '}
                        {formatDistanceToNow(new Date(order.createdAt), {
                          addSuffix: true,
                          locale: ru
                        })}
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='font-semibold'>
                        {order.totalAmount.toLocaleString('ru-RU')} ₽
                      </p>
                      {order.bonusAmount > 0 && (
                        <p className='text-xs text-amber-500'>
                          -{order.bonusAmount.toLocaleString('ru-RU')} ₽
                          бонусами
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value='products' className='space-y-4'>
          <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
            <CardHeader>
              <CardTitle>Все товары</CardTitle>
              <CardDescription>
                {productsData?.summary?.productsWithSales || 0} из{' '}
                {productsData?.summary?.totalProducts || 0} товаров с продажами
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {productsData?.products?.slice(0, 20).map((product: any) => (
                  <div
                    key={product.id}
                    className='flex items-center gap-4 border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800'
                  >
                    {/* Product Image */}
                    {product.metadata?.image && (
                      <div className='flex-shrink-0'>
                        <img
                          src={product.metadata.image}
                          alt={product.name}
                          className='h-16 w-16 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700'
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      </div>
                    )}

                    <div className='flex-1 space-y-1'>
                      <div className='flex items-center gap-2'>
                        <p className='font-medium'>{product.name}</p>
                        {product.sku && (
                          <Badge variant='outline' className='text-xs'>
                            {product.sku}
                          </Badge>
                        )}
                      </div>
                      {product.category && (
                        <p className='text-sm text-zinc-500'>
                          {product.category}
                        </p>
                      )}
                      <div className='flex items-center gap-4 text-xs text-zinc-400'>
                        <span>{product.stats.ordersCount} заказов</span>
                        <span>{product.stats.totalQuantity} шт</span>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='font-semibold'>
                        {product.stats.totalRevenue.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className='text-sm text-zinc-500'>
                        {product.price.toLocaleString('ru-RU')} ₽/шт
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Products Tab */}
        <TabsContent value='top' className='space-y-4'>
          <Card className='glass-card border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
            <CardHeader>
              <CardTitle>Топ-10 товаров</CardTitle>
              <CardDescription>
                Самые продаваемые товары за период
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {ordersData?.topProducts?.map((product: any, index: number) => (
                  <div
                    key={product.productId || index}
                    className='flex items-center gap-4 border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800'
                  >
                    <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white'>
                      {index + 1}
                    </div>
                    <div className='flex-1'>
                      <p className='font-medium'>{product.name}</p>
                      <p className='text-sm text-zinc-500'>
                        {product.ordersCount} заказов • {product.totalQuantity}{' '}
                        шт
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='font-semibold text-emerald-600 dark:text-emerald-400'>
                        {product.totalRevenue.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
