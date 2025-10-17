/**
 * @file: src/lib/services/project-variables.service.ts
 * @description: Сервис для управления переменными проекта
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2025-10-14
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import type { ProjectVariable } from '@prisma/client';

export interface CreateProjectVariableInput {
  projectId: string;
  key: string;
  value: string;
  description?: string;
  isSystem?: boolean;
}

export interface UpdateProjectVariableInput {
  value?: string;
  description?: string;
}

/**
 * Сервис для работы с переменными проекта
 */
export class ProjectVariablesService {
  /**
   * Получить все переменные проекта
   */
  static async getProjectVariables(projectId: string): Promise<ProjectVariable[]> {
    return db.projectVariable.findMany({
      where: { projectId },
      orderBy: [
        { isSystem: 'desc' }, // Системные переменные сначала
        { key: 'asc' }
      ]
    });
  }

  /**
   * Получить переменную по ключу
   */
  static async getVariableByKey(
    projectId: string,
    key: string
  ): Promise<ProjectVariable | null> {
    return db.projectVariable.findUnique({
      where: {
        projectId_key: {
          projectId,
          key
        }
      }
    });
  }

  /**
   * Получить переменные в виде объекта key-value
   */
  static async getVariablesAsObject(projectId: string): Promise<Record<string, string>> {
    const variables = await this.getProjectVariables(projectId);
    return variables.reduce((acc, variable) => {
      acc[variable.key] = variable.value;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Создать переменную
   */
  static async createVariable(
    input: CreateProjectVariableInput
  ): Promise<ProjectVariable> {
    // Проверяем, что ключ валиден (только буквы, цифры, подчеркивание)
    if (!/^[a-zA-Z0-9_]+$/.test(input.key)) {
      throw new Error('Ключ переменной может содержать только буквы, цифры и подчеркивание');
    }

    return db.projectVariable.create({
      data: {
        projectId: input.projectId,
        key: input.key,
        value: input.value,
        description: input.description,
        isSystem: input.isSystem || false
      }
    });
  }

  /**
   * Обновить переменную
   */
  static async updateVariable(
    projectId: string,
    key: string,
    input: UpdateProjectVariableInput
  ): Promise<ProjectVariable> {
    // Проверяем, что переменная не системная
    const existing = await this.getVariableByKey(projectId, key);
    if (existing?.isSystem) {
      throw new Error('Нельзя изменить системную переменную');
    }

    return db.projectVariable.update({
      where: {
        projectId_key: {
          projectId,
          key
        }
      },
      data: input
    });
  }

  /**
   * Удалить переменную
   */
  static async deleteVariable(projectId: string, key: string): Promise<void> {
    // Проверяем, что переменная не системная
    const existing = await this.getVariableByKey(projectId, key);
    if (existing?.isSystem) {
      throw new Error('Нельзя удалить системную переменную');
    }

    await db.projectVariable.delete({
      where: {
        projectId_key: {
          projectId,
          key
        }
      }
    });
  }

  /**
   * Инициализировать системные переменные для проекта
   */
  static async initializeSystemVariables(projectId: string): Promise<void> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, domain: true }
    });

    if (!project) {
      throw new Error('Проект не найден');
    }

    const systemVariables: CreateProjectVariableInput[] = [
      {
        projectId,
        key: 'project_name',
        value: project.name,
        description: 'Название проекта',
        isSystem: true
      },
      {
        projectId,
        key: 'domain',
        value: project.domain || '',
        description: 'Домен проекта',
        isSystem: true
      },
      {
        projectId,
        key: 'company_name',
        value: project.name,
        description: 'Название компании',
        isSystem: false
      },
      {
        projectId,
        key: 'support_email',
        value: 'support@example.com',
        description: 'Email службы поддержки',
        isSystem: false
      },
      {
        projectId,
        key: 'support_phone',
        value: '+7 (999) 123-45-67',
        description: 'Телефон службы поддержки',
        isSystem: false
      },
      {
        projectId,
        key: 'website',
        value: project.domain ? `https://${project.domain}` : '',
        description: 'Сайт компании',
        isSystem: false
      }
    ];

    // Создаем переменные, которых еще нет
    for (const variable of systemVariables) {
      const existing = await this.getVariableByKey(projectId, variable.key);
      if (!existing) {
        await this.createVariable(variable);
      }
    }
  }

  /**
   * Заменить переменные в тексте
   * Поддерживает формат {variable_name}
   */
  static async replaceVariablesInText(
    projectId: string,
    text: string,
    additionalVariables?: Record<string, string>
  ): Promise<string> {
    // Получаем переменные проекта
    const projectVariables = await this.getVariablesAsObject(projectId);

    // Объединяем с дополнительными переменными
    const allVariables = {
      ...projectVariables,
      ...additionalVariables
    };

    // Заменяем все вхождения {variable_name} и {user.variable}
    let result = text;
    for (const [key, value] of Object.entries(allVariables)) {
      // Поддерживаем оба формата: {variable_name} и {user.variable}
      const regex1 = new RegExp(`\\{${key}\\}`, 'g');
      const regex2 = new RegExp(`\\{${key.replace(/\./g, '\\.')}\\}`, 'g');
      result = result.replace(regex1, value);
      result = result.replace(regex2, value);
    }

    return result;
  }

  /**
   * Получить список доступных переменных для подсказок в UI
   */
  static async getAvailableVariables(projectId: string): Promise<Array<{
    key: string;
    value: string;
    description?: string;
    isSystem: boolean;
  }>> {
    const variables = await this.getProjectVariables(projectId);
    return variables.map(v => ({
      key: v.key,
      value: v.value,
      description: v.description || undefined,
      isSystem: v.isSystem
    }));
  }
}

