import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BotNode } from '@/types/bot-constructor';

interface CallbackPropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function CallbackProperties({
  node,
  updateNodeData
}: CallbackPropertiesProps) {
  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label>Callback data</Label>
        <Input
          value={node.data.config.callback?.data || ''}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...node.data.config,
                callback: {
                  ...node.data.config.callback,
                  data: e.target.value
                }
              }
            })
          }
          placeholder='action_name'
        />
      </div>

      <div className='grid gap-2'>
        <Label>Регулярное выражение (опционально)</Label>
        <Input
          value={node.data.config.callback?.pattern || ''}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...node.data.config,
                callback: {
                  ...node.data.config.callback,
                  pattern: e.target.value
                }
              }
            })
          }
          placeholder='^action_.*'
        />
      </div>

      <div className='flex items-center space-x-2'>
        <Switch
          checked={node.data.config.callback?.hideKeyboard || false}
          onCheckedChange={(checked) =>
            updateNodeData({
              config: {
                ...node.data.config,
                callback: {
                  ...node.data.config.callback,
                  hideKeyboard: checked
                }
              }
            })
          }
        />
        <Label>Скрыть клавиатуру после нажатия</Label>
      </div>
    </div>
  );
}
