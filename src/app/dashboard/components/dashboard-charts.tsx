'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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

interface UserGrowthPoint {
  name: string;
  total: number;
}

interface DashboardChartsProps {
  data: UserGrowthPoint[];
  dataByDays: UserGrowthPoint[];
  dataByWeeks: UserGrowthPoint[];
}

type TimeRange = 'days' | 'weeks' | 'months';

export function DashboardCharts({
  data,
  dataByDays,
  dataByWeeks
}: DashboardChartsProps) {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('months');

  const getChartData = (): UserGrowthPoint[] => {
    switch (timeRange) {
      case 'days':
        return dataByDays.length > 0 ? dataByDays : [{ name: '-', total: 0 }];
      case 'weeks':
        return dataByWeeks.length > 0 ? dataByWeeks : [{ name: '-', total: 0 }];
      case 'months':
      default:
        return data.length > 0
          ? data
          : [
              { name: 'Янв', total: 0 },
              { name: 'Фев', total: 0 },
              { name: 'Мар', total: 0 },
              { name: 'Апр', total: 0 },
              { name: 'Май', total: 0 },
              { name: 'Июн', total: 0 }
            ];
    }
  };

  const chartData = getChartData();

  const getDescription = () => {
    switch (timeRange) {
      case 'days':
        return 'Рост базы участников за последние 30 дней';
      case 'weeks':
        return 'Рост базы участников за последние 12 недель';
      case 'months':
        return 'Рост базы участников за последние 6 месяцев';
      default:
        return 'Рост базы участников';
    }
  };

  return (
    <Card className='glass-card col-span-1 h-[400px] border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='text-xl font-semibold'>
              Активность пользователей
            </CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </div>
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Период' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='days'>По дням</SelectItem>
              <SelectItem value='weeks'>По неделям</SelectItem>
              <SelectItem value='months'>По месяцам</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className='pl-0'>
        <ResponsiveContainer width='100%' height={280}>
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
