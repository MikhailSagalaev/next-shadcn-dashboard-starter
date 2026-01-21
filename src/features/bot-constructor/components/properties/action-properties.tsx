import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BotNode } from '@/types/bot-constructor';

interface ActionPropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function ActionProperties({
  node,
  updateNodeData
}: ActionPropertiesProps) {
  const config = node.data.config.action || { type: 'grammy_api', config: {} };

  const handleTypeChange = (value: string) => {
    updateNodeData({
      config: {
        ...node.data.config,
        action: {
          ...config,
          type: value
          // Reset specific configs when type changes if needed
        }
      }
    });
  };

  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label>Тип действия</Label>
        <Select value={config.type} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder='Выберите действие' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='grammy_api'>Telegram API</SelectItem>
            <SelectItem value='external_api'>Внешний HTTP запрос</SelectItem>
            <SelectItem value='database'>База данных</SelectItem>
            <SelectItem value='variable'>Операции с переменными</SelectItem>
            <SelectItem value='notification'>Уведомление</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.type === 'external_api' && (
        <div className='bg-muted/50 space-y-3 rounded-md border p-3'>
          <h4 className='text-xs font-bold uppercase'>Настройки запроса</h4>
          <div className='grid gap-2'>
            <Label>URL</Label>
            <Input
              placeholder='https://api.example.com/v1/data'
              value={config.config?.url || ''}
              onChange={(e) =>
                updateNodeData({
                  config: {
                    ...node.data.config,
                    action: {
                      ...config,
                      config: { ...config.config, url: e.target.value }
                    }
                  }
                })
              }
            />
          </div>
          <div className='grid grid-cols-3 gap-2'>
            <div className='col-span-1 grid gap-2'>
              <Label>Метод</Label>
              <Select
                value={config.config?.method || 'GET'}
                onValueChange={(val) =>
                  updateNodeData({
                    config: {
                      ...node.data.config,
                      action: {
                        ...config,
                        config: { ...config.config, method: val }
                      }
                    }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='GET'>GET</SelectItem>
                  <SelectItem value='POST'>POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='col-span-2 grid gap-2'>
              <Label>Timeout (ms)</Label>
              <Input
                type='number'
                value={config.config?.timeout || 5000}
                onChange={(e) =>
                  updateNodeData({
                    config: {
                      ...node.data.config,
                      action: {
                        ...config,
                        config: {
                          ...config.config,
                          timeout: parseInt(e.target.value)
                        }
                      }
                    }
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {config.type === 'variable' && (
        <div className='bg-muted/50 space-y-3 rounded-md border p-3'>
          <h4 className='text-xs font-bold uppercase'>Математика / Логика</h4>
          <div className='grid gap-2'>
            <Label>Выражение (JS)</Label>
            <Textarea
              placeholder='session.points + 100' // Example
              value={config.config?.expression || ''}
              onChange={(e) =>
                updateNodeData({
                  config: {
                    ...node.data.config,
                    action: {
                      ...config,
                      config: { ...config.config, expression: e.target.value }
                    }
                  }
                })
              }
            />
            <p className='text-muted-foreground text-xs'>
              Результат сохранится в result
            </p>
          </div>
          <div className='grid gap-2'>
            <Label>Сохранить в переменную</Label>
            <Input
              placeholder='new_balance'
              value={config.config?.variableName || ''}
              onChange={(e) =>
                updateNodeData({
                  config: {
                    ...node.data.config,
                    action: {
                      ...config,
                      config: { ...config.config, variableName: e.target.value }
                    }
                  }
                })
              }
            />
          </div>
        </div>
      )}

      {/* Common Settings */}
      <div className='mt-4 flex items-center space-x-2'>
        <Switch
          checked={!!config.onError}
          onCheckedChange={(checked) => {
            updateNodeData({
              config: {
                ...node.data.config,
                action: {
                  ...config,
                  onError: checked ? { action: 'stop_flow' } : undefined
                }
              }
            });
          }}
        />
        <Label className='font-medium'>Обработка ошибок</Label>
      </div>

      {config.onError && (
        <div className='border-destructive ml-2 border-l-2 pl-2'>
          <p className='text-muted-foreground mb-2 text-xs'>
            При ошибке выполнение пойдет по красной ветке (Error Handle)
          </p>
        </div>
      )}
    </div>
  );
}
