/**
 * @file: rich-notification-dialog.tsx
 * @description: Расширенный диалог для массовых уведомлений с медиа и кнопками
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 * @created: 2025-01-31
 * @author: AI Assistant + User
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Mail,
  Send,
  Image as ImageIcon,
  Plus,
  Trash2,
  Eye,
  ExternalLink,
  MessageSquare,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  AlertCircle,
  Save,
  FolderOpen,
  X
} from 'lucide-react';
import { MessageEditor } from '@/components/ui/message-editor';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const buttonSchema = z
  .object({
    text: z
      .string()
      .min(1, 'Текст кнопки обязателен')
      .max(64, 'Максимум 64 символа'),
    url: z.string().url('Неверный формат URL').optional(),
    callback_data: z.string().max(64, 'Максимум 64 символа').optional()
  })
  .refine((data) => data.url || data.callback_data, {
    message: 'Укажите либо URL, либо данные для обратного вызова'
  });

const notificationSchema = z.object({
  message: z
    .string()
    .min(10, 'Сообщение должно содержать минимум 10 символов')
    .max(4000, 'Максимум 4000 символов'),
  imageUrl: z.string().url('Неверный формат URL').optional().or(z.literal('')),
  buttons: z.array(buttonSchema).max(6, 'Максимум 6 кнопок').optional()
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

interface RichNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  projectId: string;
}

export function RichNotificationDialog({
  open,
  onOpenChange,
  selectedUserIds,
  projectId
}: RichNotificationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [sendResults, setSendResults] = useState<{
    sent: number;
    failed: number;
    blocked: number;
  } | null>(null);
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      message: string;
      imageUrl?: string | null;
      buttons?: any;
      parseMode: string;
    }>
  >([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      message: '',
      imageUrl: '',
      buttons: []
    }
  });

  const buttons = form.watch('buttons') || [];
  const message = form.watch('message');
  const imageUrl = form.watch('imageUrl');
  // Используем только HTML для Telegram
  const parseMode = 'HTML';

  // Ref для доступа к textarea в MessageEditor через callback
  const formattingAccessorRef = useRef<
    ((callback: (textarea: HTMLTextAreaElement) => void) => void) | null
  >(null);

  // Обработчик для получения доступа к textarea из MessageEditor
  const handleFormattingRequest = useCallback(
    (accessor: (callback: (textarea: HTMLTextAreaElement) => void) => void) => {
      formattingAccessorRef.current = accessor;
    },
    []
  );

  // Применение форматирования HTML к выделенному тексту
  const applyFormatting = (tag: string, placeholder: string = '') => {
    const performFormatting = (textarea: HTMLTextAreaElement) => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value || message;
      const selectedText = currentValue.substring(start, end);

      let newText = '';
      let cursorOffset = 0;

      switch (tag) {
        case 'bold':
          newText = `<b>${selectedText || placeholder}</b>`;
          cursorOffset = selectedText ? 0 : 3;
          break;
        case 'italic':
          newText = `<i>${selectedText || placeholder}</i>`;
          cursorOffset = selectedText ? 0 : 3;
          break;
        case 'underline':
          newText = `<u>${selectedText || placeholder}</u>`;
          cursorOffset = selectedText ? 0 : 3;
          break;
        case 'strikethrough':
          newText = `<s>${selectedText || placeholder}</s>`;
          cursorOffset = selectedText ? 0 : 3;
          break;
        case 'code':
          newText = `<code>${selectedText || placeholder}</code>`;
          cursorOffset = selectedText ? 0 : 7;
          break;
        case 'link':
          const url = prompt('Введите URL ссылки:', 'https://');
          if (url) {
            newText = `<a href="${url}">${selectedText || 'Текст ссылки'}</a>`;
            cursorOffset = selectedText ? 0 : 1;
          } else {
            return;
          }
          break;
        default:
          return;
      }

      const updatedMessage =
        currentValue.substring(0, start) +
        newText +
        currentValue.substring(end);
      form.setValue('message', updatedMessage);

      // Обновляем значение textarea напрямую для немедленного отображения
      textarea.value = updatedMessage;

      // Восстанавливаем позицию курсора
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + cursorOffset,
          start + newText.length - cursorOffset
        );
      }, 0);
    };

    // Используем callback если доступен, иначе ищем textarea через DOM
    if (formattingAccessorRef.current) {
      formattingAccessorRef.current(performFormatting);
    } else {
      // Fallback: ищем textarea через DOM
      const textarea = document.querySelector(
        'textarea'
      ) as HTMLTextAreaElement;
      if (!textarea) {
        toast.error(
          'Не удалось найти поле ввода. Убедитесь, что редактор загружен.'
        );
        return;
      }
      performFormatting(textarea);
    }
  };

  const addButton = () => {
    const currentButtons = form.getValues('buttons') || [];
    if (currentButtons.length < 6) {
      form.setValue('buttons', [...currentButtons, { text: '', url: '' }]);
    }
  };

  const removeButton = (index: number) => {
    const currentButtons = form.getValues('buttons') || [];
    const newButtons = currentButtons.filter((_, i) => i !== index);
    form.setValue('buttons', newButtons);
  };

  // Загрузка шаблонов
  useEffect(() => {
    if (open && projectId) {
      fetch(`/api/projects/${projectId}/notification-templates`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTemplates(data);
          }
        })
        .catch((error) => {
          console.error('Error loading templates:', error);
        });
    }
  }, [open, projectId]);

  // Загрузка шаблона
  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      form.setValue('message', template.message);
      form.setValue('imageUrl', template.imageUrl || '');
      if (template.buttons) {
        form.setValue('buttons', template.buttons as any);
      }
      setSelectedTemplateId(templateId);
      toast.success('Шаблон загружен');
    }
  };

  // Сохранение шаблона
  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Введите название шаблона');
      return;
    }

    try {
      const values = form.getValues();
      const validButtons =
        values.buttons?.filter((button) => button.text.trim()) || [];

      const response = await fetch(
        `/api/projects/${projectId}/notification-templates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: templateName,
            message: values.message,
            imageUrl: values.imageUrl || undefined,
            buttons: validButtons.length > 0 ? validButtons : undefined,
            parseMode: 'HTML'
          })
        }
      );

      if (response.ok) {
        const newTemplate = await response.json();
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

  const onSubmit = async (values: NotificationFormValues) => {
    setLoading(true);
    setInFlight(true);
    setProgress(10);
    setSendResults(null);

    try {
      // Фильтруем пустые кнопки - оставляем только с текстом
      const validButtons =
        values.buttons?.filter((button) => button.text.trim()) || [];

      const payload = {
        type: 'system_announcement',
        title: 'Системное уведомление',
        message: values.message,
        channel: 'telegram',
        priority: 'normal',
        userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
        metadata: {
          imageUrl: values.imageUrl || undefined,
          buttons: validButtons.length > 0 ? validButtons : undefined,
          parseMode: 'HTML'
        }
      };

      const response = await fetch(`/api/projects/${projectId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Обновим прогресс по факту результата
        const data = result.data || result;
        const total = Number(data.total || selectedUserIds.length || 1);
        const sent = Number(data.sent || 0);
        const failed = Number(data.failed || 0);

        // Подсчитываем заблокированных пользователей
        const blocked =
          result.results?.filter(
            (r: any) =>
              r.error?.includes('blocked by the user') ||
              r.error?.includes('403: Forbidden')
          ).length || 0;

        setSendResults({ sent, failed, blocked });
        const pct = Math.min(100, Math.round(((sent + failed) / total) * 100));
        setProgress(pct);

        const message =
          `✅ Уведомления отправлены!\n\n` +
          `📤 Отправлено: ${sent}\n` +
          `❌ Ошибок: ${failed}\n` +
          (blocked > 0 ? `🚫 Заблокировано ботов: ${blocked}\n` : '') +
          `📊 Всего: ${total}`;

        toast.success(message);

        form.reset();
        setTimeout(() => {
          onOpenChange(false);
          setSendResults(null);
        }, 2000);
      } else {
        // Обработка ошибок валидации
        if (result.details && Array.isArray(result.details)) {
          const errorMessages = result.details
            .map((detail: any) => `${detail.field}: ${detail.message}`)
            .join('\n');
          toast.error(`Ошибка валидации:\n${errorMessages}`);
        } else {
          toast.error(result.error || 'Ошибка отправки уведомлений');
        }
      }
    } catch (error) {
      toast.error('Ошибка отправки уведомлений');
      console.error('Error sending notifications:', error);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setInFlight(false);
        setProgress(0);
      }, 400);
    }
  };

  // Рендеринг предпросмотра сообщения
  const renderPreviewMessage = () => {
    if (!message) {
      return (
        <div className='text-muted-foreground text-sm italic'>
          Введите текст сообщения...
        </div>
      );
    }

    // Безопасный рендеринг HTML (только разрешенные теги для Telegram)
    const allowedTags = ['b', 'i', 'u', 's', 'a', 'code', 'pre'];
    let html = message;

    // Удаляем неразрешенные теги
    const tagRegex = /<\/?([a-z]+)[^>]*>/gi;
    html = html.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match;
      }
      return '';
    });

    // Заменяем переменные на примеры для превью
    html = html
      .replace(/\{user\.firstName\}/g, 'Иван')
      .replace(/\{user\.lastName\}/g, 'Петров')
      .replace(/\{user\.fullName\}/g, 'Иван Петров')
      .replace(/\{user\.balanceFormatted\}/g, '1,250 бонусов')
      .replace(/\{user\.currentLevel\}/g, 'Золотой')
      .replace(/\{user\.referralCode\}/g, 'REF123')
      .replace(
        /\{[^}]+\}/g,
        '<span class="text-blue-600 font-mono text-xs">[переменная]</span>'
      );

    return (
      <div
        className='text-sm break-words whitespace-pre-wrap'
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size='full'
        className='max-h-[95vh] w-full overflow-y-auto'
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <MessageSquare className='h-5 w-5' />
            Отправка расширенных уведомлений
          </DialogTitle>
          <DialogDescription>
            Отправка уведомлений с поддержкой изображений и кнопок{' '}
            {selectedUserIds.length} выбранным пользователям
          </DialogDescription>
        </DialogHeader>

        {sendResults && (
          <Alert className='mb-4'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>Результаты отправки</AlertTitle>
            <AlertDescription>
              Отправлено: {sendResults.sent} | Ошибок: {sendResults.failed}
              {sendResults.blocked > 0 && (
                <> | Заблокировано ботов: {sendResults.blocked}</>
              )}
              {sendResults.blocked > 0 && (
                <div className='text-muted-foreground mt-2 text-xs'>
                  💡 Некоторые пользователи заблокировали бота. Это нормально -
                  они не получат уведомления.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          {/* Форма */}
          <div className='space-y-6 lg:col-span-2'>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-6'
              >
                {/* Шаблоны */}
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <FormLabel>Шаблоны</FormLabel>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => setShowSaveTemplate(true)}
                      disabled={!message.trim()}
                    >
                      <Save className='mr-2 h-4 w-4' />
                      Сохранить
                    </Button>
                  </div>
                  {templates.length > 0 && (
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
                  )}
                  {showSaveTemplate && (
                    <div className='flex gap-2'>
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
                      />
                      <Button
                        type='button'
                        size='sm'
                        onClick={saveTemplate}
                        disabled={!templateName.trim()}
                      >
                        Сохранить
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                          setShowSaveTemplate(false);
                          setTemplateName('');
                        }}
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Текст сообщения с поддержкой переменных и HTML форматирования */}
                <FormField
                  control={form.control}
                  name='message'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Текст сообщения</FormLabel>
                      <div className='space-y-2'>
                        {/* Панель инструментов форматирования HTML */}
                        <div className='bg-muted/50 flex flex-wrap gap-1 rounded-md border p-1'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => applyFormatting('bold', 'жирный')}
                            title='Жирный (HTML: &lt;b&gt;)'
                            className='h-8 w-8 p-0'
                          >
                            <Bold className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => applyFormatting('italic', 'курсив')}
                            title='Курсив (HTML: &lt;i&gt;)'
                            className='h-8 w-8 p-0'
                          >
                            <Italic className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() =>
                              applyFormatting('underline', 'подчеркнутый')
                            }
                            title='Подчеркивание (HTML: &lt;u&gt;)'
                            className='h-8 w-8 p-0'
                          >
                            <Underline className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() =>
                              applyFormatting('strikethrough', 'зачеркнутый')
                            }
                            title='Зачеркивание (HTML: &lt;s&gt;)'
                            className='h-8 w-8 p-0'
                          >
                            <Strikethrough className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => applyFormatting('code', 'код')}
                            title='Код (HTML: &lt;code&gt;)'
                            className='h-8 w-8 p-0'
                          >
                            <Code className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => applyFormatting('link')}
                            title='Ссылка (HTML: &lt;a&gt;)'
                            className='h-8 w-8 p-0'
                          >
                            <LinkIcon className='h-4 w-4' />
                          </Button>
                        </div>
                        <FormControl>
                          <MessageEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder='Введите текст уведомления...'
                            showPreview={true}
                            showVariableHelper={true}
                            onFormattingRequest={handleFormattingRequest}
                          />
                        </FormControl>
                      </div>
                      <FormDescription>
                        Поддерживается HTML разметка (&lt;b&gt;, &lt;i&gt;,
                        &lt;u&gt;, &lt;s&gt;, &lt;a&gt;, &lt;code&gt;). Максимум
                        4000 символов. {message.length}/4000
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* URL изображения */}
                <FormField
                  control={form.control}
                  name='imageUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='flex items-center gap-2'>
                        <ImageIcon className='h-4 w-4' />
                        URL изображения (необязательно)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='https://example.com/image.jpg'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Прямая ссылка на изображение (JPG, PNG, GIF)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Кнопки */}
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <FormLabel>Кнопки (необязательно, максимум 6)</FormLabel>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={addButton}
                      disabled={buttons.length >= 6}
                    >
                      <Plus className='mr-1 h-4 w-4' />
                      Добавить кнопку
                    </Button>
                  </div>

                  {buttons.map((_, index) => (
                    <Card key={index} className='p-4'>
                      <div className='space-y-4'>
                        <div className='flex items-center justify-between'>
                          <span className='text-sm font-medium'>
                            Кнопка {index + 1}
                          </span>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => removeButton(index)}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>

                        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                          <FormField
                            control={form.control}
                            name={`buttons.${index}.text`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Текст кнопки</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='Текст кнопки'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`buttons.${index}.url`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='https://example.com'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </form>
            </Form>
          </div>

          {/* Превью в стиле Telegram */}
          <div className='space-y-4 lg:col-span-1'>
            <div className='flex items-center gap-2'>
              <Eye className='h-4 w-4' />
              <span className='font-medium'>Предпросмотр (Telegram)</span>
            </div>

            <Card className='border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-800 dark:from-blue-950 dark:to-blue-900'>
              <CardContent className='space-y-4 p-4'>
                {inFlight && (
                  <div className='bg-background rounded-lg border p-3'>
                    <div className='text-muted-foreground mb-2 text-xs'>
                      Отправка рассылки...
                    </div>
                    <Progress value={progress} />
                  </div>
                )}

                {/* Изображение */}
                {imageUrl && (
                  <div className='overflow-hidden rounded-lg border-2 border-blue-200 bg-white shadow-sm dark:border-blue-800'>
                    <img
                      src={imageUrl}
                      alt='Preview'
                      className='h-48 w-full object-cover'
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Сообщение в стиле Telegram */}
                <div className='rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-700 dark:bg-gray-800'>
                  <div className='space-y-2'>{renderPreviewMessage()}</div>
                </div>

                {/* Кнопки */}
                {buttons.length > 0 && (
                  <div className='space-y-2'>
                    <div className='text-muted-foreground text-xs font-medium'>
                      Кнопки:
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      {buttons.map(
                        (button, index) =>
                          button.text && (
                            <Button
                              key={index}
                              variant='outline'
                              size='sm'
                              className='w-full justify-start bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'
                              disabled
                            >
                              {button.url && (
                                <ExternalLink className='mr-2 h-3 w-3' />
                              )}
                              <span className='truncate'>
                                {button.text || `Кнопка ${index + 1}`}
                              </span>
                            </Button>
                          )
                      )}
                    </div>
                  </div>
                )}

                {!message && !imageUrl && buttons.length === 0 && (
                  <div className='text-muted-foreground py-8 text-center text-sm'>
                    Превью появится после заполнения полей
                  </div>
                )}
              </CardContent>
            </Card>

            <div className='text-muted-foreground text-xs'>
              Получатели: {selectedUserIds.length} пользователей
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type='submit'
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading || !message.trim()}
          >
            {loading ? (
              <>
                <div className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                Отправка...
              </>
            ) : (
              <>
                <Send className='mr-2 h-4 w-4' />
                Отправить уведомления
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
