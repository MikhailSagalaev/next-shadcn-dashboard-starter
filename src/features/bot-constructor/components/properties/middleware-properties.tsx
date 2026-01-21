import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BotNode } from '@/types/bot-constructor';

interface MiddlewarePropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function MiddlewareProperties({
  node,
  updateNodeData
}: MiddlewarePropertiesProps) {
  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label>Тип middleware</Label>
        <Select
          value={node.data.config.middleware?.type || 'logging'}
          onValueChange={(value) =>
            updateNodeData({
              config: {
                ...node.data.config,
                middleware: {
                  ...node.data.config.middleware,
                  type: value as any
                }
              }
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder='Выберите тип' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='logging'>Логирование</SelectItem>
            <SelectItem value='auth'>Аутентификация</SelectItem>
            <SelectItem value='rate_limit'>Ограничение запросов</SelectItem>
            <SelectItem value='validation'>Валидация</SelectItem>
            <SelectItem value='custom'>Пользовательский</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
