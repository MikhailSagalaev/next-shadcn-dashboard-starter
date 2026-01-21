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

interface SessionPropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function SessionProperties({
  node,
  updateNodeData
}: SessionPropertiesProps) {
  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label>Ключ переменной</Label>
        <Input
          value={node.data.config.session?.key || ''}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...node.data.config,
                session: {
                  ...node.data.config.session,
                  key: e.target.value
                }
              }
            })
          }
          placeholder='userName'
        />
      </div>

      <div className='grid gap-2'>
        <Label>Операция</Label>
        <Select
          value={node.data.config.session?.operation || 'set'}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...node.data.config,
                session: {
                  ...node.data.config.session,
                  operation: value as any
                }
              }
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder='Выберите операцию' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='set'>Установить</SelectItem>
            <SelectItem value='get'>Получить</SelectItem>
            <SelectItem value='delete'>Удалить</SelectItem>
            <SelectItem value='increment'>Увеличить</SelectItem>
            <SelectItem value='decrement'>Уменьшить</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
