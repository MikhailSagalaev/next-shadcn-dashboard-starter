import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { buildOrganizationReferralLink } from '@/lib/utils/referral-link';
import { withProjectAccess } from '@/lib/with-project-access';

type OrganizationQrParams = { id: string; organizationId: string };

export const GET = withProjectAccess<OrganizationQrParams>(
  async (request: NextRequest, { projectId, params }) => {
    const { organizationId } = await params;
    const organization = await db.partnerOrganization.findFirst({
      where: { id: organizationId, projectId },
      select: {
        name: true,
        slug: true,
        project: { select: { domain: true } }
      }
    });
    if (!organization) {
      return NextResponse.json(
        { error: 'Организация не найдена' },
        { status: 404 }
      );
    }

    const destinationUrl = buildOrganizationReferralLink(
      organization.project.domain,
      organization.slug
    );
    if (!destinationUrl) {
      return NextResponse.json(
        { error: 'Сначала настройте домен проекта' },
        { status: 422 }
      );
    }

    const format =
      request.nextUrl.searchParams.get('format') === 'png' ? 'png' : 'svg';
    const download = request.nextUrl.searchParams.get('download') === '1';
    const safeSlug = organization.slug.replace(/[^a-zA-Z0-9_-]/g, '-') || 'org';
    const headers = new Headers({
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeSlug}-organization-qr.${format}"`,
      'X-Content-Type-Options': 'nosniff'
    });

    if (format === 'png') {
      const png = await QRCode.toBuffer(destinationUrl, {
        type: 'png',
        width: 1024,
        margin: 4,
        errorCorrectionLevel: 'M'
      });
      headers.set('Content-Type', 'image/png');
      return new NextResponse(new Uint8Array(png), { headers });
    }

    const svg = await QRCode.toString(destinationUrl, {
      type: 'svg',
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#ffffff' }
    });
    headers.set('Content-Type', 'image/svg+xml; charset=utf-8');
    return new NextResponse(svg, { headers });
  }
);
