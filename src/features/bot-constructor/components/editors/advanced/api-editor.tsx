/**
 * @file: src/features/bot-constructor/components/editors/advanced/api-editor.tsx
 * @description: Редактор для интеграции с внешними API
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, ExternalApiIntegration
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
  Globe,
  Key,
  Play,
  TestTube,
  Save,
  Loader2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type { ActionConfig } from '@/types/bot-constructor';
import {
  externalApi,
  type ApiRequest,
  type ApiResponse
} from '@/lib/services/bot-flow-executor/external-api-integration';

interface ApiEditorProps {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  availableVariables: string[];
}

interface ApiPreset {
  id: string;
  name: string;
  description: string;
  category:
    | 'messaging'
    | 'payment'
    | 'crm'
    | 'analytics'
    | 'notification'
    | 'custom';
  template: Partial<ApiRequest>;
}

const apiPresets: ApiPreset[] = [
  // Messaging
  {
    id: 'telegram_send',
    name: 'Отправить сообщение Telegram',
    description: 'Отправка сообщения через Telegram Bot API',
    category: 'messaging',
    template: {
      method: 'POST',
      url: 'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
      body: {
        chat_id: '{CHAT_ID}',
        text: '{MESSAGE}',
        parse_mode: 'HTML'
      },
      auth: { type: 'bearer', token: '{BOT_TOKEN}' }
    }
  },
  {
    id: 'whatsapp_send',
    name: 'Отправить WhatsApp',
    description: 'Отправка сообщения через WhatsApp Business API',
    category: 'messaging',
    template: {
      method: 'POST',
      url: 'https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages',
      body: {
        messaging_product: 'whatsapp',
        to: '{RECIPIENT_PHONE}',
        type: 'text',
        text: { body: '{MESSAGE}' }
      },
      auth: { type: 'bearer', token: '{WHATSAPP_TOKEN}' }
    }
  },

  // Payment
  {
    id: 'stripe_payment',
    name: 'Создать платеж Stripe',
    description: 'Создание платежа через Stripe API',
    category: 'payment',
    template: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/payment_intents',
      body: {
        amount: '{AMOUNT}',
        currency: 'usd',
        description: '{DESCRIPTION}'
      },
      auth: { type: 'bearer', token: '{STRIPE_SECRET_KEY}' }
    }
  },
  {
    id: 'paypal_payment',
    name: 'Создать платеж PayPal',
    description: 'Создание платежа через PayPal API',
    category: 'payment',
    template: {
      method: 'POST',
      url: 'https://api.paypal.com/v2/checkout/orders',
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: '{AMOUNT}'
            },
            description: '{DESCRIPTION}'
          }
        ]
      },
      auth: { type: 'bearer', token: '{PAYPAL_ACCESS_TOKEN}' }
    }
  },

  // CRM
  {
    id: 'hubspot_contact',
    name: 'Создать контакт HubSpot',
    description: 'Создание контакта в HubSpot CRM',
    category: 'crm',
    template: {
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts',
      body: {
        properties: {
          email: '{EMAIL}',
          firstname: '{FIRST_NAME}',
          lastname: '{LAST_NAME}',
          phone: '{PHONE}'
        }
      },
      auth: { type: 'bearer', token: '{HUBSPOT_API_KEY}' }
    }
  },

  // Analytics
  {
    id: 'google_analytics',
    name: 'Отправить событие GA4',
    description: 'Отправка события в Google Analytics 4',
    category: 'analytics',
    template: {
      method: 'POST',
      url: 'https://www.google-analytics.com/mp/collect?measurement_id={GA_MEASUREMENT_ID}&api_secret={GA_API_SECRET}',
      body: {
        client_id: '{CLIENT_ID}',
        events: [
          {
            name: '{EVENT_NAME}',
            params: '{EVENT_PARAMS}'
          }
        ]
      }
    }
  },
  {
    id: 'mixpanel_track',
    name: 'Отправить событие Mixpanel',
    description: 'Отправка события в Mixpanel',
    category: 'analytics',
    template: {
      method: 'POST',
      url: 'https://api.mixpanel.com/track',
      body: [
        {
          event: '{EVENT_NAME}',
          properties: {
            distinct_id: '{USER_ID}',
            ...'{EVENT_PROPERTIES}'
          }
        }
      ],
      auth: { type: 'bearer', token: '{MIXPANEL_TOKEN}' }
    }
  },

  // Notifications
  {
    id: 'sendgrid_email',
    name: 'Отправить email SendGrid',
    description: 'Отправка email через SendGrid API',
    category: 'notification',
    template: {
      method: 'POST',
      url: 'https://api.sendgrid.com/v3/mail/send',
      body: {
        personalizations: [
          {
            to: [{ email: '{RECIPIENT_EMAIL}' }],
            subject: '{SUBJECT}'
          }
        ],
        from: { email: '{SENDER_EMAIL}' },
        content: [
          {
            type: 'text/plain',
            value: '{MESSAGE}'
          }
        ]
      },
      auth: { type: 'bearer', token: '{SENDGRID_API_KEY}' }
    }
  },
  {
    id: 'twilio_sms',
    name: 'Отправить SMS Twilio',
    description: 'Отправка SMS через Twilio API',
    category: 'notification',
    template: {
      method: 'POST',
      url: 'https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json',
      body: {
        To: '{RECIPIENT_PHONE}',
        From: '{TWILIO_PHONE}',
        Body: '{MESSAGE}'
      },
      auth: {
        type: 'basic',
        username: '{ACCOUNT_SID}',
        password: '{AUTH_TOKEN}'
      }
    }
  }
];

const categories = {
  messaging: { label: 'Мессенджеры', icon: '💬' },
  payment: { label: 'Платежи', icon: '💳' },
  crm: { label: 'CRM', icon: '👥' },
  analytics: { label: 'Аналитика', icon: '📊' },
  notification: { label: 'Уведомления', icon: '📧' },
  custom: { label: 'Другое', icon: '🔧' }
};

export const ApiEditor: React.FC<ApiEditorProps> = ({
  config,
  onChange,
  availableVariables
}) => {
  const [selectedPreset, setSelectedPreset] = useState<ApiPreset | null>(null);
  const [activeTab, setActiveTab] = useState('presets');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ApiResponse | null>(null);

  const apiConfig = config.externalApi || {};

  useEffect(() => {
    if (selectedPreset && !apiConfig.method) {
      // Применяем шаблон при выборе preset
      onChange({
        ...config,
        type: 'external_api',
        externalApi: {
          ...apiConfig,
          ...selectedPreset.template,
          id: selectedPreset.id
        }
      });
    }
  }, [selectedPreset]);

  const handlePresetSelect = (preset: ApiPreset) => {
    setSelectedPreset(preset);
    setActiveTab('config');
  };

  const handleConfigChange = (field: string, value: any) => {
    const newConfig = { ...config };
    const keys = field.split('.');
    let current = newConfig.externalApi || {};

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    newConfig.externalApi = current;

    onChange(newConfig);
  };

  const handleTestRequest = async () => {
    if (!apiConfig.url || !apiConfig.method) {
      setTestResult({
        success: false,
        status: 0,
        data: null,
        error: 'Не указан URL или метод запроса',
        headers: {},
        duration: 0
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const request: ApiRequest = {
        id: `test_${Date.now()}`,
        method: apiConfig.method,
        url: apiConfig.url,
        headers: apiConfig.headers,
        body: apiConfig.body,
        queryParams: apiConfig.queryParams,
        auth: apiConfig.auth,
        timeout: apiConfig.timeout || 10000,
        retries: 0
      };

      const result = await externalApi.executeRequest(request);
      await externalApi.getResponseData(result, {} as any); // Mock response for test

      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        status: 0,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        headers: {},
        duration: 0
      });
    } finally {
      setIsTesting(false);
    }
  };

  const renderPresetGrid = () => {
    const groupedPresets = apiPresets.reduce(
      (acc, preset) => {
        if (!acc[preset.category]) acc[preset.category] = [];
        acc[preset.category].push(preset);
        return acc;
      },
      {} as Record<string, ApiPreset[]>
    );

    return (
      <div className='space-y-6'>
        {Object.entries(categories).map(([categoryKey, category]) => {
          const presets = groupedPresets[categoryKey] || [];

          if (presets.length === 0) return null;

          return (
            <div key={categoryKey}>
              <h3 className='mb-4 flex items-center gap-2 text-lg font-medium'>
                <span>{category.icon}</span>
                {category.label}
              </h3>
              <div className='grid gap-3 md:grid-cols-2'>
                {presets.map((preset) => (
                  <Card
                    key={preset.id}
                    className='cursor-pointer transition-all hover:shadow-md'
                    onClick={() => handlePresetSelect(preset)}
                  >
                    <CardContent className='p-4'>
                      <div className='flex items-start gap-3'>
                        <div className='flex-1'>
                          <h4 className='mb-1 text-sm font-medium'>
                            {preset.name}
                          </h4>
                          <p className='text-muted-foreground text-xs'>
                            {preset.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderConfigForm = () => (
    <div className='space-y-6'>
      {/* Основные настройки */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Globe className='h-5 w-5' />
            Основные настройки
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>HTTP метод</Label>
              <Select
                value={apiConfig.method || 'GET'}
                onValueChange={(value) => handleConfigChange('method', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='GET'>GET</SelectItem>
                  <SelectItem value='POST'>POST</SelectItem>
                  <SelectItem value='PUT'>PUT</SelectItem>
                  <SelectItem value='DELETE'>DELETE</SelectItem>
                  <SelectItem value='PATCH'>PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>Таймаут (мс)</Label>
              <Input
                type='number'
                value={apiConfig.timeout || 30000}
                onChange={(e) =>
                  handleConfigChange('timeout', parseInt(e.target.value))
                }
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label>URL запроса</Label>
            <Input
              placeholder='https://api.example.com/endpoint'
              value={apiConfig.url || ''}
              onChange={(e) => handleConfigChange('url', e.target.value)}
            />
            <p className='text-muted-foreground text-xs'>
              Используйте {'{VARIABLE}'} для подстановки переменных
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Аутентификация */}
      <AuthConfigEditor
        config={apiConfig.auth}
        onChange={(auth) => handleConfigChange('auth', auth)}
        availableVariables={availableVariables}
      />

      {/* Заголовки */}
      <HeadersEditor
        headers={apiConfig.headers}
        onChange={(headers) => handleConfigChange('headers', headers)}
        availableVariables={availableVariables}
      />

      {/* Query параметры */}
      {(apiConfig.method === 'GET' || apiConfig.method === 'DELETE') && (
        <QueryParamsEditor
          params={apiConfig.queryParams}
          onChange={(params) => handleConfigChange('queryParams', params)}
          availableVariables={availableVariables}
        />
      )}

      {/* Тело запроса */}
      {(apiConfig.method === 'POST' ||
        apiConfig.method === 'PUT' ||
        apiConfig.method === 'PATCH') && (
        <BodyEditor
          body={apiConfig.body}
          onChange={(body) => handleConfigChange('body', body)}
          availableVariables={availableVariables}
        />
      )}

      {/* Обработка ответа */}
      <ResponseMappingEditor
        mapping={apiConfig.responseMapping}
        onChange={(mapping) => handleConfigChange('responseMapping', mapping)}
      />

      {/* Повторные попытки */}
      <RetryConfigEditor config={apiConfig} onChange={handleConfigChange} />

      {/* Тестирование */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <TestTube className='h-5 w-5' />
            Тестирование запроса
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex gap-2'>
            <Button
              onClick={handleTestRequest}
              disabled={isTesting || !apiConfig.url}
              className='flex items-center gap-2'
            >
              {isTesting ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Play className='h-4 w-4' />
              )}
              {isTesting ? 'Тестирование...' : 'Протестировать'}
            </Button>
          </div>

          {testResult && (
            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <Badge variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? 'Успешно' : 'Ошибка'}
                </Badge>
                <span className='text-muted-foreground text-sm'>
                  Статус: {testResult.status} | Время: {testResult.duration}мс
                </span>
              </div>

              {testResult.error && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{testResult.error}</AlertDescription>
                </Alert>
              )}

              {testResult.data && (
                <div className='space-y-2'>
                  <Label>Ответ:</Label>
                  <Textarea
                    value={JSON.stringify(testResult.data, null, 2)}
                    readOnly
                    rows={8}
                    className='font-mono text-xs'
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className='space-y-4'>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='presets'>Шаблоны API</TabsTrigger>
          <TabsTrigger value='config'>Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value='presets' className='space-y-4'>
          {renderPresetGrid()}
        </TabsContent>

        <TabsContent value='config' className='space-y-4'>
          {renderConfigForm()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Вспомогательные компоненты для редактирования различных частей API конфигурации

const AuthConfigEditor: React.FC<{
  config?: any;
  onChange: (auth: any) => void;
  availableVariables: string[];
}> = ({ config, onChange, availableVariables }) => (
  <Card>
    <CardHeader>
      <CardTitle className='flex items-center gap-2'>
        <Key className='h-5 w-5' />
        Аутентификация
      </CardTitle>
    </CardHeader>
    <CardContent className='space-y-4'>
      <div className='space-y-2'>
        <Label>Тип аутентификации</Label>
        <Select
          value={config?.type || 'none'}
          onValueChange={(value) => onChange({ ...config, type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='none'>Без аутентификации</SelectItem>
            <SelectItem value='bearer'>Bearer Token</SelectItem>
            <SelectItem value='basic'>Basic Auth</SelectItem>
            <SelectItem value='api_key'>API Key</SelectItem>
            <SelectItem value='custom'>Пользовательский</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config?.type === 'bearer' && (
        <div className='space-y-2'>
          <Label>Token</Label>
          <Input
            type='password'
            placeholder='Ваш Bearer token'
            value={config.token || ''}
            onChange={(e) => onChange({ ...config, token: e.target.value })}
          />
        </div>
      )}

      {config?.type === 'basic' && (
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label>Логин</Label>
            <Input
              placeholder='username'
              value={config.username || ''}
              onChange={(e) =>
                onChange({ ...config, username: e.target.value })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label>Пароль</Label>
            <Input
              type='password'
              placeholder='password'
              value={config.password || ''}
              onChange={(e) =>
                onChange({ ...config, password: e.target.value })
              }
            />
          </div>
        </div>
      )}

      {config?.type === 'api_key' && (
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>API Key</Label>
            <Input
              type='password'
              placeholder='your-api-key'
              value={config.apiKey || ''}
              onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
            />
          </div>
          <div className='space-y-2'>
            <Label>Имя заголовка</Label>
            <Input
              placeholder='X-API-Key'
              value={config.headerName || 'X-API-Key'}
              onChange={(e) =>
                onChange({ ...config, headerName: e.target.value })
              }
            />
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);

const HeadersEditor: React.FC<{
  headers?: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
  availableVariables: string[];
}> = ({ headers = {}, onChange, availableVariables }) => {
  const [headerPairs, setHeaderPairs] = useState(
    Object.entries(headers).map(([key, value]) => ({
      key,
      value,
      id: Math.random()
    }))
  );

  const addHeader = () => {
    setHeaderPairs([...headerPairs, { key: '', value: '', id: Math.random() }]);
  };

  const updateHeader = (id: number, field: 'key' | 'value', value: string) => {
    setHeaderPairs(
      headerPairs.map((h) => (h.id === id ? { ...h, [field]: value } : h))
    );
  };

  const removeHeader = (id: number) => {
    setHeaderPairs(headerPairs.filter((h) => h.id !== id));
  };

  useEffect(() => {
    const newHeaders: Record<string, string> = {};
    headerPairs.forEach(({ key, value }) => {
      if (key.trim()) newHeaders[key.trim()] = value;
    });
    onChange(newHeaders);
  }, [headerPairs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Заголовки запроса</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {headerPairs.map((header) => (
          <div key={header.id} className='flex gap-2'>
            <Input
              placeholder='Header name'
              value={header.key}
              onChange={(e) => updateHeader(header.id, 'key', e.target.value)}
            />
            <Input
              placeholder='Header value'
              value={header.value}
              onChange={(e) => updateHeader(header.id, 'value', e.target.value)}
            />
            <Button
              variant='outline'
              size='sm'
              onClick={() => removeHeader(header.id)}
            >
              ✕
            </Button>
          </div>
        ))}

        <Button variant='outline' onClick={addHeader}>
          Добавить заголовок
        </Button>
      </CardContent>
    </Card>
  );
};

const QueryParamsEditor: React.FC<{
  params?: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
  availableVariables: string[];
}> = ({ params = {}, onChange, availableVariables }) => {
  const [paramPairs, setParamPairs] = useState(
    Object.entries(params).map(([key, value]) => ({
      key,
      value,
      id: Math.random()
    }))
  );

  const addParam = () => {
    setParamPairs([...paramPairs, { key: '', value: '', id: Math.random() }]);
  };

  const updateParam = (id: number, field: 'key' | 'value', value: string) => {
    setParamPairs(
      paramPairs.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const removeParam = (id: number) => {
    setParamPairs(paramPairs.filter((p) => p.id !== id));
  };

  useEffect(() => {
    const newParams: Record<string, string> = {};
    paramPairs.forEach(({ key, value }) => {
      if (key.trim()) newParams[key.trim()] = value;
    });
    onChange(newParams);
  }, [paramPairs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query параметры</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {paramPairs.map((param) => (
          <div key={param.id} className='flex gap-2'>
            <Input
              placeholder='param_name'
              value={param.key}
              onChange={(e) => updateParam(param.id, 'key', e.target.value)}
            />
            <Input
              placeholder='param_value'
              value={param.value}
              onChange={(e) => updateParam(param.id, 'value', e.target.value)}
            />
            <Button
              variant='outline'
              size='sm'
              onClick={() => removeParam(param.id)}
            >
              ✕
            </Button>
          </div>
        ))}

        <Button variant='outline' onClick={addParam}>
          Добавить параметр
        </Button>
      </CardContent>
    </Card>
  );
};

const BodyEditor: React.FC<{
  body?: any;
  onChange: (body: any) => void;
  availableVariables: string[];
}> = ({ body, onChange, availableVariables }) => {
  const [bodyText, setBodyText] = useState(
    body ? JSON.stringify(body, null, 2) : ''
  );

  const handleBodyChange = (text: string) => {
    setBodyText(text);
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
    } catch (error) {
      // Не валидный JSON, но сохраняем как есть
      onChange(text);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Тело запроса (JSON)</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Textarea
          placeholder='{"key": "value"}'
          value={bodyText}
          onChange={(e) => handleBodyChange(e.target.value)}
          rows={8}
          className='font-mono text-sm'
        />

        <div className='text-muted-foreground text-sm'>
          <p>Используйте {'{VARIABLE}'} для подстановки переменных из сессии</p>
          <div className='mt-2 flex flex-wrap gap-1'>
            {availableVariables.slice(0, 10).map((variable) => (
              <Badge
                key={variable}
                variant='secondary'
                className='cursor-pointer text-xs'
                onClick={() => {
                  const newBody = bodyText.replace(
                    /(\{.*?\}|\w+)$/,
                    `{${variable}}`
                  );
                  handleBodyChange(newBody);
                }}
              >
                {'{' + variable + '}'}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ResponseMappingEditor: React.FC<{
  mapping?: any;
  onChange: (mapping: any) => void;
}> = ({ mapping = {}, onChange }) => (
  <Card>
    <CardHeader>
      <CardTitle>Обработка ответа</CardTitle>
    </CardHeader>
    <CardContent className='space-y-4'>
      <div className='grid grid-cols-3 gap-4'>
        <div className='space-y-2'>
          <Label>Путь к успеху</Label>
          <Input
            placeholder='data.success'
            value={mapping.successPath || ''}
            onChange={(e) =>
              onChange({ ...mapping, successPath: e.target.value })
            }
          />
        </div>

        <div className='space-y-2'>
          <Label>Путь к ошибке</Label>
          <Input
            placeholder='data.error.message'
            value={mapping.errorPath || ''}
            onChange={(e) =>
              onChange({ ...mapping, errorPath: e.target.value })
            }
          />
        </div>

        <div className='space-y-2'>
          <Label>Путь к данным</Label>
          <Input
            placeholder='data.result'
            value={mapping.dataPath || ''}
            onChange={(e) => onChange({ ...mapping, dataPath: e.target.value })}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Переменная для сохранения результата</Label>
        <Input
          placeholder='apiResponse'
          value={mapping.resultVariable || ''}
          onChange={(e) =>
            onChange({ ...mapping, resultVariable: e.target.value })
          }
        />
      </div>
    </CardContent>
  </Card>
);

const RetryConfigEditor: React.FC<{
  config: any;
  onChange: (field: string, value: any) => void;
}> = ({ config, onChange }) => (
  <Card>
    <CardHeader>
      <CardTitle>Повторные попытки</CardTitle>
    </CardHeader>
    <CardContent className='space-y-4'>
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label>Количество повторов</Label>
          <Input
            type='number'
            min='0'
            max='5'
            value={config.retries || 0}
            onChange={(e) => onChange('retries', parseInt(e.target.value))}
          />
        </div>

        <div className='space-y-2'>
          <Label>Задержка между повторами (мс)</Label>
          <Input
            type='number'
            min='100'
            value={config.retryDelay || 1000}
            onChange={(e) => onChange('retryDelay', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className='flex items-center space-x-2'>
        <Switch
          checked={config.exponentialBackoff || false}
          onCheckedChange={(checked) => onChange('exponentialBackoff', checked)}
        />
        <Label>Экспоненциальная задержка</Label>
      </div>
    </CardContent>
  </Card>
);
