import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BotNode } from '@/types/bot-constructor';

interface ConditionPropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function ConditionProperties({
  node,
  updateNodeData
}: ConditionPropertiesProps) {
  const config = node.data.config.condition || {
    variable: '',
    operator: 'equals',
    value: '',
    trueNodeId: '',
    falseNodeId: ''
  };

  return (
    <div className='space-y-4'>
      <div className='rounded-md border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30'>
        <p className='text-xs text-blue-800 dark:text-blue-300'>
          Условие проверяет переменную и направляет поток:
          <br />
          🟢 <b>Вниз (True)</b>: если условие выполнено
          <br />
          🔴 <b>Вправо (False)</b>: если условие НЕ выполнено
        </p>
      </div>

      <div className='grid gap-2'>
        <Label>Переменная (A)</Label>
        <Input
          value={config.variable}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...node.data.config,
                condition: { ...config, variable: e.target.value }
              }
            })
          }
          placeholder='session.balance'
        />
      </div>

      <div className='grid gap-2'>
        <Label>Оператор</Label>
        <Select
          value={config.operator}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...node.data.config,
                condition: {
                  ...config,
                  operator: value as any
                }
              }
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder='Выберите оператор' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='equals'>Равно (==)</SelectItem>
            <SelectItem value='not_equals'>Не равно (!=)</SelectItem>
            <SelectItem value='greater'>Больше (A &gt; B)</SelectItem>
            <SelectItem value='less'>Меньше (A &lt; B)</SelectItem>
            <SelectItem value='greater_equal'>
              Больше или равно (&gt;=)
            </SelectItem>
            <SelectItem value='less_equal'>Меньше или равно (&lt;=)</SelectItem>
            <SelectItem value='contains'>Содержит текcт</SelectItem>
            <SelectItem value='is_empty'>Пусто (Empty / Null)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.operator !== 'is_empty' && config.operator !== 'is_not_empty' && (
        <div className='grid gap-2'>
          <Label>Значение (B)</Label>
          <Input
            value={config.value}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...node.data.config,
                  condition: { ...config, value: e.target.value }
                }
              })
            }
            placeholder='100 или {{session.min_sp}}'
          />
          <p className='text-muted-foreground mt-1 text-xs'>
            Можно ввести число, текст или другую переменную в {'{{ }}'}
          </p>
        </div>
      )}
    </div>
  );
}
