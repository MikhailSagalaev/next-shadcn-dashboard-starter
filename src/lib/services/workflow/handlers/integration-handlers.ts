/**
 * @file: src/lib/services/workflow/handlers/integration-handlers.ts
 * @description: Обработчики для integration нод (webhook, analytics)
 * @project: SaaS Bonus System
 * @created: 2025-10-24
 */

import { BaseNodeHandler } from './base-handler';
import { resolveTemplateString, resolveTemplateValue } from './utils';
import { ExternalApiIntegration } from '@/lib/services/bot-flow-executor/external-api-integration';
import type {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  ValidationResult
} from '@/types/workflow';

export class WebhookIntegrationHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'integration.webhook';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['integration.webhook'];

    if (!config) {
      throw new Error('Webhook integration configuration is missing');
    }

    const url = (await resolveTemplateString(config.url, context)).trim();
    if (!url) {
      throw new Error('Webhook URL is required');
    }

    const method = (config.method || 'POST').toUpperCase();
    const headers = await resolveTemplateValue<Record<string, string | number | boolean>>(config.headers || {}, context);
    const body = await resolveTemplateValue(config.body, context);
    const timeout = config.timeout ?? 15000;
    const retries = config.retries ?? 0;

    this.logStep(context, node, 'Executing webhook integration', 'info', {
      method,
      url,
      timeout,
      retries
    });

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;
      try {
        await this.performRequest(url, method, headers, body, timeout);
        return null;
      } catch (error) {
        if (attempt > retries + 1) {
          throw error;
        }

        const delay = Math.min(2000 * attempt, 10000);
        this.logStep(context, node, 'Webhook attempt failed, retrying', 'warn', {
          attempt,
          retries,
          delay,
          error: error instanceof Error ? error.message : String(error)
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async performRequest(
    url: string,
    method: string,
    headers: Record<string, string | number | boolean>,
    body: any,
    timeout: number
  ): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const normalizedHeaders: Record<string, string> = Object.entries(headers || {}).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value);
          }
          return acc;
        },
        {} as Record<string, string>
      );

      const options: RequestInit = {
        method,
        headers: normalizedHeaders,
        signal: controller.signal
      };

      if (method !== 'GET' && method !== 'DELETE') {
        if (typeof body === 'string') {
          options.body = body;
        } else if (body !== undefined && body !== null) {
          options.body = JSON.stringify(body);
          options.headers = {
            'Content-Type': 'application/json',
            ...normalizedHeaders
          };
        }
      }

      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Webhook responded with status ${response.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!config?.url) {
      errors.push('url is required');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class AnalyticsIntegrationHandler extends BaseNodeHandler {
  canHandle(nodeType: WorkflowNodeType): boolean {
    return nodeType === 'integration.analytics';
  }

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<string | null> {
    const config = node.data.config?.['integration.analytics'];

    if (!config) {
      throw new Error('Analytics integration configuration is missing');
    }

    const eventName = (await resolveTemplateString(config.event, context)).trim();
    if (!eventName) {
      throw new Error('Analytics event name is required');
    }

    const analyticsUrl = process.env.ANALYTICS_SERVICE_URL;
    if (!analyticsUrl) {
      this.logStep(context, node, 'ANALYTICS_SERVICE_URL is not set. Skipping analytics integration.', 'warn');
      return null;
    }

    const properties = await resolveTemplateValue<Record<string, any>>(config.properties || {}, context);
    const userId = (config.userId
      ? (await resolveTemplateString(config.userId, context)).trim()
      : context.userId || context.telegram.userId || 'anonymous');

    await ExternalApiIntegration.trackEvent(analyticsUrl, {
      eventName,
      userId: userId.toString(),
      properties,
      timestamp: context.now().toISOString()
    });

    this.logStep(context, node, 'Analytics event sent', 'info', {
      eventName,
      userId
    });

    return null;
  }

  async validate(config: any): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!config?.event) {
      errors.push('event is required');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

