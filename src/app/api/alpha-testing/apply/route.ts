/**
 * @file: src/app/api/alpha-testing/apply/route.ts
 * @description: API endpoint для подачи заявки на участие в альфа-тестировании
 * @project: SaaS Bonus System
 * @dependencies: Prisma, Next.js
 * @created: 2025-09-29
 * @author: AI Assistant + User
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

interface TesterApplication {
  companyName: string;
  companySize: string;
  website: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactPosition: string;
  currentBonusSystem: string;
  experienceLevel: string;
  motivation: string;
  expectations: string;
  cms: string;
  technicalSkills: string;
  availableTime: string;
  agreeToTerms: boolean;
  agreeToNDA: boolean;
  agreeToMarketing: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: TesterApplication = await request.json();

    // Валидация обязательных полей
    const requiredFields = [
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
      'availableTime'
    ];

    for (const field of requiredFields) {
      if (!body[field as keyof TesterApplication]) {
        return NextResponse.json(
          { error: `Поле ${field} обязательно для заполнения` },
          { status: 400 }
        );
      }
    }

    // Валидация согласий
    if (!body.agreeToTerms || !body.agreeToNDA) {
      return NextResponse.json(
        { error: 'Необходимо согласиться с условиями использования и NDA' },
        { status: 400 }
      );
    }

    // Проверка существующей заявки
    const existingApplication = await db.alphaTesterApplication.findUnique({
      where: { contactEmail: body.contactEmail }
    });

    if (existingApplication) {
      return NextResponse.json(
        { error: 'Заявка с таким email уже существует' },
        { status: 409 }
      );
    }

    // Создание заявки
    const application = await db.alphaTesterApplication.create({
      data: {
        companyName: body.companyName,
        companySize: body.companySize,
        website: body.website,
        industry: body.industry,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone || null,
        contactPosition: body.contactPosition,
        currentBonusSystem: body.currentBonusSystem || null,
        experienceLevel: body.experienceLevel,
        motivation: body.motivation,
        expectations: body.expectations || null,
        cms: body.cms,
        technicalSkills: body.technicalSkills,
        availableTime: body.availableTime,
        agreeToTerms: body.agreeToTerms,
        agreeToNDA: body.agreeToNDA,
        agreeToMarketing: body.agreeToMarketing
      }
    });

    // Отправка уведомления администраторам (можно добавить позже)
    // await sendAdminNotification(application);

    logger.info('New alpha tester application submitted', {
      applicationId: application.id,
      email: application.contactEmail,
      company: application.companyName
    });

    return NextResponse.json({
      success: true,
      message: 'Заявка успешно отправлена',
      applicationId: application.id
    });
  } catch (error) {
    logger.error('Error processing alpha tester application:', {
      error: String(error)
    });

    // Обработка ошибок валидации Prisma
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Заявка с таким email уже существует' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Получение списка заявок (только для администраторов)
export async function GET(request: NextRequest) {
  try {
    // TODO: Добавить проверку авторизации администратора

    const applications = await db.alphaTesterApplication.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ applications });
  } catch (error) {
    logger.error('Error fetching alpha tester applications:', {
      error: String(error)
    });
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
