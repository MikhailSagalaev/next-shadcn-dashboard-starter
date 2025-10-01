/**
 * @file: src/features/bot-constructor/components/editors/advanced/middleware-editor.tsx
 * @description: Продвинутый редактор middleware нод
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, Monaco Editor
 * @created: 2025-09-30
 * @author: AI Assistant + User
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Code,
  Settings,
  Shield,
  Clock,
  Database,
  Zap
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type { MiddlewareConfig } from '@/types/bot-constructor';

interface MiddlewareEditorProps {
  config: MiddlewareConfig;
  onChange: (config: MiddlewareConfig) => void;
  availableVariables: string[];
}

type MiddlewareType =
  | 'auth'
  | 'rate_limit'
  | 'logging'
  | 'validation'
  | 'custom'
  | 'session'
  | 'error_handler'
  | 'timeout';

interface MiddlewareTemplate {
  type: MiddlewareType;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'security' | 'performance' | 'monitoring' | 'logic';
  defaultConfig: Partial<MiddlewareConfig>;
}

const middlewareTemplates: MiddlewareTemplate[] = [
  // Security
  {
    type: 'auth',
    name: 'Аутентификация',
    description: 'Проверка авторизации пользователя',
    icon: Shield,
    category: 'security',
    defaultConfig: {
      type: 'auth',
      enabled: true,
      auth: {
        required: true,
        checkTelegramLinked: false,
        customCheck: '',
        onFailure: 'stop'
      }
    }
  },
  {
    type: 'rate_limit',
    name: 'Ограничение частоты',
    description: 'Защита от спама и перегрузки',
    icon: Clock,
    category: 'security',
    defaultConfig: {
      type: 'rate_limit',
      enabled: true,
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000,
        blockDuration: 300000,
        customKey: ''
      }
    }
  },

  // Performance
  {
    type: 'timeout',
    name: 'Таймаут',
    description: 'Ограничение времени выполнения',
    icon: Clock,
    category: 'performance',
    defaultConfig: {
      type: 'timeout',
      enabled: true,
      timeout: {
        duration: 30000,
        onTimeout: 'continue',
        retryCount: 0
      }
    }
  },

  // Monitoring
  {
    type: 'logging',
    name: 'Логирование',
    description: 'Запись действий пользователя',
    icon: Database,
    category: 'monitoring',
    defaultConfig: {
      type: 'logging',
      enabled: true,
      logging: {
        level: 'info',
        includeUserId: true,
        includeTimestamp: true,
        customMessage: '',
        logVariables: []
      }
    }
  },

  // Logic
  {
    type: 'validation',
    name: 'Валидация',
    description: 'Проверка данных и условий',
    icon: AlertCircle,
    category: 'logic',
    defaultConfig: {
      type: 'validation',
      enabled: true,
      validation: {
        rules: [],
        onFailure: 'stop',
        customValidation: ''
      }
    }
  },
  {
    type: 'session',
    name: 'Управление сессией',
    description: 'Работа с данными сессии',
    icon: Database,
    category: 'logic',
    defaultConfig: {
      type: 'session',
      enabled: true,
      session: {
        operations: [],
        variables: {}
      }
    }
  },
  {
    type: 'error_handler',
    name: 'Обработка ошибок',
    description: 'Перехват и обработка исключений',
    icon: AlertCircle,
    category: 'logic',
    defaultConfig: {
      type: 'error_handler',
      enabled: true,
      errorHandler: {
        catchTypes: ['all'],
        fallbackAction: 'continue',
        customHandler: '',
        retryAttempts: 0
      }
    }
  },

  // Custom
  {
    type: 'custom',
    name: 'Пользовательский код',
    description: 'Собственная логика middleware',
    icon: Code,
    category: 'logic',
    defaultConfig: {
      type: 'custom',
      enabled: true,
      custom: {
        code: '',
        async: false,
        variables: []
      }
    }
  }
];

export const MiddlewareEditor: React.FC<MiddlewareEditorProps> = ({
  config,
  onChange,
  availableVariables
}) => {
  const [selectedTemplate, setSelectedTemplate] =
    useState<MiddlewareTemplate | null>(null);
  const [activeTab, setActiveTab] = useState('templates');

  const categories = {
    security: { label: 'Безопасность', icon: Shield, color: 'destructive' },
    performance: { label: 'Производительность', icon: Zap, color: 'default' },
    monitoring: { label: 'Мониторинг', icon: Database, color: 'secondary' },
    logic: { label: 'Логика', icon: Settings, color: 'outline' }
  };

  const handleTemplateSelect = (template: MiddlewareTemplate) => {
    setSelectedTemplate(template);
    onChange({ ...template.defaultConfig, ...config });
    setActiveTab('config');
  };

  const handleConfigChange = (field: string, value: any) => {
    const newConfig = { ...config };
    const keys = field.split('.');
    let current = newConfig;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    onChange(newConfig);
  };

  const renderConfigFields = () => {
    if (!config.type) return null;

    switch (config.type) {
      case 'auth':
        return <AuthConfig config={config} onChange={handleConfigChange} />;

      case 'rate_limit':
        return (
          <RateLimitConfig config={config} onChange={handleConfigChange} />
        );

      case 'timeout':
        return <TimeoutConfig config={config} onChange={handleConfigChange} />;

      case 'logging':
        return (
          <LoggingConfig
            config={config}
            onChange={handleConfigChange}
            availableVariables={availableVariables}
          />
        );

      case 'validation':
        return (
          <ValidationConfig
            config={config}
            onChange={handleConfigChange}
            availableVariables={availableVariables}
          />
        );

      case 'session':
        return (
          <SessionConfig
            config={config}
            onChange={handleConfigChange}
            availableVariables={availableVariables}
          />
        );

      case 'error_handler':
        return (
          <ErrorHandlerConfig config={config} onChange={handleConfigChange} />
        );

      case 'custom':
        return (
          <CustomConfig
            config={config}
            onChange={handleConfigChange}
            availableVariables={availableVariables}
          />
        );

      default:
        return <div>Тип middleware не поддерживается</div>;
    }
  };

  return (
    <div className='space-y-4'>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='templates'>Шаблоны</TabsTrigger>
          <TabsTrigger value='config'>Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value='templates' className='space-y-4'>
          <div className='grid gap-4'>
            {Object.entries(categories).map(([categoryKey, category]) => {
              const templates = middlewareTemplates.filter(
                (t) => t.category === categoryKey
              );

              if (templates.length === 0) return null;

              return (
                <Card key={categoryKey}>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-center gap-2 text-sm'>
                      <category.icon className='h-4 w-4' />
                      {category.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='grid gap-3 md:grid-cols-2'>
                      {templates.map((template) => (
                        <Card
                          key={template.type}
                          className='hover:bg-muted/50 cursor-pointer transition-colors'
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <CardContent className='p-4'>
                            <div className='flex items-start gap-3'>
                              <template.icon className='text-muted-foreground mt-0.5 h-5 w-5' />
                              <div className='flex-1 space-y-1'>
                                <h4 className='text-sm font-medium'>
                                  {template.name}
                                </h4>
                                <p className='text-muted-foreground text-xs'>
                                  {template.description}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value='config' className='space-y-4'>
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <selectedTemplate.icon className='h-5 w-5' />
                  {selectedTemplate.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex items-center space-x-2'>
                    <Switch
                      checked={config.enabled !== false}
                      onCheckedChange={(checked) =>
                        handleConfigChange('enabled', checked)
                      }
                    />
                    <Label>Включено</Label>
                  </div>

                  {renderConfigFields()}
                </div>
              </CardContent>
            </Card>
          )}

          {!selectedTemplate && (
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                Выберите шаблон middleware из вкладки "Шаблоны"
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Конфигурационные компоненты для каждого типа middleware

const AuthConfig: React.FC<any> = ({ config, onChange }) => (
  <div className='space-y-4'>
    <div className='flex items-center space-x-2'>
      <Switch
        checked={config.auth?.required}
        onCheckedChange={(checked) => onChange('auth.required', checked)}
      />
      <Label>Требовать авторизацию</Label>
    </div>

    <div className='flex items-center space-x-2'>
      <Switch
        checked={config.auth?.checkTelegramLinked}
        onCheckedChange={(checked) =>
          onChange('auth.checkTelegramLinked', checked)
        }
      />
      <Label>Проверять привязку Telegram</Label>
    </div>

    <div className='space-y-2'>
      <Label>Действие при неудаче</Label>
      <Select
        value={config.auth?.onFailure || 'stop'}
        onValueChange={(value) => onChange('auth.onFailure', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='stop'>Остановить выполнение</SelectItem>
          <SelectItem value='continue'>Продолжить без проверки</SelectItem>
          <SelectItem value='redirect'>Перенаправить</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className='space-y-2'>
      <Label>Пользовательская проверка (опционально)</Label>
      <Textarea
        placeholder='return ctx.from?.id === allowedUserId;'
        value={config.auth?.customCheck || ''}
        onChange={(e) => onChange('auth.customCheck', e.target.value)}
        rows={3}
      />
    </div>
  </div>
);

const RateLimitConfig: React.FC<any> = ({ config, onChange }) => (
  <div className='space-y-4'>
    <div className='grid grid-cols-2 gap-4'>
      <div className='space-y-2'>
        <Label>Максимум запросов</Label>
        <Input
          type='number'
          value={config.rateLimit?.maxRequests || 10}
          onChange={(e) =>
            onChange('rateLimit.maxRequests', parseInt(e.target.value))
          }
        />
      </div>

      <div className='space-y-2'>
        <Label>Окно времени (мс)</Label>
        <Input
          type='number'
          value={config.rateLimit?.windowMs || 60000}
          onChange={(e) =>
            onChange('rateLimit.windowMs', parseInt(e.target.value))
          }
        />
      </div>
    </div>

    <div className='space-y-2'>
      <Label>Время блокировки (мс)</Label>
      <Input
        type='number'
        value={config.rateLimit?.blockDuration || 300000}
        onChange={(e) =>
          onChange('rateLimit.blockDuration', parseInt(e.target.value))
        }
      />
    </div>

    <div className='space-y-2'>
      <Label>Пользовательский ключ (опционально)</Label>
      <Input
        placeholder="ctx.from?.id + ':' + ctx.chat?.id"
        value={config.rateLimit?.customKey || ''}
        onChange={(e) => onChange('rateLimit.customKey', e.target.value)}
      />
    </div>
  </div>
);

const TimeoutConfig: React.FC<any> = ({ config, onChange }) => (
  <div className='space-y-4'>
    <div className='space-y-2'>
      <Label>Таймаут (мс)</Label>
      <Input
        type='number'
        value={config.timeout?.duration || 30000}
        onChange={(e) => onChange('timeout.duration', parseInt(e.target.value))}
      />
    </div>

    <div className='space-y-2'>
      <Label>Действие при таймауте</Label>
      <Select
        value={config.timeout?.onTimeout || 'continue'}
        onValueChange={(value) => onChange('timeout.onTimeout', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='continue'>Продолжить выполнение</SelectItem>
          <SelectItem value='stop'>Остановить выполнение</SelectItem>
          <SelectItem value='retry'>Повторить попытку</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className='space-y-2'>
      <Label>Количество повторов</Label>
      <Input
        type='number'
        min='0'
        max='5'
        value={config.timeout?.retryCount || 0}
        onChange={(e) =>
          onChange('timeout.retryCount', parseInt(e.target.value))
        }
      />
    </div>
  </div>
);

const LoggingConfig: React.FC<any> = ({
  config,
  onChange,
  availableVariables
}) => (
  <div className='space-y-4'>
    <div className='space-y-2'>
      <Label>Уровень логирования</Label>
      <Select
        value={config.logging?.level || 'info'}
        onValueChange={(value) => onChange('logging.level', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='debug'>Debug</SelectItem>
          <SelectItem value='info'>Info</SelectItem>
          <SelectItem value='warn'>Warning</SelectItem>
          <SelectItem value='error'>Error</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className='flex items-center space-x-2'>
      <Switch
        checked={config.logging?.includeUserId}
        onCheckedChange={(checked) =>
          onChange('logging.includeUserId', checked)
        }
      />
      <Label>Включать ID пользователя</Label>
    </div>

    <div className='flex items-center space-x-2'>
      <Switch
        checked={config.logging?.includeTimestamp}
        onCheckedChange={(checked) =>
          onChange('logging.includeTimestamp', checked)
        }
      />
      <Label>Включать время</Label>
    </div>

    <div className='space-y-2'>
      <Label>Пользовательское сообщение</Label>
      <Textarea
        placeholder='Пользователь {userName} выполнил действие'
        value={config.logging?.customMessage || ''}
        onChange={(e) => onChange('logging.customMessage', e.target.value)}
        rows={2}
      />
    </div>

    <div className='space-y-2'>
      <Label>Переменные для логирования</Label>
      <div className='flex flex-wrap gap-2'>
        {availableVariables.map((variable) => (
          <Badge
            key={variable}
            variant={
              config.logging?.logVariables?.includes(variable)
                ? 'default'
                : 'outline'
            }
            className='cursor-pointer'
            onClick={() => {
              const current = config.logging?.logVariables || [];
              const updated = current.includes(variable)
                ? current.filter((v) => v !== variable)
                : [...current, variable];
              onChange('logging.logVariables', updated);
            }}
          >
            {variable}
          </Badge>
        ))}
      </div>
    </div>
  </div>
);

const ValidationConfig: React.FC<any> = ({
  config,
  onChange,
  availableVariables
}) => (
  <div className='space-y-4'>
    <div className='space-y-2'>
      <Label>Правила валидации</Label>
      <div className='space-y-2'>
        {(config.validation?.rules || []).map((rule: any, index: number) => (
          <Card key={index}>
            <CardContent className='p-3'>
              <div className='grid grid-cols-3 gap-2'>
                <Select
                  value={rule.variable || ''}
                  onValueChange={(value) => {
                    const rules = [...(config.validation?.rules || [])];
                    rules[index] = { ...rules[index], variable: value };
                    onChange('validation.rules', rules);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Переменная' />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVariables.map((variable) => (
                      <SelectItem key={variable} value={variable}>
                        {variable}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={rule.operator || 'not_empty'}
                  onValueChange={(value) => {
                    const rules = [...(config.validation?.rules || [])];
                    rules[index] = { ...rules[index], operator: value };
                    onChange('validation.rules', rules);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='not_empty'>Не пустое</SelectItem>
                    <SelectItem value='email'>Email</SelectItem>
                    <SelectItem value='phone'>Телефон</SelectItem>
                    <SelectItem value='number'>Число</SelectItem>
                    <SelectItem value='regex'>Regex</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder='Значение'
                  value={rule.value || ''}
                  onChange={(e) => {
                    const rules = [...(config.validation?.rules || [])];
                    rules[index] = { ...rules[index], value: e.target.value };
                    onChange('validation.rules', rules);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          variant='outline'
          onClick={() => {
            const rules = [...(config.validation?.rules || []), {}];
            onChange('validation.rules', rules);
          }}
        >
          Добавить правило
        </Button>
      </div>
    </div>

    <div className='space-y-2'>
      <Label>Действие при неудаче</Label>
      <Select
        value={config.validation?.onFailure || 'stop'}
        onValueChange={(value) => onChange('validation.onFailure', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='stop'>Остановить выполнение</SelectItem>
          <SelectItem value='continue'>Продолжить</SelectItem>
          <SelectItem value='retry'>Повторить ввод</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
);

const SessionConfig: React.FC<any> = ({
  config,
  onChange,
  availableVariables
}) => (
  <div className='space-y-4'>
    <div className='space-y-2'>
      <Label>Операции с сессией</Label>
      <div className='space-y-2'>
        {(config.session?.operations || []).map((op: any, index: number) => (
          <Card key={index}>
            <CardContent className='p-3'>
              <div className='grid grid-cols-4 gap-2'>
                <Select
                  value={op.type || 'set'}
                  onValueChange={(value) => {
                    const operations = [...(config.session?.operations || [])];
                    operations[index] = { ...operations[index], type: value };
                    onChange('session.operations', operations);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='set'>Установить</SelectItem>
                    <SelectItem value='get'>Получить</SelectItem>
                    <SelectItem value='delete'>Удалить</SelectItem>
                    <SelectItem value='increment'>Увеличить</SelectItem>
                    <SelectItem value='decrement'>Уменьшить</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder='Ключ'
                  value={op.key || ''}
                  onChange={(e) => {
                    const operations = [...(config.session?.operations || [])];
                    operations[index] = {
                      ...operations[index],
                      key: e.target.value
                    };
                    onChange('session.operations', operations);
                  }}
                />

                <Input
                  placeholder='Значение'
                  value={op.value || ''}
                  onChange={(e) => {
                    const operations = [...(config.session?.operations || [])];
                    operations[index] = {
                      ...operations[index],
                      value: e.target.value
                    };
                    onChange('session.operations', operations);
                  }}
                />

                <Select
                  value={op.source || 'literal'}
                  onValueChange={(value) => {
                    const operations = [...(config.session?.operations || [])];
                    operations[index] = { ...operations[index], source: value };
                    onChange('session.operations', operations);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='literal'>Литерал</SelectItem>
                    <SelectItem value='variable'>Переменная</SelectItem>
                    <SelectItem value='expression'>Выражение</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          variant='outline'
          onClick={() => {
            const operations = [
              ...(config.session?.operations || []),
              { type: 'set' }
            ];
            onChange('session.operations', operations);
          }}
        >
          Добавить операцию
        </Button>
      </div>
    </div>
  </div>
);

const ErrorHandlerConfig: React.FC<any> = ({ config, onChange }) => (
  <div className='space-y-4'>
    <div className='space-y-2'>
      <Label>Типы ошибок для перехвата</Label>
      <div className='flex flex-wrap gap-2'>
        {['all', 'network', 'validation', 'timeout', 'auth', 'custom'].map(
          (errorType) => (
            <Badge
              key={errorType}
              variant={
                config.errorHandler?.catchTypes?.includes(errorType)
                  ? 'default'
                  : 'outline'
              }
              className='cursor-pointer'
              onClick={() => {
                const current = config.errorHandler?.catchTypes || [];
                const updated = current.includes(errorType)
                  ? current.filter((t) => t !== errorType)
                  : [...current, errorType];
                onChange('errorHandler.catchTypes', updated);
              }}
            >
              {errorType}
            </Badge>
          )
        )}
      </div>
    </div>

    <div className='space-y-2'>
      <Label>Действие при ошибке</Label>
      <Select
        value={config.errorHandler?.fallbackAction || 'continue'}
        onValueChange={(value) =>
          onChange('errorHandler.fallbackAction', value)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='continue'>Продолжить выполнение</SelectItem>
          <SelectItem value='stop'>Остановить выполнение</SelectItem>
          <SelectItem value='retry'>Повторить попытку</SelectItem>
          <SelectItem value='fallback'>Перейти к fallback</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className='space-y-2'>
      <Label>Количество повторов</Label>
      <Input
        type='number'
        min='0'
        max='5'
        value={config.errorHandler?.retryAttempts || 0}
        onChange={(e) =>
          onChange('errorHandler.retryAttempts', parseInt(e.target.value))
        }
      />
    </div>

    <div className='space-y-2'>
      <Label>Пользовательский обработчик (опционально)</Label>
      <Textarea
        placeholder="console.log('Error:', error); return true;"
        value={config.errorHandler?.customHandler || ''}
        onChange={(e) => onChange('errorHandler.customHandler', e.target.value)}
        rows={4}
      />
    </div>
  </div>
);

const CustomConfig: React.FC<any> = ({
  config,
  onChange,
  availableVariables
}) => (
  <div className='space-y-4'>
    <div className='flex items-center space-x-2'>
      <Switch
        checked={config.custom?.async}
        onCheckedChange={(checked) => onChange('custom.async', checked)}
      />
      <Label>Асинхронный код</Label>
    </div>

    <div className='space-y-2'>
      <Label>JavaScript код middleware</Label>
      <Textarea
        placeholder={`// Пример:
// if (ctx.message?.text === 'hello') {
//   await ctx.reply('Hello there!');
//   return false; // остановить дальнейшую обработку
// }
// return true; // продолжить`}
        value={config.custom?.code || ''}
        onChange={(e) => onChange('custom.code', e.target.value)}
        rows={8}
        className='font-mono text-sm'
      />
    </div>

    <div className='space-y-2'>
      <Label>Доступные переменные</Label>
      <div className='flex flex-wrap gap-2'>
        {availableVariables.map((variable) => (
          <Badge key={variable} variant='secondary'>
            {variable}
          </Badge>
        ))}
      </div>
    </div>

    <Alert>
      <AlertCircle className='h-4 w-4' />
      <AlertDescription>
        Будьте осторожны с пользовательским кодом. Он выполняется в контексте
        бота и имеет доступ ко всем данным.
      </AlertDescription>
    </Alert>
  </div>
);
