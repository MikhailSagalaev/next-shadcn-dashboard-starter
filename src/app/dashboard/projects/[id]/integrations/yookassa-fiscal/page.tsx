import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getCurrentAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { YooKassaFiscalForm } from './components/integration-form';
import { ComplianceIntegrationForm } from './components/compliance-integration-form';
import { MarkingWorkspaceNav } from '@/features/marking/components/marking-workspace-nav';

export const metadata = {
  title: 'ЮKassa и маркировка | Gupil',
  description: 'Фискализация маркированных заказов конкретного проекта'
};

export default async function YooKassaFiscalPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/auth/sign-in');

  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: admin.sub },
    select: { id: true }
  });
  if (!project) redirect('/dashboard/projects');

  const integration = await db.yooKassaFiscalIntegration.findUnique({
    where: { projectId },
    select: {
      shopId: true,
      isActive: true,
      receiptTimezone: true,
      deliveryVatCode: true,
      secretKeyEncrypted: true,
      lastTestedAt: true,
      lastError: true
    }
  });
  const complianceIntegration = await db.complianceIntegration.findUnique({
    where: { projectId },
    select: {
      provider: true,
      isActive: true,
      distanceSaleMode: true,
      gatewayUrl: true,
      credentialEncrypted: true,
      lastTestedAt: true,
      lastError: true
    }
  });

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      <Link
        href={`/dashboard/projects/${projectId}/integrations`}
        className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm'
      >
        <ChevronLeft className='h-4 w-4' />
        Назад к интеграциям
      </Link>
      <Heading
        title='ЮKassa и маркировка'
        description='Подключите ЮKassa этого магазина для отправки чеков с кодами маркировки'
      />
      <Separator />
      <MarkingWorkspaceNav projectId={projectId} active='integration' />
      <YooKassaFiscalForm
        projectId={projectId}
        integration={
          integration
            ? {
                shopId: integration.shopId,
                isActive: integration.isActive,
                receiptTimezone: integration.receiptTimezone,
                deliveryVatCode: integration.deliveryVatCode,
                hasSecretKey: Boolean(integration.secretKeyEncrypted),
                lastTestedAt: integration.lastTestedAt?.toISOString() ?? null,
                lastError: integration.lastError
              }
            : null
        }
      />
      <ComplianceIntegrationForm
        projectId={projectId}
        integration={
          complianceIntegration
            ? {
                provider: complianceIntegration.provider,
                isActive: complianceIntegration.isActive,
                distanceSaleMode: complianceIntegration.distanceSaleMode,
                gatewayUrl: complianceIntegration.gatewayUrl,
                hasCredential: Boolean(
                  complianceIntegration.credentialEncrypted
                ),
                lastTestedAt:
                  complianceIntegration.lastTestedAt?.toISOString() ?? null,
                lastError: complianceIntegration.lastError
              }
            : null
        }
      />
    </div>
  );
}
