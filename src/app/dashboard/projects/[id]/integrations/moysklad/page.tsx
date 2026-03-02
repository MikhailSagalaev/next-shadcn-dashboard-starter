/**
 * @file: page.tsx
 * @description: МойСклад integration settings page
 * @project: SaaS Bonus System
 * @dependencies: Next.js 15, React 19, Prisma
 * @created: 2026-03-01
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

export const metadata = {
  title: 'МойСклад Integration | Gupil',
  description: 'Configure МойСклад integration for bonus synchronization'
};

async function getIntegrationData(projectId: string) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect('/auth/login');
  }

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      ownerId: admin.sub
    }
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  const integration = await db.moySkladIntegration.findUnique({
    where: { projectId }
  });

  const syncLogs = integration
    ? await db.moySkladSyncLog.findMany({
        where: { integrationId: integration.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        }
      })
    : [];

  return {
    project,
    integration,
    syncLogs
  };
}

export default async function MoySkladIntegrationPage({
  params
}: {
  params: { id: string };
}) {
  const { project, integration, syncLogs } = await getIntegrationData(
    params.id
  );

  return (
    <div className='flex flex-1 flex-col space-y-6 px-6 py-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <Heading
          title='МойСклад Integration'
          description='Configure bonus synchronization with МойСклад'
        />
      </div>

      <Separator className='my-4' />

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>
            Current status of МойСклад integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integration ? (
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>Status:</span>
                <span
                  className={`text-sm ${integration.isActive ? 'text-green-600' : 'text-gray-500'}`}
                >
                  {integration.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>Sync Direction:</span>
                <span className='text-sm'>{integration.syncDirection}</span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>Last Sync:</span>
                <span className='text-sm'>
                  {integration.lastSyncAt
                    ? new Date(integration.lastSyncAt).toLocaleString()
                    : 'Never'}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>Webhook URL:</span>
                <code className='rounded bg-gray-100 px-2 py-1 text-xs'>
                  {integration.webhookUrl}
                </code>
              </div>
            </div>
          ) : (
            <p className='text-sm text-gray-500'>
              Integration not configured. Click "Configure Integration" to set
              up.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      {integration && syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Operations</CardTitle>
            <CardDescription>
              Last 10 synchronization operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className='flex items-center justify-between border-b pb-2'
                >
                  <div>
                    <p className='text-sm font-medium'>{log.operation}</p>
                    <p className='text-xs text-gray-500'>
                      {log.user
                        ? `${log.user.firstName} ${log.user.lastName}`
                        : 'Unknown user'}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p
                      className={`text-sm ${
                        log.status === 'SUCCESS'
                          ? 'text-green-600'
                          : log.status === 'ERROR'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                      }`}
                    >
                      {log.status}
                    </p>
                    <p className='text-xs text-gray-500'>
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            How to configure МойСклад integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>Obtain API token from МойСклад settings</li>
            <li>Create a bonus program in МойСклад</li>
            <li>Configure integration settings below</li>
            <li>Copy webhook URL and configure in МойСклад</li>
            <li>Test the connection</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
