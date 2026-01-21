import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BotNode } from '@/types/bot-constructor';

interface InputPropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function InputProperties({
  node,
  updateNodeData
}: InputPropertiesProps) {
  const config = node.data.config.input || { prompt: '', timeout: 300 };

  return (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <Label>Текст запроса</Label>
        <Textarea
          value={config.prompt}
          onChange={(e) =>
            updateNodeData({
              config: {
                ...node.data.config,
                input: {
                  ...config,
                  prompt: e.target.value
                }
              }
            })
          }
          placeholder='Пожалуйста, введите ваше имя...'
        />
        <p className='text-muted-foreground mt-1 text-xs'>
          Можно использовать переменные: {'{{session.name}}'}
        </p>
      </div>

      <div className='grid grid-cols-2 gap-2'>
        <div className='grid gap-2'>
          <Label>Таймаут (сек)</Label>
          <Input
            type='number'
            value={String(config.timeout || 300)}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...node.data.config,
                  input: {
                    ...config,
                    timeout: parseInt(e.target.value) || 300
                  }
                }
              })
            }
          />
        </div>
        <div className='grid gap-2'>
          <Label>Имя переменной</Label>
          <Input
            value={config.variableName || ''}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...node.data.config,
                  input: {
                    ...config,
                    variableName: e.target.value
                  }
                }
              })
            }
            placeholder='phone_number'
          />
        </div>
      </div>

      <div className='mt-4 border-t pt-4'>
        <h4 className='mb-2 text-sm font-semibold'>Валидация</h4>

        <div className='space-y-3'>
          <div className='grid gap-2'>
            <Label>Тип данных</Label>
            <Select
              value={config.validation?.type || 'text'}
              onValueChange={(value) => {
                updateNodeData({
                  config: {
                    ...node.data.config,
                    input: {
                      ...config,
                      validation: {
                        ...config.validation,
                        type: value as any
                      }
                    }
                  }
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Выберите тип' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='text'>Текст (любой)</SelectItem>
                <SelectItem value='email'>Email</SelectItem>
                <SelectItem value='phone'>Телефон</SelectItem>
                <SelectItem value='number'>Число</SelectItem>
                <SelectItem value='regex'>
                  RegEx (Регулярное выражение)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.validation?.type === 'regex' && (
            <div className='grid gap-2'>
              <Label>Регулярное выражение</Label>
              <Input
                value={config.validation?.pattern || ''}
                onChange={(e) =>
                  updateNodeData({
                    config: {
                      ...node.data.config,
                      input: {
                        ...config,
                        validation: {
                          ...config.validation,
                          pattern: e.target.value
                        }
                      }
                    }
                  })
                }
                placeholder='^\d{10}$'
              />
            </div>
          )}

          <div className='grid gap-2'>
            <Label>Сообщение об ошибке</Label>
            <Input
              value={config.retryMessage || ''}
              onChange={(e) =>
                updateNodeData({
                  config: {
                    ...node.data.config,
                    input: {
                      ...config,
                      retryMessage: e.target.value
                    }
                  }
                })
              }
              placeholder='Неверный формат. Попробуйте снова.'
            />
          </div>
        </div>
      </div>
    </div>
  );
}
