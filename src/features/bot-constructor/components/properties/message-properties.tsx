import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TelegramRichEditor } from '@/components/ui/telegram-rich-editor';
import { KeyboardBuilder } from '../editors/keyboard-builder';
import { BotNode } from '@/types/bot-constructor';

interface MessagePropertiesProps {
  node: BotNode;
  updateNodeData: (data: any) => void;
}

export function MessageProperties({
  node,
  updateNodeData
}: MessagePropertiesProps) {
  return (
    <Tabs defaultValue='message' className='w-full'>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger value='message'>Сообщение</TabsTrigger>
        <TabsTrigger value='keyboard'>Клавиатура</TabsTrigger>
      </TabsList>

      <TabsContent value='message' className='mt-4 space-y-4'>
        <TelegramRichEditor
          value={node.data.config.message?.text || ''}
          onChange={(text) =>
            updateNodeData({
              config: {
                ...node.data.config,
                message: {
                  ...node.data.config.message,
                  text,
                  parseMode: 'HTML'
                }
              }
            })
          }
          placeholder='Введите текст сообщения...'
          showVariableHelper={true}
          minHeight='200px'
          showActions={true}
        />
      </TabsContent>

      <TabsContent value='keyboard' className='mt-4 space-y-4'>
        <KeyboardBuilder
          config={
            node.data.config.message?.keyboard || {
              type: 'inline',
              buttons: [[]]
            }
          }
          onChange={(keyboardConfig) =>
            updateNodeData({
              config: {
                ...node.data.config,
                message: {
                  ...node.data.config.message,
                  keyboard: keyboardConfig
                }
              }
            })
          }
        />
      </TabsContent>
    </Tabs>
  );
}
