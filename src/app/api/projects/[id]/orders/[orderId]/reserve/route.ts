import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { ProjectService } from '@/lib/services/project.service';
import {
  StockReservationConflictError,
  StockReservationService
} from '@/lib/services/stock-reservation.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, orderId } = await params;
    await ProjectService.verifyProjectAccess(id, admin.sub);
    const reservations = await StockReservationService.reserveOrder(
      id,
      orderId,
      admin.sub
    );
    return NextResponse.json({ reservations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка резерва' },
      { status: error instanceof StockReservationConflictError ? 409 : 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, orderId } = await params;
  await ProjectService.verifyProjectAccess(id, admin.sub);
  return NextResponse.json(
    await StockReservationService.releaseOrder(id, orderId, admin.sub)
  );
}
