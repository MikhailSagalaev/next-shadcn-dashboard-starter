/**
 * @file: src/features/bots/components/bot-settings-simplified.tsx
 * @description: Упрощенный компонент настроек Telegram бота
 * @project: SaaS Bonus System
 * @dependencies: React, shadcn/ui, API
 * @created: 2025-01-12
 * @author: AI Assistant
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Loader2,
  Play,
  Square,
  Settings,
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface BotSettingsSimplifiedProps {
  projectId: string;
}

interface BotSettings {
  id: string;
  botToken: string;
  botUsername: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BotStatus {
  configured: boolean;
  status: string;
  message: string;
}

export function BotSettingsSimplified({ projectId }: BotSettingsSimplifiedProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  // Формы
  const [tokenValue, setTokenValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Загрузка данных
  const fetchBotSettings = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/bot`);
      if (response.ok) {
        const data = await response.json();
        setBotSettings(data);
        setTokenValue(data.botToken || '');
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек бота:', error);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/bot/status`);
      if (response.ok) {
        const data = await response.json();
        setBotStatus(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса бота:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchBotSettings(), fetchBotStatus()]);
      setIsLoading(false);
    };
    
    loadData();
  }, [projectId]);

  // Сохранение токена
  const handleSaveToken = async () => {
    if (!tokenValue.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Токен бота не может быть пустым',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/bot`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tokenValue.trim(),
          botUsername: botSettings?.botUsername || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        setBotSettings(data);
        setIsEditing(false);
        toast({
          title: 'Успешно',
          description: 'Настройки бота сохранены'
        });
        await fetchBotStatus();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось сохранить настройки',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Ошибка сети при сохранении настроек',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Переключение статуса бота
  const handleToggleBot = async () => {
    setIsToggling(true);
    try {
      const shouldStop = botStatus?.status === 'ACTIVE';
      const response = await fetch(`/api/projects/${projectId}/bot/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop: shouldStop })
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: shouldStop ? 'Бот остановлен' : 'Бот запущен'
        });
        await fetchBotStatus();
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось изменить статус бота',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Ошибка сети при изменении статуса бота',
        variant: 'destructive'
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Копирование токена
  const handleCopyToken = () => {
    if (botSettings?.botToken) {
      navigator.clipboard.writeText(botSettings.botToken);
      toast({
        title: 'Скопировано',
        description: 'Токен скопирован в буфер обмена'
      });
    }
  };

  // Маскирование токена
  const maskToken = (token: string) => {
    if (!token) return '';
    if (token.length <= 8) return '••••••••';
    return token.slice(0, 4) + '••••••••' + token.slice(-4);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Загрузка настроек бота...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Подключение бота */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Подключение бота
          </CardTitle>
          <CardDescription>
            Получите токен у @BotFather в Telegram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bot-token">Токен бота</Label>
            <div className="flex items-center gap-2">
              <Input
                id="bot-token"
                type={showToken ? 'text' : 'password'}
                value={isEditing ? tokenValue : (botSettings?.botToken ? maskToken(botSettings.botToken) : '')}
                onChange={(e) => setTokenValue(e.target.value)}
                disabled={!isEditing}
                placeholder="Введите токен бота..."
                className="font-mono"
              />
              {!isEditing && botSettings?.botToken && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToken}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </>
              )}
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setTokenValue(botSettings?.botToken || '');
                    }}
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveToken}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Сохранить
                  </Button>
                </div>
              )}
            </div>
          </div>

          {botSettings?.botUsername && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" />
              <span>@{botSettings.botUsername}</span>
              <Badge variant="secondary" className="text-xs">
                {botStatus?.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Управление ботом */}
      <Card>
        <CardHeader>
          <CardTitle>Управление ботом</CardTitle>
          <CardDescription>
            Запустите или остановите бота
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Статус бота: {botStatus?.status === 'ACTIVE' ? 'Запущен' : 'Остановлен'}
              </p>
              {botStatus?.message && (
                <p className="text-xs text-muted-foreground">{botStatus.message}</p>
              )}
            </div>
            <Button
              onClick={handleToggleBot}
              disabled={isToggling || !botSettings?.botToken}
              variant={botStatus?.status === 'ACTIVE' ? 'destructive' : 'default'}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : botStatus?.status === 'ACTIVE' ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {botStatus?.status === 'ACTIVE' ? 'Остановить' : 'Запустить'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Настройка поведения */}
      <Card>
        <CardHeader>
          <CardTitle>Настройка поведения бота</CardTitle>
          <CardDescription>
            Используйте конструктор workflow для создания логики бота
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Все сообщения, команды и действия бота настраиваются через конструктор workflow. 
              Это позволяет гибко управлять поведением бота без конфликтов.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button
              onClick={() => router.push(`/dashboard/projects/${projectId}/workflow`)}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Открыть конструктор Workflow
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
