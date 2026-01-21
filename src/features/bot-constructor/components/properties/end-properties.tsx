import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BotNode } from '@/types/bot-constructor';

interface EndPropertiesProps {
  node: BotNode;
  updateNodeData: (data: Partial<BotNode['data']>) => void;
}

export function EndProperties({ node, updateNodeData }: EndPropertiesProps) {
  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label>Название ноды</Label>
        <Input
          value={node.data.label}
          onChange={(e) => updateNodeData({ label: e.target.value })}
          placeholder='Завершение диалога'
        />
      </div>

      <div className='grid gap-2'>
        <Label>Прощальное сообщение (опционально)</Label>
        <Textarea
          value={node.data.description || ''}
          onChange={(e) => updateNodeData({ description: e.target.value })}
          placeholder='Спасибо за использование нашего бота!'
        />
      </div>
    </div>
  );
}
