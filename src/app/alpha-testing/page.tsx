/**
 * @file: src/app/alpha-testing/page.tsx
 * @description: Публичная страница регистрации альфа-тестеров
 * @project: SaaS Bonus System
 * @dependencies: Next.js, React, Shadcn/ui
 * @created: 2025-09-29
 * @author: AI Assistant + User
 */

'use client';

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle,
  Users,
  Zap,
  Shield,
  BarChart3
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TesterApplication {
  // Информация о компании
  companyName: string;
  companySize: string;
  website: string;
  industry: string;

  // Контактная информация
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactPosition: string;

  // Опыт и мотивация
  currentBonusSystem: string;
  experienceLevel: string;
  motivation: string;
  expectations: string;

  // Техническая информация
  cms: string;
  technicalSkills: string;
  availableTime: string;

  // Согласия
  agreeToTerms: boolean;
  agreeToNDA: boolean;
  agreeToMarketing: boolean;
}

const initialForm: TesterApplication = {
  companyName: '',
  companySize: '',
  website: '',
  industry: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactPosition: '',
  currentBonusSystem: '',
  experienceLevel: '',
  motivation: '',
  expectations: '',
  cms: '',
  technicalSkills: '',
  availableTime: '',
  agreeToTerms: false,
  agreeToNDA: false,
  agreeToMarketing: false
};

