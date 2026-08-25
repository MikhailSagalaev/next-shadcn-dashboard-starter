'use client';

import Image from 'next/image';
import { Download, ExternalLink, QrCode } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { buildOrganizationReferralLink } from '@/lib/utils/referral-link';

interface OrganizationQrCardProps {
  projectId: string;
  organizationId: string;
  organizationName: string;
  slug: string;
  domain?: string | null;
  firstPurchaseDiscountPercent: number;
}

export function OrganizationQrCard({
  projectId,
  organizationId,
  organizationName,
  slug,
  domain,
  firstPurchaseDiscountPercent
}: OrganizationQrCardProps) {
  const destinationUrl = buildOrganizationReferralLink(domain, slug);
  const qrEndpoint = `/api/projects/${projectId}/organizations/${organizationId}/qr`;

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle className='flex items-center gap-2'>
            <QrCode className='h-5 w-5' aria-hidden='true' />
            QR-код организации
          </CardTitle>
          {firstPurchaseDiscountPercent > 0 ? (
            <Badge>{firstPurchaseDiscountPercent}% на первую покупку</Badge>
          ) : (
            <Badge variant='outline'>Скидка по настройкам проекта</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {destinationUrl ? (
          <div className='grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center'>
            <div className='bg-white p-2 shadow-sm ring-1 ring-black/10'>
              <Image
                src={`${qrEndpoint}?format=svg`}
                alt={`QR-код для регистрации в организации ${organizationName}`}
                width={320}
                height={320}
                unoptimized
                className='aspect-square h-auto w-full'
              />
            </div>
            <div className='min-w-0 space-y-3'>
              <div>
                <p className='font-medium'>
                  Без привязки к конкретному человеку
                </p>
                <p className='text-muted-foreground mt-1 text-sm'>
                  Разместите QR на стойке, афише или визитке. Он ведёт сразу на
                  регистрацию, а новый клиент попадёт в эту организацию по метке{' '}
                  <code>utm_org={slug}</code>.
                </p>
              </div>
              <div className='bg-muted/50 flex min-w-0 items-center gap-2 rounded-md border p-2'>
                <code className='min-w-0 flex-1 truncate text-xs'>
                  {destinationUrl}
                </code>
                <CopyButton value={destinationUrl} label='Скопировать ссылку' />
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button variant='outline' size='sm' asChild>
                  <a href={destinationUrl} target='_blank' rel='noreferrer'>
                    <ExternalLink aria-hidden='true' />
                    Проверить ссылку
                  </a>
                </Button>
                <Button variant='outline' size='sm' asChild>
                  <a href={`${qrEndpoint}?format=png&download=1`} download>
                    <Download aria-hidden='true' />
                    Скачать PNG
                  </a>
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>
                Скидка проверяется сервером и применяется один раз. Если у
                организации указано 0%, используется общая настройка проекта,
                когда она включена.
              </p>
            </div>
          </div>
        ) : (
          <div className='rounded-lg border border-dashed p-5 text-sm'>
            <p className='font-medium'>QR-код пока нельзя сформировать</p>
            <p className='text-muted-foreground mt-1'>
              Укажите публичный домен проекта в настройках интеграции.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
