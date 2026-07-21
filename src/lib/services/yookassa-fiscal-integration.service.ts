import { db } from '@/lib/db';
import { decryptIntegrationSecret } from '@/lib/integrations/credential-encryption';
import type { YooKassaCredentials } from '@/lib/yookassa/client';

export class YooKassaFiscalConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YooKassaFiscalConfigurationError';
  }
}

export async function getActiveYooKassaFiscalIntegration(projectId: string) {
  const integration = await db.yooKassaFiscalIntegration.findUnique({
    where: { projectId }
  });
  if (!integration) {
    throw new YooKassaFiscalConfigurationError(
      'Сначала подключите ЮKassa магазина в разделе интеграций проекта'
    );
  }
  if (!integration.isActive) {
    throw new YooKassaFiscalConfigurationError(
      'Интеграция ЮKassa магазина не активирована'
    );
  }
  let secretKey: string;
  try {
    secretKey = decryptIntegrationSecret(integration.secretKeyEncrypted);
  } catch {
    throw new YooKassaFiscalConfigurationError(
      'Не удалось расшифровать ключ ЮKassa проекта'
    );
  }
  const credentials: YooKassaCredentials = {
    shopId: integration.shopId,
    secretKey
  };
  return { integration, credentials };
}
