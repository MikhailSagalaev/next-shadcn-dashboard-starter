'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { useTheme } from 'next-themes';

interface MonthlyUserGrowth {
  name: string;
  total: number;
}

interface DashboardChartsProps {
  data: MonthlyUserGrowth[];
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const { theme } = useTheme();

  // Если нет данных, показываем пустой график
  const chartData =
    data.length > 0
      ? data
      : [
          { name: 'Янв', total: 0 },
          { name: 'Фев', total: 0 },
          { name: 'Мар', total: 0 },
          { name: 'Апр', total: 0 },
          { name: 'Май', total: 0 },
          { name: 'Июн', total: 0 }
        ];

  return (
    <Card className='glass-card col-span-1 h-[400px] border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Активность пользователей
        </CardTitle>
        <CardDescription>
          Рост базы участников за последние 6 месяцев
        </CardDescription>
      </CardHeader>
      <CardContent className='pl-0'>
        <ResponsiveContainer width='100%' height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id='colorTotal' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#8b5cf6' stopOpacity={0.3} />
                <stop offset='95%' stopColor='#8b5cf6' stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray='3 3'
              vertical={false}
              stroke={theme === 'dark' ? '#27272a' : '#e5e7eb'}
            />
            <XAxis
              dataKey='name'
              stroke='#888888'
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke='#888888'
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                borderColor: theme === 'dark' ? '#27272a' : '#e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
            />
            <Area
              type='monotone'
              dataKey='total'
              stroke='#8b5cf6'
              strokeWidth={3}
              fillOpacity={1}
              fill='url(#colorTotal)'
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
