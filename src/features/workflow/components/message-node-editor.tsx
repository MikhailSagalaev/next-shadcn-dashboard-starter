/**
 * @file: src/features/workflow/components/message-node-editor.tsx
 * @description: Редактор ноды сообщения с поддержкой шаблонов
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui
 * @created: 2025-01-31
 * @author: AI Assistant + User
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { TelegramRichEditor } from '@/components/ui/telegram-rich-editor';
import { KeyboardEditor } from '@/components/ui/keyboard-editor';
import { Save, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import type { WorkflowNodeConfig } from '@/types/workflow';

interface MessageNodeEditorProps {
  nodeConfig: WorkflowNodeConfig;
  setNodeConfig: React.Dispatch<React.SetStateAction<WorkflowNodeConfig>>;
}

interface MessageTemplate {
  id: string;
  name: string;
  message: string;
  imageUrl?: string | null;
  buttons?: any;
  parseMode: string;
}

export function MessageNodeEditor({
  nodeConfig,
  setNodeConfig
}: MessageNodeEditorProps) {
  const params = useParams();
  const projectId = params?.id as string;

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  // Загрузка шаблонов
  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}/notification-templates`)
        .then(async (res) => {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setTemplates(data);
            }
          }
        })
        .catch((error) => {
          console.error('Error loading templates:', error);
        });
    }
  }, [projectId]);

  // Загрузка шаблона
  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    console.log('Loading template:', template);
    if (template) {
      console.log('Template message:', template.message);
      setNodeConfig((prevConfig) => ({
        ...prevConfig,
        message: {
          ...prevConfig.message,
          text: template.message || '',
          parseMode: 'HTML'
        }
      }));
      setSelectedTemplateId(templateId);
      toast.success('Шаблон загружен');
    } else {
      console.error('Template not found:', templateId);
    }
  };

  // Сохранение шаблона
  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Введите название шаблона');
      return;
    }

    const messageText = nodeConfig.message?.text || '';
    console.log('Saving template with message:', messageText);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/notification-templates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: templateName,
            message: messageText,
            parseMode: 'HTML'
          })
        }
      );

      if (response.ok) {
        const newTemplate = await response.json();
        console.log('Template saved:', newTemplate);
        setTemplates([newTemplate, ...templates]);
        setTemplateName('');
        setShowSaveTemplate(false);
        toast.success('Шаблон сохранен');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Ошибка сохранения шаблона');
      }
    } catch (error) {
      toast.error('Ошибка сохранения шаблона');
      console.error('Error saving template:', error);
    }
  };

  // Удаление шаблона
  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/notification-templates/${templateId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
        if (selectedTemplateId === templateId) {
          setSelectedTemplateId(null);
        }
        toast.success('Шаблон удален');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Ошибка удаления шаблона');
      }
    } catch (error) {
      toast.error('Ошибка удаления шаблона');
      console.error('Error deleting template:', error);
    }
  };

  return (
    <div className='space-y-4'>
      {/* Шаблоны */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          {templates.length > 0 && <Label>Шаблоны</Label>}
          <Popover open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={!nodeConfig.message?.text?.trim()}
              >
                <Save className='mr-2 h-4 w-4' />
                Сохранить шаблон
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80' align='end'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <h4 className='leading-none font-medium'>Сохранить шаблон</h4>
                  <p className='text-muted-foreground text-sm'>
                    Введите название для сохранения текущего сообщения как
                    шаблона
                  </p>
                </div>
                <div className='space-y-2'>
                  <Input
                    placeholder='Название шаблона'
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveTemplate();
                      }
                    }}
                    autoFocus
                  />
                  <div className='flex gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      onClick={saveTemplate}
                      disabled={!templateName.trim()}
                      className='flex-1'
                    >
                      <Check className='mr-2 h-4 w-4' />
                      Сохранить
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        setShowSaveTemplate(false);
                        setTemplateName('');
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {templates.length > 0 && (
          <div className='space-y-2'>
            <Select
              value={selectedTemplateId || ''}
              onValueChange={loadTemplate}
            >
              <SelectTrigger>
                <SelectValue placeholder='Выберите шаблон...' />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => deleteTemplate(selectedTemplateId)}
                className='w-full text-red-600 hover:bg-red-50 hover:text-red-700'
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Удалить выбранный шаблон
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Текст сообщения */}
      <div>
        <Label htmlFor='messageText'>Текст сообщения</Label>
        <TelegramRichEditor
          value={nodeConfig.message?.text || ''}
          onChange={(text) => {
            setNodeConfig((prevConfig) => ({
              ...prevConfig,
              message: {
                ...prevConfig.message,
                text,
                parseMode: 'HTML'
              }
            }));
          }}
          placeholder='Введите текст сообщения...'
          showVariableHelper={true}
          minHeight='200px'
        />
      </div>

      {/* Клавиатура */}
      {nodeConfig.message?.keyboard && (
        <div>
          <Label>Клавиатура</Label>
          <KeyboardEditor
            value={nodeConfig.message.keyboard}
            onChange={(keyboard) => {
              setNodeConfig((prevConfig) => ({
                ...prevConfig,
                message: {
                  ...prevConfig.message,
                  keyboard: keyboard || undefined
                }
              }));
            }}
          />
        </div>
      )}
    </div>
  );
}