export default function AlphaTestingPage() {
  const [form, setForm] = useState<TesterApplication>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');

  const handleInputChange = (
    field: keyof TesterApplication,
    value: string | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Валидация обязательных полей
      const requiredFields: (keyof TesterApplication)[] = [
        'companyName',
        'companySize',
        'website',
        'industry',
        'contactName',
        'contactEmail',
        'contactPosition',
        'experienceLevel',
        'motivation',
        'cms',
        'technicalSkills',
        'availableTime',
        'agreeToTerms',
        'agreeToNDA'
      ];

      const missingFields = requiredFields.filter((field) => {
        const value = form[field];
        if (typeof value === 'boolean') return !value;
        return !value.trim();
      });

      if (missingFields.length > 0) {
        throw new Error('Пожалуйста, заполните все обязательные поля');
      }

      // Отправка заявки
      const response = await fetch('/api/alpha-testing/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error('Ошибка отправки заявки');
      }

      setSubmitStatus('success');
      setForm(initialForm);
    } catch (error) {
      console.error('Error submitting application:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100'>
      {/* Header */}
      <div className='bg-white shadow-sm'>
        <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
          <div className='text-center'>
            <h1 className='mb-4 text-4xl font-bold text-gray-900'>
              Альфа-Тестирование SaaS Bonus System
            </h1>
            <p className='mx-auto max-w-3xl text-xl text-gray-600'>
              Станьте одним из первых пользователей инновационной платформы
              бонусных программ с Telegram ботами. Получите бесплатный доступ ко
              всем функциям и возможность влиять на развитие продукта.
            </p>
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
        <div className='grid gap-8 lg:grid-cols-3'>
          {/* Benefits Sidebar */}
          <div className='space-y-6 lg:col-span-1'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Zap className='h-5 w-5 text-yellow-500' />
                  Преимущества участия
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-start gap-3'>
                  <CheckCircle className='mt-0.5 h-5 w-5 text-green-500' />
                  <div>
                    <h4 className='font-medium'>Бесплатный доступ</h4>
                    <p className='text-sm text-gray-600'>
                      Все функции без ограничений на период тестирования
                    </p>
                  </div>
                </div>
                <div className='flex items-start gap-3'>
                  <CheckCircle className='mt-0.5 h-5 w-5 text-green-500' />
                  <div>
                    <h4 className='font-medium'>Приоритетная поддержка</h4>
                    <p className='text-sm text-gray-600'>
                      Прямой доступ к команде разработчиков
                    </p>
                  </div>
                </div>
                <div className='flex items-start gap-3'>
                  <CheckCircle className='mt-0.5 h-5 w-5 text-green-500' />
                  <div>
                    <h4 className='font-medium'>Влияние на продукт</h4>
                    <p className='text-sm text-gray-600'>
                      Ваши идеи формируют будущее платформы
                    </p>
                  </div>
                </div>
                <div className='flex items-start gap-3'>
                  <CheckCircle className='mt-0.5 h-5 w-5 text-green-500' />
                  <div>
                    <h4 className='font-medium'>Ранний доступ</h4>
                    <p className='text-sm text-gray-600'>
                      Новые функции раньше всех
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='h-5 w-5 text-blue-500' />
                  Что мы ожидаем
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='text-sm'>
                  <Badge variant='secondary' className='mr-2'>
                    3-5 часов/неделя
                  </Badge>
                  Активное тестирование
                </div>
                <div className='text-sm'>
                  <Badge variant='secondary' className='mr-2'>
                    Еженедельные отчеты
                  </Badge>
                  Детальная обратная связь
                </div>
                <div className='text-sm'>
                  <Badge variant='secondary' className='mr-2'>
                    30-минутные звонки
                  </Badge>
                  Еженедельные интервью
                </div>
                <div className='text-sm'>
                  <Badge variant='secondary' className='mr-2'>
                    Баг-репорты
                  </Badge>
                  С детальными скриншотами
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Shield className='h-5 w-5 text-green-500' />
                  Безопасность
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-sm text-gray-600'>
                <p>• Полная изоляция тестовых данных</p>
                <p>• Обязательное подписание NDA</p>
                <p>• Регулярные бэкапы и восстановление</p>
                <p>• Мониторинг безопасности 24/7</p>
              </CardContent>
            </Card>
          </div>

          {/* Application Form */}
          <div className='lg:col-span-2'>
            <Card>
              <CardHeader>
                <CardTitle>Заявка на участие в альфа-тестировании</CardTitle>
                <CardDescription>
                  Заполните форму ниже. Мы рассмотрим вашу заявку в течение 2-3
                  рабочих дней и свяжемся для проведения технического интервью.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitStatus === 'success' && (
                  <Alert className='mb-6'>
                    <CheckCircle className='h-4 w-4' />
                    <AlertDescription>
                      Спасибо! Ваша заявка успешно отправлена. Мы рассмотрим её
                      в ближайшее время и свяжемся с вами по указанному email.
                    </AlertDescription>
                  </Alert>
                )}

                {submitStatus === 'error' && (
                  <Alert className='mb-6'>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription>
                      Произошла ошибка при отправке заявки. Пожалуйста,
                      попробуйте еще раз или свяжитесь с нами напрямую.
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className='space-y-6'>
                  {/* Информация о компании */}
                  <div>
                    <h3 className='mb-4 flex items-center gap-2 text-lg font-medium'>
                      <BarChart3 className='h-5 w-5' />
                      Информация о компании
                    </h3>
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <Label htmlFor='companyName'>Название компании *</Label>
                        <Input
                          id='companyName'
                          value={form.companyName}
                          onChange={(e) =>
                            handleInputChange('companyName', e.target.value)
                          }
                          placeholder="ООО 'Мой Магазин'"
                          required
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='companySize'>Размер компании *</Label>
                        <Select
                          value={form.companySize}
                          onValueChange={(value) =>
                            handleInputChange('companySize', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder='Выберите размер' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='1-10'>
                              1-10 сотрудников
                            </SelectItem>
                            <SelectItem value='11-50'>
                              11-50 сотрудников
                            </SelectItem>
                            <SelectItem value='51-200'>
                              51-200 сотрудников
                            </SelectItem>
                            <SelectItem value='201-1000'>
                              201-1000 сотрудников
                            </SelectItem>
                            <SelectItem value='1000+'>
                              Более 1000 сотрудников
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='website'>Сайт компании *</Label>
                        <Input
                          id='website'
                          type='url'
                          value={form.website}
                          onChange={(e) =>
                            handleInputChange('website', e.target.value)
                          }
                          placeholder='https://example.com'
                          required
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='industry'>Отрасль *</Label>
                        <Select
                          value={form.industry}
                          onValueChange={(value) =>
                            handleInputChange('industry', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder='Выберите отрасль' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='ecommerce'>
                              E-commerce
                            </SelectItem>
                            <SelectItem value='retail'>
                              Розничная торговля
                            </SelectItem>
                            <SelectItem value='food'>Общепит</SelectItem>
                            <SelectItem value='beauty'>
                              Красота и здоровье
                            </SelectItem>
                            <SelectItem value='services'>Услуги</SelectItem>
                            <SelectItem value='education'>
                              Образование
                            </SelectItem>
                            <SelectItem value='other'>Другое</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Контактная информация */}
                  <div>
                    <h3 className='mb-4 text-lg font-medium'>
                      Контактная информация
                    </h3>
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <Label htmlFor='contactName'>Имя и фамилия *</Label>
                        <Input
                          id='contactName'
                          value={form.contactName}
                          onChange={(e) =>
                            handleInputChange('contactName', e.target.value)
                          }
                          placeholder='Иван Иванов'
                          required
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='contactPosition'>Должность *</Label>
                        <Input
                          id='contactPosition'
                          value={form.contactPosition}
                          onChange={(e) =>
                            handleInputChange('contactPosition', e.target.value)
                          }
                          placeholder='Маркетолог'
                          required
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='contactEmail'>Email *</Label>
                        <Input
                          id='contactEmail'
                          type='email'
                          value={form.contactEmail}
                          onChange={(e) =>
                            handleInputChange('contactEmail', e.target.value)
                          }
                          placeholder='ivan@example.com'
                          required
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='contactPhone'>Телефон</Label>
                        <Input
                          id='contactPhone'
                          value={form.contactPhone}
                          onChange={(e) =>
                            handleInputChange('contactPhone', e.target.value)
                          }
                          placeholder='+7 (999) 123-45-67'
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Опыт и мотивация */}
                  <div>
                    <h3 className='mb-4 text-lg font-medium'>
                      Опыт и мотивация
                    </h3>
                    <div className='space-y-4'>
                      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                        <div className='space-y-2'>
                          <Label htmlFor='currentBonusSystem'>
                            Текущая система бонусов
                          </Label>
                          <Select
                            value={form.currentBonusSystem}
                            onValueChange={(value) =>
                              handleInputChange('currentBonusSystem', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder='Выберите вариант' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='none'>Нет системы</SelectItem>
                              <SelectItem value='custom'>Самописная</SelectItem>
                              <SelectItem value='loyaltyplant'>
                                LoyaltyPlant
                              </SelectItem>
                              <SelectItem value='retailcrm'>
                                RetailCRM
                              </SelectItem>
                              <SelectItem value='other'>Другая</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='experienceLevel'>
                            Уровень технических навыков *
                          </Label>
                          <Select
                            value={form.experienceLevel}
                            onValueChange={(value) =>
                              handleInputChange('experienceLevel', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder='Выберите уровень' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='beginner'>
                                Начинающий (нужна помощь)
                              </SelectItem>
                              <SelectItem value='intermediate'>
                                Средний (могу настроить самостоятельно)
                              </SelectItem>
                              <SelectItem value='advanced'>
                                Продвинутый (могу интегрировать API)
                              </SelectItem>
                              <SelectItem value='expert'>
                                Эксперт (разработчик)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='motivation'>
                          Почему вы хотите участвовать? *
                        </Label>
                        <Textarea
                          id='motivation'
                          value={form.motivation}
                          onChange={(e) =>
                            handleInputChange('motivation', e.target.value)
                          }
                          placeholder='Расскажите о ваших целях и ожиданиях от участия в альфа-тестировании...'
                          rows={3}
                          required
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='expectations'>
                          Что вы ожидаете от платформы?
                        </Label>
                        <Textarea
                          id='expectations'
                          value={form.expectations}
                          onChange={(e) =>
                            handleInputChange('expectations', e.target.value)
                          }
                          placeholder='Опишите, какие функции для вас наиболее важны...'
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Техническая информация */}
                  <div>
                    <h3 className='mb-4 text-lg font-medium'>
                      Техническая информация
                    </h3>
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <Label htmlFor='cms'>CMS/Платформа сайта *</Label>
                        <Select
                          value={form.cms}
                          onValueChange={(value) =>
                            handleInputChange('cms', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder='Выберите платформу' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='tilda'>Tilda</SelectItem>
                            <SelectItem value='insales'>InSales</SelectItem>
                            <SelectItem value='wordpress'>WordPress</SelectItem>
                            <SelectItem value='custom'>
                              Самописный сайт
                            </SelectItem>
                            <SelectItem value='other'>Другая</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='availableTime'>
                          Время на тестирование *
                        </Label>
                        <Select
                          value={form.availableTime}
                          onValueChange={(value) =>
                            handleInputChange('availableTime', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder='Выберите время' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='2-3'>
                              2-3 часа в неделю
                            </SelectItem>
                            <SelectItem value='4-6'>
                              4-6 часов в неделю
                            </SelectItem>
                            <SelectItem value='7-10'>
                              7-10 часов в неделю
                            </SelectItem>
                            <SelectItem value='10+'>
                              Более 10 часов в неделю
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-2 md:col-span-2'>
                        <Label htmlFor='technicalSkills'>
                          Технические навыки *
                        </Label>
                        <Textarea
                          id='technicalSkills'
                          value={form.technicalSkills}
                          onChange={(e) =>
                            handleInputChange('technicalSkills', e.target.value)
                          }
                          placeholder='Опишите ваш опыт работы с CMS, API, базами данных...'
                          rows={2}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Согласия */}
                  <div>
                    <h3 className='mb-4 text-lg font-medium'>Согласия</h3>
                    <div className='space-y-4'>
                      <div className='flex items-start space-x-2'>
                        <Checkbox
                          id='agreeToTerms'
                          checked={form.agreeToTerms}
                          onCheckedChange={(checked) =>
                            handleInputChange('agreeToTerms', !!checked)
                          }
                          required
                        />
                        <div className='grid gap-1.5 leading-none'>
                          <Label htmlFor='agreeToTerms' className='text-sm'>
                            Я согласен с{' '}
                            <a
                              href='#'
                              className='text-blue-600 hover:underline'
                            >
                              условиями использования
                            </a>{' '}
                            платформы *
                          </Label>
                        </div>
                      </div>
                      <div className='flex items-start space-x-2'>
                        <Checkbox
                          id='agreeToNDA'
                          checked={form.agreeToNDA}
                          onCheckedChange={(checked) =>
                            handleInputChange('agreeToNDA', !!checked)
                          }
                          required
                        />
                        <div className='grid gap-1.5 leading-none'>
                          <Label htmlFor='agreeToNDA' className='text-sm'>
                            Я согласен подписать NDA (соглашение о
                            неразглашении) *
                          </Label>
                        </div>
                      </div>
                      <div className='flex items-start space-x-2'>
                        <Checkbox
                          id='agreeToMarketing'
                          checked={form.agreeToMarketing}
                          onCheckedChange={(checked) =>
                            handleInputChange('agreeToMarketing', !!checked)
                          }
                        />
                        <div className='grid gap-1.5 leading-none'>
                          <Label htmlFor='agreeToMarketing' className='text-sm'>
                            Я согласен получать маркетинговые материалы и
                            обновления о продукте
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    type='submit'
                    className='w-full'
                    size='lg'
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
