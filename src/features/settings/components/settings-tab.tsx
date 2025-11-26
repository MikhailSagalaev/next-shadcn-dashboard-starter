/**
 * @file: src/features/settings/components/settings-tab.tsx
 * @description: Компонент таба "Настройки" для объединенной страницы настроек
 * @project: SaaS Bonus System
 * @dependencies: React, UI components
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent
} from 'react';
import { useTheme } from 'next-themes';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Shield, Bell, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileSettings {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatar: string;
  };
  security: {
    enableTwoFactor: boolean;
    sessionTimeout: number;
    changePassword: boolean;
  };
  notifications: {
    enableEmailNotifications: boolean;
    enableSystemNotifications: boolean;
    enableSecurityAlerts: boolean;
    notificationEmail: string;
  };
}

export function SettingsTab() {
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<ProfileSettings>({
    personal: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      avatar: ''
    },
    security: {
      enableTwoFactor: false,
      sessionTimeout: 24,
      changePassword: false
    },
    notifications: {
      enableEmailNotifications: true,
      enableSystemNotifications: true,
      enableSecurityAlerts: true,
      notificationEmail: ''
    }
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorDisableModalOpen, setTwoFactorDisableModalOpen] =
    useState(false);
  const [twoFactorQr, setTwoFactorQr] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState('');
  const [twoFactorSetupLoading, setTwoFactorSetupLoading] = useState(false);
  const [twoFactorEnabling, setTwoFactorEnabling] = useState(false);
  const [twoFactorDisabling, setTwoFactorDisabling] = useState(false);
  const [sendingTestNotification, setSendingTestNotification] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile/settings');
      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        toast.error('Ошибка загрузки настроек');
        return;
      }
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = (
    section: keyof ProfileSettings,
    field: string,
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/profile/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Не удалось сохранить настройки');
        return;
      }

      toast.success('Настройки сохранены');
    } catch (error) {
      console.error('Save settings error', error);
      toast.error('Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordInput = (
    field: keyof typeof passwordForm,
    value: string
  ) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Заполните все поля пароля');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Новый пароль должен быть не менее 8 символов');
      return;
    }

    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Пароль должен содержать буквы и цифры');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Новый пароль и подтверждение не совпадают');
      return;
    }

    try {
      setChangingPassword(true);
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(passwordForm)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Не удалось изменить пароль');
        return;
      }

      toast.success('Пароль обновлён');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Change password error', error);
      toast.error('Не удалось изменить пароль');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Файл превышает 2MB');
      event.target.value = '';
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Допустимы только PNG, JPEG или WebP');
      event.target.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    const formData = new FormData();
    formData.append('avatar', file);

    const revokePreview = () => {
      URL.revokeObjectURL(previewUrl);
      setAvatarPreview(null);
    };

    try {
      setUploadingAvatar(true);
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Не удалось загрузить аватар');
        revokePreview();
        return;
      }

      const data = await response.json();
      revokePreview();
      setSettings((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          avatar: data.avatarUrl
        }
      }));
      toast.success('Аватар обновлён');
    } catch (error) {
      console.error('Avatar upload error', error);
      toast.error('Не удалось загрузить аватар');
      revokePreview();
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleTwoFactorToggle = (checked: boolean) => {
    if (checked) {
      if (settings.security.enableTwoFactor || twoFactorSetupLoading) {
        return;
      }
      startTwoFactorSetup();
      return;
    }

    if (!settings.security.enableTwoFactor) {
      return;
    }
    setTwoFactorDisableCode('');
    setTwoFactorDisableModalOpen(true);
  };

  const startTwoFactorSetup = async () => {
    try {
      setTwoFactorSetupLoading(true);
      const response = await fetch('/api/profile/2fa/setup', {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Не удалось инициировать 2FA');
        return;
      }

      const data = await response.json();
      setTwoFactorQr(data.qrCodeDataUrl);
      setTwoFactorSecret(data.secret);
      setTwoFactorCode('');
      setTwoFactorModalOpen(true);
    } catch (error) {
      console.error('2FA setup error', error);
      toast.error('Не удалось инициировать 2FA');
    } finally {
      setTwoFactorSetupLoading(false);
    }
  };

  const closeTwoFactorModal = () => {
    if (twoFactorEnabling) return;
    setTwoFactorModalOpen(false);
    setTwoFactorQr(null);
    setTwoFactorSecret('');
    setTwoFactorCode('');
  };

  const closeDisableTwoFactorModal = () => {
    if (twoFactorDisabling) return;
    setTwoFactorDisableModalOpen(false);
    setTwoFactorDisableCode('');
  };

  const confirmTwoFactorEnable = async () => {
    if (!twoFactorCode || twoFactorCode.trim().length < 6) {
      toast.error('Введите код из приложения');
      return;
    }

    try {
      setTwoFactorEnabling(true);
      const response = await fetch('/api/profile/2fa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: twoFactorCode.trim() })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Не удалось включить 2FA');
        return;
      }

      setSettings((prev) => ({
        ...prev,
        security: { ...prev.security, enableTwoFactor: true }
      }));
      toast.success('Двухфакторная аутентификация включена');
      closeTwoFactorModal();
    } catch (error) {
      console.error('Enable 2FA error', error);
      toast.error('Не удалось включить 2FA');
    } finally {
      setTwoFactorEnabling(false);
    }
  };

  const confirmDisableTwoFactor = async () => {
    if (!twoFactorDisableCode || twoFactorDisableCode.trim().length < 6) {
      toast.error('Введите код из приложения');
      return;
    }

    try {
      setTwoFactorDisabling(true);
      const response = await fetch('/api/profile/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: twoFactorDisableCode.trim() })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Не удалось отключить 2FA');
        return;
      }

      setSettings((prev) => ({
        ...prev,
        security: { ...prev.security, enableTwoFactor: false }
      }));
      toast.success('Двухфакторная аутентификация отключена');
      closeDisableTwoFactorModal();
    } catch (error) {
      console.error('Disable 2FA error', error);
      toast.error('Не удалось отключить 2FA');
    } finally {
      setTwoFactorDisabling(false);
    }
  };

  const handleCopySecret = async () => {
    if (!twoFactorSecret || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(twoFactorSecret);
      toast.success('Секрет скопирован');
    } catch {
      toast.error('Не удалось скопировать код');
    }
  };

  const handleSendTestNotification = async () => {
    if (!settings.notifications.notificationEmail) {
      toast.error('Укажите email для уведомлений');
      return;
    }

    if (!settings.notifications.enableEmailNotifications) {
      toast.error('Email уведомления отключены');
      return;
    }

    try {
      setSendingTestNotification(true);
      const response = await fetch('/api/profile/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationEmail: settings.notifications.notificationEmail,
          enableEmailNotifications:
            settings.notifications.enableEmailNotifications
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Не удалось отправить уведомление');
        return;
      }

      toast.success('Тестовое уведомление отправлено');
    } catch (error) {
      console.error('Test notification error', error);
      toast.error('Не удалось отправить уведомление');
    } finally {
      setSendingTestNotification(false);
    }
  };

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-center'>
          <div className='border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Загрузка настроек профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex gap-2'>
        <Button onClick={handleSaveSettings} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
              Сохранение...
            </>
          ) : (
            <>
              <Save className='mr-2 h-4 w-4' />
              Сохранить
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue='personal' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='personal'>
            <User className='mr-2 h-4 w-4' />
            Личная информация
          </TabsTrigger>
          <TabsTrigger value='security'>
            <Shield className='mr-2 h-4 w-4' />
            Безопасность
          </TabsTrigger>
          <TabsTrigger value='notifications'>
            <Bell className='mr-2 h-4 w-4' />
            Уведомления
          </TabsTrigger>
        </TabsList>

        <TabsContent value='personal'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <User className='h-5 w-5' />
                Личная информация
              </CardTitle>
              <CardDescription>
                Основная информация о вашем профиле
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center gap-4'>
                <Avatar className='h-20 w-20'>
                  <AvatarImage
                    src={avatarPreview ?? settings.personal.avatar}
                  />
                  <AvatarFallback className='text-lg'>
                    {settings.personal.firstName?.[0] || 'A'}
                    {settings.personal.lastName?.[0] || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleAvatarButtonClick}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? 'Загрузка...' : 'Изменить фото'}
                  </Button>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    JPG, PNG до 2MB
                  </p>
                </div>
                {twoFactorSetupLoading && (
                  <p className='text-muted-foreground text-sm'>
                    Генерируем QR-код для подключения...
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/png,image/jpeg,image/webp'
                className='hidden'
                onChange={handleAvatarChange}
              />

              <Separator />

              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='firstName'>Имя</Label>
                  <Input
                    id='firstName'
                    value={settings.personal.firstName}
                    onChange={(e) =>
                      handleInputChange('personal', 'firstName', e.target.value)
                    }
                    placeholder='Введите ваше имя'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='lastName'>Фамилия</Label>
                  <Input
                    id='lastName'
                    value={settings.personal.lastName}
                    onChange={(e) =>
                      handleInputChange('personal', 'lastName', e.target.value)
                    }
                    placeholder='Введите вашу фамилию'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input
                    id='email'
                    type='email'
                    value={settings.personal.email}
                    onChange={(e) =>
                      handleInputChange('personal', 'email', e.target.value)
                    }
                    placeholder='example@domain.com'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='phone'>Телефон</Label>
                  <Input
                    id='phone'
                    type='tel'
                    value={settings.personal.phone}
                    onChange={(e) =>
                      handleInputChange('personal', 'phone', e.target.value)
                    }
                    placeholder='+7 (999) 123-45-67'
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='security'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Shield className='h-5 w-5' />
                Безопасность
              </CardTitle>
              <CardDescription>
                Настройки безопасности вашего аккаунта
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label>Двухфакторная аутентификация</Label>
                    <p className='text-muted-foreground text-sm'>
                      Дополнительная защита вашего аккаунта
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {settings.security.enableTwoFactor
                        ? '2FA включена'
                        : '2FA отключена'}
                    </p>
                  </div>
                  <Switch
                    checked={settings.security.enableTwoFactor}
                    onCheckedChange={handleTwoFactorToggle}
                    disabled={
                      twoFactorSetupLoading ||
                      twoFactorEnabling ||
                      twoFactorDisabling
                    }
                  />
                </div>

                <Separator />

                <div className='space-y-2'>
                  <Label htmlFor='sessionTimeout'>Таймаут сессии (часы)</Label>
                  <Input
                    id='sessionTimeout'
                    type='number'
                    value={settings.security.sessionTimeout}
                    onChange={(e) =>
                      handleInputChange(
                        'security',
                        'sessionTimeout',
                        parseInt(e.target.value)
                      )
                    }
                    min={1}
                    max={168}
                  />
                  <p className='text-muted-foreground text-sm'>
                    Автоматический выход из системы через указанное время
                  </p>
                </div>

                <Separator />

                <div className='space-y-2'>
                  <Label>Смена пароля</Label>
                  <div className='grid gap-3 md:grid-cols-3'>
                    <Input
                      type='password'
                      placeholder='Текущий пароль'
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        handlePasswordInput('currentPassword', e.target.value)
                      }
                    />
                    <Input
                      type='password'
                      placeholder='Новый пароль'
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        handlePasswordInput('newPassword', e.target.value)
                      }
                    />
                    <Input
                      type='password'
                      placeholder='Повторите новый пароль'
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        handlePasswordInput('confirmPassword', e.target.value)
                      }
                    />
                  </div>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <p className='text-muted-foreground text-sm'>
                      Пароль должен содержать буквы и цифры, минимум 8 символов
                    </p>
                    <Button
                      variant='outline'
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                    >
                      {changingPassword ? 'Сохранение...' : 'Изменить пароль'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='notifications'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Bell className='h-5 w-5' />
                Уведомления
              </CardTitle>
              <CardDescription>
                Настройки уведомлений для вашего профиля
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label>Email уведомления</Label>
                    <p className='text-muted-foreground text-sm'>
                      Получать уведомления на email
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications.enableEmailNotifications}
                    onCheckedChange={(checked) =>
                      handleInputChange(
                        'notifications',
                        'enableEmailNotifications',
                        checked
                      )
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label>Системные уведомления</Label>
                    <p className='text-muted-foreground text-sm'>
                      Уведомления о важных событиях в системе
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications.enableSystemNotifications}
                    onCheckedChange={(checked) =>
                      handleInputChange(
                        'notifications',
                        'enableSystemNotifications',
                        checked
                      )
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Label>Уведомления безопасности</Label>
                    <p className='text-muted-foreground text-sm'>
                      Критические уведомления о безопасности
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications.enableSecurityAlerts}
                    onCheckedChange={(checked) =>
                      handleInputChange(
                        'notifications',
                        'enableSecurityAlerts',
                        checked
                      )
                    }
                  />
                </div>

                <Separator />

                <div className='space-y-2'>
                  <Label htmlFor='notificationEmail'>
                    Email для уведомлений
                  </Label>
                  <Input
                    id='notificationEmail'
                    type='email'
                    value={settings.notifications.notificationEmail}
                    onChange={(e) =>
                      handleInputChange(
                        'notifications',
                        'notificationEmail',
                        e.target.value
                      )
                    }
                    placeholder='notifications@domain.com'
                  />
                  <p className='text-muted-foreground text-sm'>
                    Адрес для получения системных уведомлений
                  </p>
                </div>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p className='text-muted-foreground text-sm'>
                    Отправьте тестовое письмо, чтобы убедиться, что адрес указан
                    верно.
                  </p>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleSendTestNotification}
                    disabled={
                      sendingTestNotification ||
                      !settings.notifications.notificationEmail
                    }
                  >
                    {sendingTestNotification
                      ? 'Отправляем...'
                      : 'Тестовое уведомление'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={twoFactorModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeTwoFactorModal();
          } else {
            setTwoFactorModalOpen(true);
          }
        }}
      >
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Подключение двухфакторной аутентификации</DialogTitle>
            <DialogDescription>
              Отсканируйте QR-код в приложении Google Authenticator или введите
              секрет вручную, затем подтвердите кодом.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            {twoFactorQr ? (
              <div className='bg-muted/30 flex flex-col items-center gap-2 rounded-lg border p-4'>
                <img
                  src={twoFactorQr}
                  alt='QR для 2FA'
                  className='h-48 w-48 rounded-md border bg-white p-2'
                />
                <p className='text-muted-foreground text-center text-xs'>
                  Отсканируйте QR-код в приложении-аутентификаторе
                </p>
              </div>
            ) : (
              <p className='text-muted-foreground text-center text-sm'>
                Подготовка секрета...
              </p>
            )}
            {twoFactorSecret && (
              <div className='space-y-2'>
                <Label>Секрет (Base32) для ручного ввода</Label>
                <div className='flex gap-2'>
                  <Input readOnly value={twoFactorSecret} />
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleCopySecret}
                  >
                    Скопировать
                  </Button>
                </div>
              </div>
            )}
            <div className='space-y-2'>
              <Label>Код из приложения</Label>
              <Input
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder='123 456'
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter className='gap-2 sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              onClick={closeTwoFactorModal}
              disabled={twoFactorEnabling}
            >
              Отмена
            </Button>
            <Button
              type='button'
              onClick={confirmTwoFactorEnable}
              disabled={twoFactorEnabling}
            >
              {twoFactorEnabling ? 'Подтверждаем...' : 'Подтвердить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={twoFactorDisableModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDisableTwoFactorModal();
          } else {
            setTwoFactorDisableModalOpen(true);
          }
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Отключение 2FA</DialogTitle>
            <DialogDescription>
              Подтвердите действие кодом из приложения, чтобы отключить
              двухфакторную аутентификацию.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label>Код подтверждения</Label>
            <Input
              value={twoFactorDisableCode}
              onChange={(e) => setTwoFactorDisableCode(e.target.value)}
              placeholder='123 456'
              maxLength={6}
            />
          </div>
          <DialogFooter className='gap-2 sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              onClick={closeDisableTwoFactorModal}
              disabled={twoFactorDisabling}
            >
              Отмена
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={confirmDisableTwoFactor}
              disabled={twoFactorDisabling}
            >
              {twoFactorDisabling ? 'Отключаем...' : 'Отключить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
