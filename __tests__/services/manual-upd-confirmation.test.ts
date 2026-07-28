import { db } from '@/lib/db';
import { ComplianceGatewayService } from '@/lib/services/compliance-gateway.service';
import { ReceivingService } from '@/lib/services/receiving.service';

jest.mock('@/lib/db');

const mockDb = db as any;

describe('manual UPD confirmation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('releases the receiving flow only after an external document id is saved', async () => {
    const sourceDocument = {
      id: 'document-1',
      projectId: 'project-1',
      goodsReceiptId: 'receipt-1',
      orderId: null,
      kind: 'UPD_RECEIPT',
      status: 'READY_TO_SIGN',
      provider: 'MANUAL',
      documentNumber: 'UPD-1',
      externalId: null,
      responsePayload: null,
      submittedAt: null,
      createdBy: 'admin-1'
    };
    mockDb.complianceDocument = {
      findFirst: jest.fn().mockResolvedValue(sourceDocument),
      findUnique: jest.fn().mockResolvedValue(sourceDocument),
      update: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ ...sourceDocument, ...data })
        ),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...sourceDocument,
        status: 'SUCCEEDED',
        externalId: 'external-upd-77'
      })
    };
    const accept = jest
      .spyOn(ReceivingService, 'accept')
      .mockResolvedValue({ accepted: true } as any);

    await ComplianceGatewayService.confirmManualDocument({
      projectId: 'project-1',
      documentId: 'document-1',
      externalId: 'external-upd-77',
      actorId: 'admin-1'
    });

    expect(mockDb.complianceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'document-1' },
        data: expect.objectContaining({
          status: 'SUCCEEDED',
          externalId: 'external-upd-77'
        })
      })
    );
    expect(accept).toHaveBeenCalledWith({
      projectId: 'project-1',
      receiptId: 'receipt-1',
      actorId: 'admin-1'
    });
  });
});
