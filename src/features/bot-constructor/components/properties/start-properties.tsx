import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BotNode } from '@/types/bot-constructor';

interface StartPropertiesProps {
  node: BotNode;
  updateNodeData: (data: Partial<BotNode['data']>) => void;
}

export function StartProperties({
  node,
  updateNodeData
}: StartPropertiesProps) {
  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label>Название ноды</Label>
        <Input
          value={node.data.label}
          onChange={(e) => updateNodeData({ label: e.target.value })}
          placeholder='Точка входа'
        />
      </div>
      <div className='grid gap-2'>
        <Label>Описание</Label>
        <Textarea
          value={node.data.description || ''}
          onChange={(e) => updateNodeData({ description: e.target.value })}
          placeholder='Описание точки входа в диалог'
        />
      </div>
    </div>
  );
}
