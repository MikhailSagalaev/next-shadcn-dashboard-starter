import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { BotfatherHelper } from '../editors/botfather-helper';
import { BotNode } from '@/types/bot-constructor';

interface CommandPropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function CommandProperties({
  node,
  updateNodeData
}: CommandPropertiesProps) {
  return (
    <Tabs defaultValue='settings' className='w-full'>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger value='settings'>Настройки</TabsTrigger>
        <TabsTrigger value='botfather'>Bot Father</TabsTrigger>
      </TabsList>

      <TabsContent value='settings' className='mt-4 space-y-4'>
        <div className='grid gap-2'>
          <Label>Команда (без /)</Label>
          <Input
            value={node.data.config.command?.command || ''}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...node.data.config,
                  command: {
                    ...node.data.config.command,
                    command: e.target.value
                  }
                }
              })
            }
            placeholder='start'
          />
        </div>

        <div className='grid gap-2'>
          <Label>Описание</Label>
          <Input
            value={node.data.config.command?.description || ''}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...node.data.config,
                  command: {
                    ...node.data.config.command,
                    description: e.target.value
                  }
                }
              })
            }
            placeholder='Описание команды для /help'
          />
        </div>

        <div className='grid gap-2'>
          <Label>Альтернативные имена</Label>
          <Input
            value={node.data.config.command?.aliases?.join(', ') || ''}
            onChange={(e) =>
              updateNodeData({
                config: {
                  ...node.data.config,
                  command: {
                    ...node.data.config.command,
                    aliases: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  }
                }
              })
            }
            placeholder='go, begin (через запятую)'
          />
        </div>
      </TabsContent>

      <TabsContent value='botfather' className='mt-4'>
        <BotfatherHelper
          config={
            node.data.config.command || {
              command: '',
              description: ''
            }
          }
          onChange={(commandConfig) =>
            updateNodeData({
              config: {
                ...node.data.config,
                command: commandConfig
              }
            })
          }
          botUsername='your_bot_username' // This would come from project settings
        />
      </TabsContent>
    </Tabs>
  );
}
