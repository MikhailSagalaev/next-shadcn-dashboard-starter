/**
 * @file: src/features/mailings/components/mailing-template-editor.tsx
 * @description: WYSIWYG редактор шаблонов писем для рассылок
 * @project: SaaS Bonus System
 * @created: 2025-01-30
 */

'use client';

import { useState } from 'react';
import { Bold, Italic, Link, List, Code, Eye, EyeOff, Variable, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface MailingTemplateEditorProps {
  subject: string;
  body: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
}

const AVAILABLE_VARIABLES = [
  { name: '{{user.name}}', description: 'Имя пользователя' },
  { name: '{{user.email}}', description: 'Email пользователя' },
  { name: '{{user.phone}}', description: 'Телефон пользователя' },
  { name: '{{user.bonusBalance}}', description: 'Баланс бонусов' },
  { name: '{{user.level}}', description: 'Уровень пользователя' },
  { name: '{{project.name}}', description: 'Название проекта' },
];

export function MailingTemplateEditor({
  subject,
  body,
  onSubjectChange,
  onBodyChange
}: MailingTemplateEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<string>('');

  const insertFormat = (before: string, after: string = '') => {
    const textarea = document.querySelector(
      '#mailing-body-textarea'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    const newText =
      body.substring(0, start) +
      before +
      selectedText +
      after +
      body.substring(end);

    onBodyChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector(
      '#mailing-body-textarea'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText =
      body.substring(0, start) + variable + body.substring(start);

    onBodyChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const renderPreview = () => {
    let preview = body;

    // Заменяем переменные на примеры
    AVAILABLE_VARIABLES.forEach((v) => {
      const examples: Record<string, string> = {
        '{{user.name}}': 'Иван Иванов',
        '{{user.email}}': 'ivan@example.com',
        '{{user.phone}}': '+7 (999) 123-45-67',
        '{{user.bonusBalance}}': '1,250',
        '{{user.level}}': 'Золотой',
        '{{project.name}}': 'Мой магазин',
      };
      preview = preview.replace(new RegExp(v.name.replace(/[{}]/g, '\\$&'), 'g'), examples[v.name] || v.name);
    });

    return (
      <div className='prose prose-sm max-w-none'>
        <div className='border rounded-lg p-4 bg-white'>
          <div className='font-semibold text-lg mb-2'>{subject}</div>
          <div className='text-gray-700 whitespace-pre-wrap'>{preview}</div>
        </div>
      </div>
    );
  };

  return (
    <div className='space-y-4'>
      {/* Тема письма */}
      <div>
        <Label htmlFor='mailing-subject'>Тема письма *</Label>
        <Input
          id='mailing-subject'
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder='Например: Специальное предложение для вас!'
          className='mt-1'
        />
      </div>

      {/* Редактор тела письма */}
      <div>
        <Label>Текст письма *</Label>
        <Card className='mt-1'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm'>Редактор</CardTitle>
              <div className='flex items-center gap-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className='mr-2 h-4 w-4' />
                      Скрыть превью
                    </>
                  ) : (
                    <>
                      <Eye className='mr-2 h-4 w-4' />
                      Показать превью
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Toolbar */}
            <div className='bg-muted flex items-center flex-wrap gap-2 rounded-lg p-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => insertFormat('**', '**')}
                title='Жирный'
              >
                <Bold className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => insertFormat('*', '*')}
                title='Курсив'
              >
                <Italic className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => insertFormat('[', '](url)')}
                title='Ссылка'
              >
                <Link className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => insertFormat('- ', '')}
                title='Список'
              >
                <List className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => insertFormat('`', '`')}
                title='Код'
              >
                <Code className='h-4 w-4' />
              </Button>
              <Separator orientation='vertical' className='h-6' />
              <div className='flex items-center gap-1'>
                <Variable className='h-4 w-4' />
                <span className='text-sm'>Переменные:</span>
                <select
                  value={selectedVariable}
                  onChange={(e) => {
                    setSelectedVariable(e.target.value);
                    if (e.target.value) {
                      insertVariable(e.target.value);
                      setSelectedVariable('');
                    }
                  }}
                  className='text-sm border rounded px-2 py-1 bg-background'
                >
                  <option value=''>Выберите переменную...</option>
                  {AVAILABLE_VARIABLES.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} - {v.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Редактор и превью */}
            <Tabs defaultValue='edit' value={showPreview ? 'preview' : 'edit'}>
              <TabsList>
                <TabsTrigger value='edit'>Редактор</TabsTrigger>
                <TabsTrigger value='preview'>Превью</TabsTrigger>
              </TabsList>
              <TabsContent value='edit'>
                <Textarea
                  id='mailing-body-textarea'
                  value={body}
                  onChange={(e) => onBodyChange(e.target.value)}
                  placeholder='Введите текст письма... Можно использовать переменные: {{user.name}}, {{user.email}} и т.д.'
                  className='min-h-[300px] font-mono text-sm'
                />
              </TabsContent>
              <TabsContent value='preview'>{renderPreview()}</TabsContent>
            </Tabs>

            {/* Список доступных переменных */}
            <div className='text-sm text-muted-foreground'>
              <p className='font-medium mb-2'>Доступные переменные:</p>
              <div className='flex flex-wrap gap-2'>
                {AVAILABLE_VARIABLES.map((v) => (
                  <Badge
                    key={v.name}
                    variant='outline'
                    className='cursor-pointer'
                    onClick={() => insertVariable(v.name)}
                  >
                    {v.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

